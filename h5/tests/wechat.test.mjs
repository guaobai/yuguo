import test from 'node:test';
import assert from 'node:assert/strict';
import { Clock, deferred, flush, loadModule, pageRuntime, plain, storage } from './helpers/runtime.mjs';

async function sdkFixture({ ios = false, autoReady = true, autoCheck = true, signer } = {}) {
  const clock = new Clock();
  const signatures = [], configs = [], ready = [], checks = [];
  const location = { href: 'https://site.webto.cc/pages/goods/index?id=652&from=friend#details' };
  const wx = {
    error(callback) { wx.onError = callback; },
    config(config) { configs.push(config); },
    ready(callback) { ready.push(callback); if (autoReady) callback(); },
    checkJsApi(options) { checks.push(options); if (autoCheck) options.success({}); },
  };
  const auth = { createWeixinMpJsapiSignature: async (url) => {
    signatures.push(url);
    return signer ? signer(url) : { code: 0, data: { appId: 'test-appid', signature: 'signed', timestamp: 1, nonceStr: 'nonce' } };
  } };
  const { default: sdk } = await loadModule('sheep/libs/sdk-h5-weixin.js', {
    mocks: { 'weixin-js-sdk': { default: wx }, '@/sheep/api/member/auth': { default: auth },
      './sdk-h5-weixin-debug': { shareDebug: () => {} } },
    globals: { ...clock.globals(), window: { location }, navigator: { userAgent: (ios ? 'iPhone' : 'Android') + ' MicroMessenger' } },
  });
  return { sdk, wx, clock, signatures, configs, ready, checks, location };
}

test('SDK shares concurrent initialization and waits for the bridge check', async () => {
  const f = await sdkFixture({ autoReady: false, autoCheck: false });
  let completed = 0;
  const a = f.sdk.init().then(() => completed++);
  const b = f.sdk.init().then(() => completed++);
  await flush();
  assert.equal(f.signatures.length, 1);
  assert.equal(completed, 0);
  f.ready[0]();
  await flush();
  assert.equal(completed, 0);
  f.checks[0].success({});
  await Promise.all([a, b]);
  assert.equal(completed, 2);
  assert.ok(f.configs[0].jsApiList.includes('updateAppMessageShareData'));
  assert.equal(f.clock.timers.size, 0);
});

for (const ios of [false, true]) test(`SDK signs the correct URL on ${ios ? 'iOS' : 'Android'}`, async () => {
  const f = await sdkFixture({ ios });
  await f.sdk.init();
  f.location.href = 'https://site.webto.cc/pages/goods/index?id=900#summary';
  await f.sdk.init();
  assert.equal(f.signatures[0], 'https://site.webto.cc/pages/goods/index?id=652&from=friend');
  assert.equal(f.signatures.length, ios ? 1 : 2);
  if (!ios) assert.equal(f.signatures[1], 'https://site.webto.cc/pages/goods/index?id=900');
});

test('SDK can retry after a business failure or a native config error', async () => {
  let fail = true;
  const f = await sdkFixture({ signer: () => fail ? { code: 500, msg: '签名失败' }
    : { code: 0, data: { signature: 'new-signature' } } });
  await assert.rejects(f.sdk.init(), /签名失败/);
  fail = false;
  await f.sdk.init();
  f.wx.onError({ errMsg: 'config:invalid signature' });
  await f.sdk.init();
  assert.equal(f.signatures.length, 3);
});

test('SDK timeout and late ready callbacks cannot poison the next initialization', async () => {
  const f = await sdkFixture({ autoReady: false });
  const first = assert.rejects(f.sdk.init(), /初始化超时/);
  await flush();
  await f.clock.advance(12000);
  await first;
  let completed = false;
  const retry = f.sdk.init().then(() => { completed = true; });
  await flush();
  f.ready[0]();
  await flush();
  assert.equal(completed, false);
  f.ready[1]();
  await retry;
});

test('SDK API cancellation, callback failure and timeout all settle', async () => {
  const f = await sdkFixture();
  let failures = 0;
  f.wx.getLocation = (options) => options.cancel({ errMsg: 'getLocation:cancel' });
  await assert.rejects(f.sdk.getLocation({ fail: () => failures++ }), (error) => error.cancelled === true);
  assert.equal(failures, 1);
  f.wx.getLocation = () => {};
  const timed = assert.rejects(f.sdk.getLocation(), /操作超时/);
  await flush();
  await f.clock.advance(20000);
  await timed;
});

test('Share updates finish in order so a slower previous page cannot replace the current page', async () => {
  const f = await sdkFixture();
  const calls = [];
  f.wx.updateAppMessageShareData = f.wx.updateTimelineShareData = (options) => calls.push(options);
  const a = f.sdk.updateShareInfo({ title: '商品 A' });
  await flush();
  assert.equal(calls.length, 2);
  const b = f.sdk.updateShareInfo({ title: '商品 B' });
  await flush();
  assert.equal(calls.length, 2);
  calls[1].success({}); calls[0].success({});
  assert.equal(await a, false);
  await flush();
  assert.deepEqual(calls.map((call) => call.title), ['商品 A', '商品 A', '商品 B', '商品 B']);
  calls[3].success({}); calls[2].success({});
  assert.equal(await b, true);
});

async function oauthFixture() {
  const clock = new Clock(), session = storage(), uni = storage({ token: 'member-token', openid: 'stale' });
  const redirects = [], logins = [], bindings = [];
  const location = new URL('https://site.webto.cc/pages/pay/index?id=52&orderType=goods');
  location.assign = (url) => redirects.push(url);
  let openid = 'member-A';
  const auth = {
    socialAuthRedirect: async (type, redirectUri) => ({ code: 0, data: 'https://open.weixin.qq.com/connect/oauth2/authorize?state=random-state&redirect_uri=' + encodeURIComponent(redirectUri) }),
    socialLogin: async (...args) => { logins.push(args); return { code: 0, data: { bindRequired: true } }; },
  };
  const { default: provider } = await loadModule('sheep/platform/provider/wechat/officialAccount.js', {
    mocks: {
      '@/sheep/libs/sdk-h5-weixin': { default: { init: async () => {} } },
      '@/sheep/helper': { getRootUrl: () => 'https://site.webto.cc/' },
      '@/sheep/api/member/auth': { default: auth },
      '@/sheep/api/member/social': { default: {
        getSocialUser: async () => ({ code: 0, data: { openid } }),
        socialBind: async (...args) => { bindings.push(args); return { code: 0 }; },
      } },
    }, globals: { ...clock.globals(), window: { location }, location, sessionStorage: session, uni },
  });
  return { provider, clock, session, uni, redirects, logins, bindings, auth, setOpenid: (value) => { openid = value; } };
}

test('OAuth preserves the payment destination and consumes state exactly once', async () => {
  const f = await oauthFixture();
  assert.equal((await f.provider.login()).redirecting, true);
  assert.equal(f.provider.getReturnUrl(), 'https://site.webto.cc/pages/pay/index?id=52&orderType=goods');
  const options = { event: 'login', state: 'random-state', code: 'wechat-code' };
  f.provider.consumeOAuth(options);
  assert.throws(() => f.provider.consumeOAuth(options), /已失效/);
  assert.equal(f.redirects.length, 1);
});

test('OAuth rejects incorrect, expired or cancelled state without automatically redirecting', async () => {
  const f = await oauthFixture();
  await f.provider.login();
  assert.throws(() => f.provider.consumeOAuth({ event: 'login', state: 'wrong', code: 'code' }), /已失效/);
  await f.provider.login();
  await f.clock.advance(600001);
  assert.throws(() => f.provider.consumeOAuth({ event: 'login', state: 'random-state', code: 'code' }), /已失效/);
  await f.provider.login();
  assert.throws(() => f.provider.consumeOAuth({ event: 'login', state: 'random-state' }), /未完成/);
  assert.equal(f.redirects.length, 3);
});

test('OAuth blocks external return URLs and unexpected authorization hosts', async () => {
  const f = await oauthFixture();
  assert.equal(f.provider.safeReturnUrl('https://other.example/'), 'https://site.webto.cc/');
  assert.equal(f.provider.safeReturnUrl('https://site.webto.cc/pages/index/login?code=old'), 'https://site.webto.cc/');
  f.auth.socialAuthRedirect = async () => ({ code: 0, data: 'https://other.example/?state=state' });
  await assert.rejects(f.provider.login(), /授权地址无效/);
  assert.equal(f.redirects.length, 0);
});

test('OAuth requests explicit registration and reads OpenID from the current member every time', async () => {
  const f = await oauthFixture();
  assert.equal((await f.provider.login('code', 'state')).data.bindRequired, true);
  assert.deepEqual(f.logins[0], [31, 'code', 'state', false]);
  await f.provider.login('new-code', 'state', true);
  assert.equal(f.logins[1][3], true);
  await f.provider.register();
  assert.equal(JSON.parse(f.session.getItem('wechat-oauth-flow')).event, 'register');
  assert.equal(await f.provider.getOpenid(), 'member-A');
  f.setOpenid('member-B');
  assert.equal(await f.provider.getOpenid(), 'member-B');
  assert.equal(f.uni.getStorageSync('openid'), '');
  f.uni.removeStorageSync('token');
  await assert.rejects(f.provider.bind(), /请先登录/);
  assert.equal(f.bindings.length, 0);
});

async function payFixture({ mini = false } = {}) {
  const clock = new Clock(), submits = [], redirects = [], messages = [];
  const provider = { getOpenid: async () => 'current-openid', bind: async () => true };
  const wx = { init: async () => {}, wxpay: async () => ({}) };
  const api = { submitOrder: async (data) => {
    submits.push(data);
    return { code: 0, data: { displayContent: JSON.stringify({ timeStamp: '1', nonceStr: 'n', packageValue: 'prepay_id=test', signType: 'MD5', paySign: 's' }) } };
  } };
  const uni = { showModal: async () => ({ confirm: false }), requestPayment: (options) => options.success({}) };
  const sheep = {
    $platform: { name: mini ? 'WechatMiniProgram' : 'WechatOfficialAccount', useProvider: () => provider },
    $helper: { toast: (message) => messages.push(message) },
    $router: { redirect: (...args) => redirects.push(args) },
  };
  const module = await loadModule('sheep/platform/pay.js', {
    platform: mini ? 'MP-WEIXIN' : 'H5', globals: { ...clock.globals(), uni },
    mocks: { '@/sheep': { default: sheep }, '@/sheep/libs/sdk-h5-weixin': { default: wx },
      '@/sheep/helper': { getRootUrl: () => 'https://site.webto.cc/' }, '@/sheep/api/pay/order': { default: api } },
  });
  return { Pay: module.default, getPayMethods: module.getPayMethods, clock, submits, redirects, messages, provider, wx, uni, api };
}

test('Repeated payment clicks share one request and the lock releases on cancellation', async () => {
  const f = await payFixture(), pending = deferred();
  f.wx.wxpay = () => pending.promise;
  const a = new f.Pay('wechat', 'goods', 100);
  const b = new f.Pay('wechat', 'goods', 100);
  assert.equal(a.promise, b.promise);
  await flush();
  assert.equal(f.submits.length, 1);
  assert.equal(f.submits[0].channelExtras.openid, 'current-openid');
  pending.reject({ errMsg: 'chooseWXPay:cancel' });
  assert.equal(await a.promise, false);
  assert.equal(f.redirects.length, 0);
  f.wx.wxpay = async () => ({});
  assert.equal(await new f.Pay('wechat', 'goods', 100).promise, true);
  assert.equal(f.submits.length, 2);
  assert.equal(f.redirects[0][0], '/pages/pay/result');
});

test('Missing binding and prepayment business failures end without invoking native payment', async () => {
  const f = await payFixture();
  let nativeCalls = 0;
  f.wx.wxpay = async () => { nativeCalls++; };
  f.provider.getOpenid = async () => '';
  assert.equal(await new f.Pay('wechat', 'goods', 1).promise, false);
  assert.equal(f.submits.length, 0);
  f.provider.getOpenid = async () => 'id';
  f.api.submitOrder = async () => ({ code: 400, msg: '支付渠道未开启' });
  assert.equal(await new f.Pay('wechat', 'goods', 1).promise, false);
  assert.equal(nativeCalls, 0);
  assert.ok(f.messages.includes('支付渠道未开启'));
});

test('An uncertain native result goes to server confirmation instead of showing success', async () => {
  const f = await payFixture();
  f.wx.wxpay = async () => { throw new Error('network interrupted'); };
  assert.equal(await new f.Pay('wechat', 'goods', 2).promise, false);
  assert.equal(f.redirects[0][1].payState, 'pending');
});

test('Mini-program payment retains wx_lite and native payment parameters', async () => {
  const f = await payFixture({ mini: true });
  let options;
  f.uni.requestPayment = (value) => { options = value; value.success({}); };
  assert.equal(await new f.Pay('wechat', 'goods', 3).promise, true);
  assert.equal(f.submits[0].channelCode, 'wx_lite');
  assert.equal(options.package, 'prepay_id=test');
  assert.equal(options.provider, 'wxpay');
  assert.equal(f.getPayMethods(['wx_pub'])[0].disabled, true);
  assert.equal(f.getPayMethods(['wx_lite'])[0].disabled, false);
});

async function pollFixture(getOrder) {
  const clock = new Clock(), runtime = pageRuntime(), calls = [];
  const page = await loadModule('pages/pay/result.vue', {
    expose: ['state', 'startPolling'], globals: clock.globals(),
    mocks: {
      '@dcloudio/uni-app': runtime.lifecycle, vue: runtime.vue,
      '@/sheep': { default: { $router: { redirect() {} } } },
      '@/sheep/api/pay/order': { default: { getOrder: async (...args) => { calls.push(args); return getOrder(...args); } } },
      '@/sheep/hooks/useGoods': { fen2yuan: (x) => x / 100 },
      '@/sheep/api/trade/order': { default: { getOrderDetail: async () => ({ code: 0, data: {} }) } },
      '@/sheep/util/const': { WxaSubscribeTemplate: {} },
    },
  });
  runtime.hooks.onLoad({ id: '100' });
  return { clock, page, calls, hooks: runtime.hooks };
}

test('Delayed payment notifications reach pending, allow re-query, then confirm from the server', async () => {
  let status = 0;
  const f = await pollFixture(async () => ({ code: 0, data: { status, merchantOrderId: 1 } }));
  f.hooks.onShow(); await flush();
  await f.clock.advance(40000);
  assert.equal(f.calls.length, 8);
  assert.equal(f.page.state.result, 'pending');
  assert.equal(f.clock.timers.size, 0);
  status = 10;
  f.page.startPolling(); await flush();
  assert.equal(f.page.state.result, 'paid');
  assert.deepEqual(f.calls[0], ['100', true, true]);
});

test('Network failure and an unknown server status never become payment success', async () => {
  let failed = true;
  const f = await pollFixture(async () => { if (failed) throw new Error('offline'); return { code: 0, data: { status: 99 } }; });
  f.hooks.onShow(); await flush();
  failed = false;
  await f.clock.advance(40000);
  assert.equal(f.page.state.result, 'pending');
});

test('Polling ignores an in-flight response after hide, resumes once, and stops after unload', async () => {
  const response = deferred();
  let count = 0;
  const f = await pollFixture(() => ++count === 1 ? response.promise : Promise.resolve({ code: 0, data: { status: 0 } }));
  f.hooks.onShow(); await flush();
  f.hooks.onHide();
  f.hooks.onShow();
  response.resolve({ code: 0, data: { status: 10 } });
  await flush();
  assert.equal(count, 2);
  assert.equal(f.page.state.result, 'unpaid');
  assert.equal(f.clock.timers.size, 1);
  f.hooks.onUnload();
  await f.clock.advance(10000);
  assert.equal(count, 2);
});

test('Closed and refunded-paid server statuses are handled explicitly', async () => {
  for (const [status, expected] of [[30, 'closed'], [20, 'paid']]) {
    const f = await pollFixture(async () => ({ code: 0, data: { status } }));
    f.hooks.onShow(); await flush();
    assert.equal(f.page.state.result, expected);
    assert.equal(f.clock.timers.size, 0);
  }
});

test('Address import preserves details when the cache or district is missing', async () => {
  const { resolveWechatAddress } = await loadModule('sheep/util/wechat-address.js');
  const address = { consignee: '测试收件人', mobile: '13800000000', address: '1号楼', province_name: '江苏省', city_name: '南京市', district_name: '鼓楼区' };
  const absent = resolveWechatAddress('', address);
  assert.equal(absent.name, address.consignee);
  assert.equal(absent.detailAddress, '1号楼');
  assert.equal(absent.areaId, undefined);
  const areas = [{ name: '江苏省', children: [{ name: '南京市', children: [{ name: '鼓楼区', id: 320106 }] }] }];
  assert.equal(resolveWechatAddress(areas, address).areaId, 320106);
  assert.equal(resolveWechatAddress(areas, { ...address, district_name: '旧区名' }).areaId, undefined);
});

test('Location dispatches to the WeChat bridge and rejects invalid store coordinates', async () => {
  const calls = [];
  const location = await loadModule('sheep/platform/location.js', {
    mocks: { '@/sheep/libs/sdk-h5-weixin': { default: { isWechat: () => true,
      getLocation: async () => ({ latitude: 31, longitude: 118 }),
      openLocation: async (data) => calls.push(data) } } },
  });
  assert.equal((await location.getLocation()).latitude, 31);
  await assert.rejects(location.openLocation({ latitude: '', longitude: '118' }), /位置信息不完整/);
  await location.openLocation({ latitude: '31', longitude: '118' });
  assert.equal(calls[0].latitude, 31);
  assert.match(location.locationErrorMessage({ errMsg: 'getLocation:auth deny' }), /直接选择门店/);
});

test('Mini-program subscription distinguishes per-template acceptance, refusal and ban', async () => {
  const clock = new Clock();
  const uni = { canIUse: () => false, requestSubscribeMessage: (options) => options.success({ a: 'accept', b: 'reject', c: 'ban' }) };
  const { default: provider } = await loadModule('sheep/platform/provider/wechat/miniProgram.js', {
    platform: 'MP-WEIXIN', globals: { ...clock.globals(), uni },
    mocks: { '@/sheep/api/member/auth': { default: {} }, '@/sheep/api/member/user': { default: {} },
      '@/sheep/api/member/social': { default: { getSubscribeTemplateList: async () => ({ code: 0, data: [
        { id: 'a', title: '发货' }, { id: 'b', title: '成团' }, { id: 'c', title: '退款' },
      ] }) } } },
  });
  provider.load(); await flush();
  const result = await provider.subscribeMessage(['发货', '成团', '退款', '缺失']);
  assert.deepEqual(plain(result.accepted), ['a']);
  assert.deepEqual(plain(result.rejected), ['b']);
  assert.deepEqual(plain(result.blocked), ['c']);
  assert.deepEqual(plain(result.missing), ['缺失']);
  uni.requestSubscribeMessage = (options) => options.success({ a: 'filter' });
  assert.deepEqual(plain((await provider.subscribeMessage('发货')).filtered), ['a']);
  assert.equal((await provider.subscribeMessage('不存在')).requested.length, 0);
  uni.requestSubscribeMessage = () => {};
  const timeout = provider.subscribeMessage('发货');
  await clock.advance(60000);
  assert.match((await timeout).error, /超时/);
});

async function requestFixture(refresh) {
  const uni = storage({ token: 'old-access', 'refresh-token': 'old-refresh' });
  const replayed = [], messages = [];
  uni.hideLoading = () => {};
  uni.showToast = (options) => messages.push(options.title);
  let prompts = 0, logoutCount = 0, session = 0;
  const user = {
    isLogin: true,
    getSessionVersion: () => session,
    setToken: async (token, refreshToken) => { uni.setStorageSync('token', token); uni.setStorageSync('refresh-token', refreshToken); },
    logout: () => { session++; logoutCount++; user.isLogin = false; uni.removeStorageSync('token'); uni.removeStorageSync('refresh-token'); },
  };
  class Request {
    interceptors = { request: { use: (success) => { this.onRequest = success; } }, response: { use: (success, fail) => { this.onSuccess = success; this.onError = fail; } } };
    middleware(config) { replayed.push(config); return Promise.resolve({ code: 0 }); }
  }
  const auth = { refreshToken: () => refresh(uni) };
  const module = await loadModule('sheep/request/index.js', {
    expose: ['refreshToken', 'http'], globals: { uni, window: { navigator: { onLine: true } } },
    mocks: {
      'luch-request': { default: Request }, '@/sheep/config': { apiPath: '/app-api', baseUrl: '', tenantId: 1 },
      '@/sheep/store': { default: () => user }, '@/sheep/platform': { default: { name: 'WechatOfficialAccount' } },
      '@/sheep/hooks/useModal': { showAuthModal: () => prompts++ }, '@/sheep/api/member/auth': { default: auth },
      '@/sheep/util/const': { getTerminal: () => 20 }, '@/sheep/util/url': { normalizeImageUrls: () => {} },
    },
  });
  const config = () => ({ url: '/member/user/get', header: { Authorization: uni.getStorageSync('token') }, custom: { authSession: session } });
  const switchAccount = () => { session++; user.isLogin = true; uni.setStorageSync('token', 'other-access'); uni.setStorageSync('refresh-token', 'other-refresh'); };
  return { ...module, uni, replayed, messages, config, auth, user, switchAccount, prompts: () => prompts, logouts: () => logoutCount };
}

test('A failed token refresh rejects every waiting request and allows a later login attempt', async () => {
  const pending = deferred();
  let refreshCalls = 0;
  const f = await requestFixture(() => { refreshCalls++; return pending.promise; });
  const results = Promise.allSettled([f.refreshToken(f.config()), f.refreshToken(f.config())]);
  await flush();
  pending.resolve({ code: 401 });
  assert.ok((await results).every((result) => result.status === 'rejected'));
  assert.equal(refreshCalls, 1);
  assert.equal(f.prompts(), 1);
  assert.equal(f.replayed.length, 0);
  f.uni.setStorageSync('token', 'old-access');
  f.uni.setStorageSync('refresh-token', 'new-refresh');
  f.auth.refreshToken = async () => { f.uni.setStorageSync('token', 'new-access'); return { code: 0, data: { accessToken: 'new-access' } }; };
  await f.refreshToken(f.config());
  assert.equal(f.replayed.length, 1);
});

test('Concurrent 401s share one refresh; a replayed 401 never loops', async () => {
  const pending = deferred();
  let refreshCalls = 0;
  const f = await requestFixture(() => { refreshCalls++; return pending.promise; });
  const all = Promise.all([f.refreshToken(f.config()), f.refreshToken(f.config())]);
  await flush();
  f.uni.setStorageSync('token', 'new-access');
  pending.resolve({ code: 0, data: { accessToken: 'new-access' } });
  await all;
  assert.equal(refreshCalls, 1);
  assert.equal(f.replayed.length, 2);
  assert.equal(f.replayed[0].header.Authorization, 'new-access');
  await assert.rejects(f.refreshToken(f.replayed[0]), (error) => error.code === 401);
  assert.equal(f.replayed.length, 2);
});

test('Network errors without errMsg settle and respect silent error settings', async () => {
  const f = await requestFixture(async () => ({ code: 401 }));
  await f.http.onError({ statusCode: 500, config: { custom: { showError: false } } });
  assert.equal(f.messages.length, 0);
  await f.http.onError({ statusCode: 500, config: { custom: { showError: true } } });
  assert.equal(f.messages.length, 1);
});

test('Late responses and retries cannot cross into a different member session', async () => {
  const f = await requestFixture(async () => ({ code: 401 }));
  const config = f.config();
  f.http.onRequest(config);
  f.switchAccount();
  const stale = (error) => error.staleSession === true;
  await assert.rejects(f.http.onSuccess({ config, data: { code: 0, data: { id: 'old-member' } } }), stale);
  await assert.rejects(f.http.onSuccess({ config, data: { code: 401 } }), stale);
  await assert.rejects(f.http.onError({ config, statusCode: 500 }), stale);
  await assert.rejects(f.http.onRequest(config), stale);
  assert.equal(f.replayed.length, 0);
  assert.equal(f.logouts(), 0);
  assert.equal(f.prompts(), 0);
});

test('A late refresh success cannot restore the previous member credentials', async () => {
  const f = await requestFixture(async () => ({ code: 401 }));
  const config = f.config();
  config.url = '/member/auth/refresh-token';
  f.switchAccount();
  await assert.rejects(f.http.onSuccess({ config, data: { code: 0, data: {
    accessToken: 'old-member-refreshed', refreshToken: 'old-member-refresh',
  } } }), (error) => error.staleSession === true);
  assert.equal(f.uni.getStorageSync('token'), 'other-access');
  assert.equal(f.logouts(), 0);
});

test('An old refresh failure does not log out a newly signed-in member', async () => {
  const pending = deferred();
  const f = await requestFixture(() => pending.promise);
  const result = assert.rejects(f.refreshToken(f.config()), (error) => error.staleSession === true);
  await flush();
  f.switchAccount();
  pending.resolve({ code: 401 });
  await result;
  assert.equal(f.uni.getStorageSync('token'), 'other-access');
  assert.equal(f.replayed.length, 0);
  assert.equal(f.logouts(), 0);
  assert.equal(f.prompts(), 0);
});

test('A new member can refresh independently while the old refresh is still pending', async () => {
  const pending = deferred();
  const f = await requestFixture(() => pending.promise);
  const old = assert.rejects(f.refreshToken(f.config()), (error) => error.staleSession === true);
  await flush();
  f.switchAccount();
  f.auth.refreshToken = async () => {
    f.uni.setStorageSync('token', 'other-refreshed');
    return { code: 0, data: { accessToken: 'other-refreshed' } };
  };
  await f.refreshToken(f.config());
  pending.resolve({ code: 401 });
  await old;
  assert.equal(f.uni.getStorageSync('token'), 'other-refreshed');
  assert.equal(f.replayed.length, 1);
  assert.equal(f.replayed[0].header.Authorization, 'other-refreshed');
  assert.equal(f.logouts(), 0);
});
