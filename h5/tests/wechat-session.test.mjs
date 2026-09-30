import test from 'node:test';
import assert from 'node:assert/strict';
import { deferred, flush, loadModule, pageRuntime, plain, storage } from './helpers/runtime.mjs';

async function memberFixture() {
  const uni = storage({ token: 'member-a', 'refresh-token': 'refresh-a', openid: 'old-openid' });
  const info = deferred(), wallet = deferred(), orders = deferred(), coupons = deferred();
  let cleared = 0;
  const { default: useUser } = await loadModule('sheep/store/user.js', {
    globals: { uni },
    mocks: {
      pinia: { defineStore: (definition) => {
        const store = definition.state();
        for (const [key, action] of Object.entries(definition.actions)) store[key] = action.bind(store);
        return () => store;
      } },
      'lodash-es': { clone: (value) => ({ ...value }), cloneDeep: plain },
      '@/sheep/platform/share': { default: { getShareInfo: () => {}, bindBrokerageUser: () => {} } },
      './cart': { default: () => ({ emptyList: () => cleared++, getList: async () => {} }) },
      './app': { default: () => ({ platform: { bind_mobile: false } }) },
      '@/sheep/hooks/useModal': { showAuthModal: () => {} },
      '@/sheep/api/member/user': { default: { getUserInfo: () => info.promise } },
      '@/sheep/api/pay/wallet': { default: { getPayWallet: () => wallet.promise } },
      '@/sheep/api/trade/order': { default: { getOrderCount: () => orders.promise } },
      '@/sheep/api/promotion/coupon': { default: { getUnusedCouponCount: () => coupons.promise } },
    },
  });
  return { user: useUser(), uni, info, wallet, orders, coupons, cleared: () => cleared };
}

test('Switching members discards late profile, wallet, order and coupon responses', async () => {
  const f = await memberFixture();
  const info = f.user.getInfo(), wallet = f.user.getWallet();
  f.user.getNumData();
  f.user.loginAfter = async () => {};
  const previousSession = f.user.getSessionVersion();
  await f.user.setToken('member-b', 'refresh-b');
  f.info.resolve({ code: 0, data: { id: 'member-a', nickname: 'old' } });
  f.wallet.resolve({ code: 0, data: { balance: 500 } });
  f.orders.resolve({ code: 0, data: { allCount: 8 } });
  f.coupons.resolve({ code: 0, data: 7 });
  await Promise.all([info, wallet]);
  await flush();
  assert.equal(f.user.getSessionVersion(), previousSession + 1);
  assert.equal(f.user.userInfo.id, undefined);
  assert.equal(f.user.userWallet.balance, 0);
  assert.equal(f.user.numData.orderCount.allCount, 0);
  assert.equal(f.user.numData.unusedCouponCount, 0);
  assert.equal(f.uni.getStorageSync('openid'), '');
  assert.equal(f.cleared(), 1);
});

test('Refreshing credentials keeps the current member data and does not re-enter login loading', async () => {
  const f = await memberFixture();
  f.user.userInfo = { id: 'member-a' };
  f.user.userWallet = { balance: 500 };
  let loginLoads = 0;
  f.user.loginAfter = async () => loginLoads++;
  const session = f.user.getSessionVersion();
  await f.user.setToken('refreshed-a', 'refreshed-refresh-a', true);
  assert.equal(f.user.getSessionVersion(), session);
  assert.equal(f.user.userInfo.id, 'member-a');
  assert.equal(f.user.userWallet.balance, 500);
  assert.equal(loginLoads, 0);
  assert.equal(f.cleared(), 0);
});

async function callbackFixture(platformName = 'WechatOfficialAccount') {
  const runtime = pageRuntime(), watchers = [], redirects = [], bindings = [];
  const user = { isLogin: false, userInfo: {} };
  const location = new URL('https://site.webto.cc/pages/index/login?event=login&code=one-use-code&state=expected');
  location.replace = (value) => redirects.push(value);
  let prompts = 0, cleaned;
  const provider = {
    consumeOAuth: () => {},
    login: async () => ({ code: 0, data: { bindRequired: true } }),
    bind: async (...args) => { bindings.push(args); return { redirecting: true }; },
    getReturnUrl: () => 'https://site.webto.cc/pages/pay/index?id=52',
  };
  const module = await loadModule('pages/index/login.vue', {
    expose: ['state', 'canWechatLogin', 'useExistingAccount', 'passwordLogin', 'bindAccount'],
    globals: { location, history: { state: {}, replaceState: (state, title, url) => { cleaned = url; } } },
    mocks: {
      vue: { ...runtime.vue, watch: (getter, callback) => watchers.push(callback) },
      '@dcloudio/uni-app': runtime.lifecycle,
      '@/sheep': { default: { $store: () => user, $platform: { name: platformName, useProvider: () => provider } } },
      '@/sheep/hooks/useModal': { showAuthModal: () => prompts++, closeAuthModal: () => {} },
      '@/sheep/helper': { getRootUrl: () => 'https://site.webto.cc/' },
    },
  });
  return { ...module, ...runtime, user, provider, bindings, redirects, cleaned: () => cleaned,
    prompts: () => prompts, loggedIn: () => { user.isLogin = true; watchers.forEach((callback) => callback(true)); } };
}

test('Linking an existing account requires password login and a separate binding confirmation', async () => {
  const f = await callbackFixture();
  await f.hooks.onLoad({});
  assert.equal(f.state.phase, 'choose');
  assert.equal(f.cleaned(), 'https://site.webto.cc/pages/index/login');
  f.useExistingAccount();
  assert.equal(f.state.phase, 'account');
  assert.equal(f.prompts(), 1);
  f.loggedIn();
  assert.equal(f.state.phase, 'bind');
  assert.equal(f.bindings.length, 0);
  assert.equal(f.redirects.length, 0);
  await f.bindAccount();
  assert.deepEqual(f.bindings[0], ['', '', 'https://site.webto.cc/pages/pay/index?id=52']);
});

test('Ordinary browsers can leave the OAuth callback through password login without binding', async () => {
  const f = await callbackFixture('H5');
  await f.hooks.onLoad({});
  assert.equal(f.canWechatLogin, false);
  assert.equal(f.state.phase, 'error');
  f.passwordLogin();
  f.loggedIn();
  assert.equal(f.bindings.length, 0);
  assert.deepEqual(f.redirects, ['https://site.webto.cc/pages/pay/index?id=52']);
});

test('Returning to a previous page restores its share information; hidden pages do not update it', async () => {
  const updates = [];
  async function layout(title) {
    const runtime = pageRuntime(), props = { onShareAppMessage: { title } };
    let mounted, changed;
    await loadModule('sheep/components/s-layout/s-layout.vue', {
      globals: { defineProps: () => props, defineEmits: () => () => {} },
      mocks: {
        vue: { ...runtime.vue, onMounted: (callback) => { mounted = callback; }, watch: (getter, callback) => { changed = callback; } },
        '@dcloudio/uni-app': runtime.lifecycle,
        'lodash-es': { isEmpty: (value) => !value || Object.keys(value).length === 0 },
        '@/sheep': { default: { $store: () => ({}), $platform: { share: { updateShareInfo: (data) => updates.push(data.title) } } } },
      },
    });
    return { ...runtime, props, mounted, changed };
  }
  const a = await layout('商品 A'), b = await layout('商品 B');
  a.mounted(); a.hooks.onHide(); b.mounted();
  a.props.onShareAppMessage = { title: '商品 A 更新' }; a.changed();
  assert.deepEqual(updates, ['商品 A', '商品 B']);
  b.hooks.onHide(); a.hooks.onShow();
  assert.deepEqual(updates, ['商品 A', '商品 B', '商品 A 更新']);
});

test('Mini-program timeline queries contain the current product id and never a page path', async () => {
  const { SharePageEnum } = await loadModule('sheep/util/const.js', { mocks: { dayjs: { default: () => {} } } });
  const page = { route: 'pages/goods/index', options: { id: '652' } };
  const { default: share } = await loadModule('sheep/platform/share.js', {
    platform: 'MP-WEIXIN', globals: { getCurrentPages: () => [page] },
    mocks: {
      '@/sheep/store': { default: () => ({}) }, '@/sheep/platform': { default: { name: 'WechatMiniProgram' } },
      '@/sheep/router': { default: {} }, '@/sheep/url': { default: {} },
      '@/sheep/api/trade/brokerage': { default: {} }, '@/sheep/util/const': { SharePageEnum },
      '@/sheep/config': { h5Url: 'https://site.webto.cc' },
      '@/sheep/config/brand': { SHOP_NAME: '娱果商城', SHARE_LOGO: 'https://site.webto.cc/static/share/yuguo-logo-edb98138.png' },
    },
  });
  const query = share.getTimelineQuery({ query: 'spm=0.2.652.3.1' });
  assert.equal(query, 'id=652&spm=0.2.652.3.1');
  assert.equal(query.includes('pages/'), false);
  assert.equal(share.canShareTimeline(), true);
  page.route = 'pages/pay/result';
  assert.equal(share.canShareTimeline(), false);
});
