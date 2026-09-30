import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { Clock, loadModule, plain } from './helpers/runtime.mjs';

// 使用实际安装的微信 SDK，仅替换手机原生桥，覆盖 npm SDK 的参数变换与菜单事件。
async function nativeFixture(ios, failModern = false) {
  const calls = [], handlers = new Map(), diagnostics = new Map(), clock = new Clock();
  const location = { href: 'https://site.webto.cc/?spm=0.1.0.2.1' };
  const navigator = { userAgent: `${ios ? 'iPhone' : 'Android'} Mobile MicroMessenger/8.0.78`, platform: ios ? 'iPhone' : 'Linux armv8l' };
  const bridge = {
    on: (name, callback) => handlers.set(name, callback),
    invoke: (method, data, callback) => {
      calls.push({ method, data: plain(data) });
      if (method === 'checkJsApi') {
        const supported = Object.fromEntries(data.jsApiList.map((name) => [name, true]));
        callback({ err_msg: method + ':ok', checkResult: ios ? supported : JSON.stringify(supported) });
      } else {
        callback({ err_msg: method + (failModern && method === 'updateAppMessageShareData' ? ':permission denied' : ':ok') });
      }
    },
  };
  const document = { title: '娱果商城', addEventListener: () => {} };
  const window = { location, document, WeixinJSBridge: bridge };
  const module = { exports: {} };
  vm.runInNewContext(await readFile(new URL('../node_modules/weixin-js-sdk/index.js', import.meta.url), 'utf8'), {
    module, window, navigator, location, document, WeixinJSBridge: bridge, console, Image: class {},
    ...clock.globals(),
  });
  const { default: sdk } = await loadModule('sheep/libs/sdk-h5-weixin.js', {
    globals: { window, navigator, ...clock.globals() },
    mocks: {
      'weixin-js-sdk': { default: module.exports },
      '@/sheep/api/member/auth': { default: { createWeixinMpJsapiSignature: async () => ({
        code: 0, data: { appId: 'test-app', signature: 'test-signature', timestamp: 1, nonceStr: 'test-nonce' },
      }) } },
      './sdk-h5-weixin-debug': { shareDebug: (step, value) => diagnostics.set(step, value) },
    },
  });
  return { sdk, calls, handlers, diagnostics, clock, location };
}

for (const ios of [true, false]) {
  test(`${ios ? 'iOS' : 'Android'} native share menu sends a link card with current title, description and image`, async () => {
    const f = await nativeFixture(ios);
    const home = { title: '首页', desc: '娱果商城', image: 'https://site.webto.cc/static/share/yuguo-logo-edb98138.png', link: 'https://site.webto.cc/?spm=0.1.0.2.1' };
    assert.equal(await f.sdk.updateShareInfo(home), true);
    assert.equal(f.calls.filter((call) => call.method === 'sendAppMessage').length, 0, 'registration must not send a message');
    const declared = f.calls.find((call) => call.method === 'preVerifyJSAPI').data.verifyJsApiList;
    assert.ok(declared.includes('updateAppMessageShareData'));
    assert.ok(declared.includes('menu:share:appmessage'));
    assert.ok(declared.includes('menu:share:timeline'));
    f.handlers.get('menu:share:appmessage')({ err_msg: 'menu:share:appmessage:ok' });
    const sent = f.calls.filter((call) => call.method === 'sendAppMessage').at(-1).data;
    assert.equal(sent.type, 'link');
    assert.equal(sent.title, home.title);
    assert.equal(sent.desc, home.desc);
    assert.equal(sent.img_url, home.image);
    assert.equal(sent.link, home.link);
    const product = { title: '专辑商品名称', desc: '娱果商城商品分享', image: 'https://cdn.example/product.jpg', link: 'https://site.webto.cc/?spm=0.2.652.2.1' };
    f.location.href = 'https://site.webto.cc/pages/goods/index?id=652';
    await f.sdk.updateShareInfo(product);
    f.handlers.get('menu:share:appmessage')({});
    assert.equal(f.calls.filter((call) => call.method === 'sendAppMessage').at(-1).data.title, product.title);
    f.handlers.get('menu:share:timeline')({});
    assert.equal(f.calls.filter((call) => call.method === 'shareTimeline').at(-1).data.img_url, product.image);
    assert.equal(f.clock.timers.size, 0, 'menu registration never waits for the user to share');
    assert.equal(f.calls.filter((call) => call.method === 'preVerifyJSAPI').length, ios ? 1 : 2);
  });
}

test('Native permission failures stay visible and are not treated as success by legacy registration', async () => {
  const f = await nativeFixture(false, true);
  await assert.rejects(f.sdk.updateShareInfo({ title: '首页', desc: '娱果商城', image: 'https://site.webto.cc/logo.png', link: 'https://site.webto.cc/' }), /permission denied/);
  assert.match(f.diagnostics.get('updateAppMessageShareData'), /permission denied/);
});

test('Share diagnostics are opt-in, local only and redact URL queries', async () => {
  let created = 0;
  const document = { body: { appendChild: () => {} }, createElement: () => { created++; return { style: {}, appendChild: () => {} }; } };
  const off = await loadModule('sheep/libs/sdk-h5-weixin-debug.js', { globals: { window: { location: { search: '' } }, document } });
  off.shareDebug('分享', '测试');
  assert.equal(created, 0);
  const on = await loadModule('sheep/libs/sdk-h5-weixin-debug.js', { expose: ['results'], globals: { window: { location: { search: '?wechatShareDebug=1' } }, document } });
  on.shareDebug('签名页面', 'https://site.webto.cc/pages/index/login?code=private&state=private#secret');
  assert.equal(on.results['签名页面'], 'https://site.webto.cc/pages/index/login');
  assert.ok(created > 0);
});
