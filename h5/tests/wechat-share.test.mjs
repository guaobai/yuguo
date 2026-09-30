import test from 'node:test';
import assert from 'node:assert/strict';
import { loadModule, pageRuntime, plain } from './helpers/runtime.mjs';

const config = { h5Url: 'https://site.webto.cc/' };
const brand = await loadModule('sheep/config/brand.js', { mocks: { '@/sheep/config': config } });
const constants = await loadModule('sheep/util/const.js', { mocks: { dayjs: { default: () => {} } } });
const { forceHttps } = await loadModule('sheep/util/url.js');
const isEmpty = (value) => !value || Object.keys(value).length === 0;

async function shareFixture(platform = 'H5') {
  const page = { route: 'pages/index/category', options: {} }, updates = [], navigations = [];
  const app = {
    info: { name: '娱果传媒', logo: 'https://old.example/logo.png', cdnurl: 'https://cdn.example' },
    platform: { share: { methods: ['forward'], forwardInfo: {
      title: '旧标题', desc: '旧描述', image: 'https://old.example/share.png',
    } } },
  };
  const user = { isLogin: true, userInfo: { id: 27 } };
  const store = (name) => name === 'app' ? app : user;
  const { default: url } = await loadModule('sheep/url/index.js', { mocks: {
    '@/sheep/store': { default: store }, '@/sheep/config': { staticUrl: 'local' },
    '@/sheep/util/url': { forceHttps },
  } });
  const { default: share } = await loadModule('sheep/platform/share.js', {
    platform, globals: {
      getCurrentPages: () => [page],
      ROUTES_MAP: { '/pages/index/category': { meta: { title: '商品分类' } } },
    },
    mocks: {
      '@/sheep/config': config, '@/sheep/config/brand': { ...brand },
      '@/sheep/store': { default: store }, '@/sheep/url': { default: url },
      '@/sheep/platform': { default: { name: platform === 'H5' ? 'WechatOfficialAccount' : 'WechatMiniProgram' } },
      '@/sheep/router': { default: { go: (...args) => navigations.push(args) } },
      '@/sheep/api/trade/brokerage': { default: {} }, '@/sheep/util/const': { ...constants },
      '@/sheep/libs/sdk-h5-weixin': { default: { updateShareInfo: (data) => updates.push(plain(data)) } },
    },
  });
  return { share, page, updates, navigations, url, store };
}

for (const platform of ['H5', 'MP-WEIXIN']) {
  test(`${platform}: page shares use the current name and supplied logo even with old persisted settings`, async () => {
    const f = await shareFixture(platform);
    const data = f.share.getShareInfo();
    assert.equal(data.title, '商品分类');
    assert.equal(data.image, 'https://site.webto.cc/static/share/yuguo-logo-edb98138.png');
    assert.equal(data.desc, '娱果商城');
    assert.equal(f.share.getShareInfo({ title: '首页' }).title, '首页');
    assert.equal(f.share.getShareInfo({ title: '专辑专区' }).title, '专辑专区');
    f.page.route = 'pages/unknown';
    assert.equal(f.share.getShareInfo().title, '娱果商城');
  });

  test(`${platform}: layout forwards dynamic page titles and preserves custom product shares`, async () => {
    const f = await shareFixture(platform), runtime = pageRuntime(), callbacks = {};
    const props = { title: '首页', onShareAppMessage: true };
    let mounted, changed;
    const module = await loadModule('sheep/components/s-layout/s-layout.vue', {
      platform, expose: ['shareInfo'], globals: {
        defineProps: () => props, defineEmits: () => () => {},
        uni: { hideShareMenu: () => {}, showShareMenu: () => {} },
      },
      mocks: {
        vue: { ...runtime.vue, onMounted: (fn) => { mounted = fn; }, watch: (getter, fn) => { changed = fn; } },
        '@dcloudio/uni-app': { ...runtime.lifecycle,
          onShareAppMessage: (fn) => { callbacks.friend = fn; }, onShareTimeline: (fn) => { callbacks.timeline = fn; } },
        'lodash-es': { isEmpty },
        '@/sheep': { default: { $store: f.store, $platform: { share: f.share } } },
      },
    });
    mounted();
    assert.equal(module.shareInfo.value.title, '首页');
    props.title = '新上架专区'; changed();
    assert.equal(module.shareInfo.value.title, '新上架专区');
    assert.equal(module.shareInfo.value.image, brand.SHARE_LOGO);
    if (platform === 'H5') assert.equal(f.updates.at(-1).title, '新上架专区');
    else assert.equal(callbacks.friend().title, '新上架专区');
    props.onShareAppMessage = { title: '商品标题', image: 'https://cdn.example/goods.png', forward: { path: 'pages/index/index?spm=0.2.652.3.1' } };
    changed();
    assert.equal(module.shareInfo.value.title, '商品标题');
    assert.equal(module.shareInfo.value.image, 'https://cdn.example/goods.png');
    if (platform === 'MP-WEIXIN') assert.equal(callbacks.friend().path, props.onShareAppMessage.forward.path);
  });

  for (const [file, kind] of [['index', 'GOODS'], ['groupon', 'GROUPON'], ['seckill', 'SECKILL'], ['point', 'POINT']]) {
    test(`${platform}: ${kind} shares the product title/main image and retains the correct destination`, async () => {
      const f = await shareFixture(platform), runtime = pageRuntime();
      const mocks = {
        vue: { ...runtime.vue, toRaw: (v) => v, unref: (v) => v?.value },
        '@dcloudio/uni-app': { ...runtime.lifecycle, onPageScroll: () => {} },
        '@/sheep': { default: { $url: f.url, $store: f.store, $platform: { share: f.share } } },
        'lodash-es': { isEmpty, min: (v) => Math.min(...v) },
        '@/sheep/util/const': { ...constants },
        '@/sheep/hooks/useGoods': {
          fen2yuan: (v) => v / 100, fen2yuanSimple: () => {}, formatExchange: () => {},
          formatSales: () => {}, formatGoodsSwiper: () => {}, useDurationTime: () => {},
          formatDiscountPercent: () => {}, getRewardActivityRuleItemDescriptions: () => {},
        },
      };
      for (const name of ['detail-navbar', 'detail-cell-sku', 'detail-tabbar', 'detail-skeleton',
        'detail-comment-card', 'detail-content-card', 'detail-activity-tip', 'detail-progress']) {
        mocks[`./components/detail/${name}.vue`] = { default: {} };
      }
      for (const path of ['./components/groupon/groupon-card-list.vue', '@/sheep/components/countDown/index.vue',
        '@/sheep/api/product/spu', '@/sheep/api/product/favorite', '@/sheep/api/trade/order',
        ...['coupon', 'activity', 'rewardActivity', 'combination', 'point', 'seckill'].map((v) => '@/sheep/api/promotion/' + v)]) {
        mocks[path] = { default: {} };
      }
      const module = await loadModule(`pages/goods/${file}.vue`, {
        platform, mocks, expose: ['state', 'shareInfo', ...(['point', 'seckill'].includes(file) ? ['activity'] : [])],
      });
      assert.deepEqual(plain(module.shareInfo.value), {});
      const activity = { id: 71, name: '活动名称不应覆盖商品名称', point: 20, price: 500 };
      if (file === 'groupon') module.state.activity = activity;
      else if (module.activity) module.activity.value = activity;
      assert.deepEqual(plain(module.shareInfo.value), {}, 'do not publish incomplete activity data before product arrives');
      module.state.goodsInfo = { id: 652, name: '官方专辑 · 商品标题', picUrl: 'http://cdn.example/main.png',
        introduction: '全新正版，现货发售', price: 8000, marketPrice: 9000 };
      const data = module.shareInfo.value;
      assert.equal(data.title, '官方专辑 · 商品标题');
      assert.equal(data.image, 'https://cdn.example/main.png');
      assert.equal(data.desc, '娱果商城 · 全新正版，现货发售');
      assert.equal(data.poster.title, data.title);
      const id = file === 'index' ? '652' : '71';
      const suffix = `27.${constants.SharePageEnum[kind].value}.${id}.${platform === 'H5' ? '2' : '3'}.1`;
      assert.equal(new URL(data.link).searchParams.get('spm'), suffix);
      assert.equal(data.forward.path, `pages/index/index?spm=${suffix}`);
      const destination = await f.share.decryptSpm(suffix.replace(/^27\./, '0.'), false);
      assert.equal(destination.page, constants.SharePageEnum[kind].page);
      assert.equal(destination.query.id, id);
      module.state.goodsInfo.introduction = '';
      assert.equal(module.shareInfo.value.desc, '娱果商城商品分享');
    });
  }
}
