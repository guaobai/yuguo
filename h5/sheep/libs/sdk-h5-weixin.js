import jweixin from 'weixin-js-sdk';
import AuthUtil from '@/sheep/api/member/auth';
import { shareDebug } from './sdk-h5-weixin-debug';

// iOS 微信校验首次进入 WebView 的地址；Android 使用当前地址。两者均保留 query。
const entryUrl = window.location.href.split('#')[0];
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let readyUrl = '';
let signature;
let initializing;
let generation = 0;
let shareGeneration = 0;
let sharing = Promise.resolve();

const apiList = [
  'checkJsApi', 'chooseWXPay', 'openAddress', 'openLocation', 'getLocation',
  'updateAppMessageShareData', 'updateTimelineShareData', 'scanQRCode', 'chooseImage',
  'onMenuShareAppMessage', 'onMenuShareTimeline',
];
const asError = (error, fallback = '微信功能暂时不可用，请重试') =>
  Object.assign(new Error(error?.errMsg || error?.message || fallback), {
    errMsg: error?.errMsg || error?.message || fallback,
  });

function isWechat() {
  return /micromessenger/i.test(navigator.userAgent);
}

async function init(callback, force = false) {
  if (!isWechat()) throw asError(null, '请在微信中打开此页面');
  const url = isIOS ? entryUrl : window.location.href.split('#')[0];
  shareDebug('环境', isIOS ? 'iOS 微信' : 'Android / 其他微信');
  shareDebug('签名页面', url);
  // SDK 配置是全局的，路由切换时先等前一次配置结束，再判断是否需要重签。
  if (initializing) {
    await initializing;
    return init(callback, force);
  }
  if (!force && readyUrl === url) {
    callback?.(signature);
    return signature;
  }
  const current = ++generation;
  initializing = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, data) => {
      if (settled || current !== generation) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        readyUrl = '';
        shareDebug('初始化', asError(error).message);
        reject(asError(error));
      } else {
        readyUrl = url;
        signature = data;
        shareDebug('初始化', '成功；AppID ' + data.appId);
        resolve(data);
      }
    };
    const timer = setTimeout(() => finish(asError(null, '微信功能初始化超时，请重试')), 12000);
    jweixin.error((error) => {
      if (current !== generation) return;
      readyUrl = '';
      shareDebug('配置错误', asError(error).message);
      finish(error);
    });
    AuthUtil.createWeixinMpJsapiSignature(url).then((response) => {
      if (settled || current !== generation) return;
      if (response?.code !== 0 || !response.data?.signature) {
        finish(asError(null, response?.msg || '获取微信功能配置失败，请稍后重试'));
        return;
      }
      const data = response.data;
      try {
        jweixin.config({
          debug: false,
          appId: data.appId,
          timestamp: data.timestamp,
          nonceStr: data.nonceStr,
          signature: data.signature,
          // 官方 SDK 会原地替换接口别名，传副本以保留后续检查使用的公开接口名称。
          jsApiList: [...apiList],
          openTagList: data.openTagList || [],
        });
        jweixin.ready(() => {
          if (settled || current !== generation) return;
          // SDK 在第二次 config 时可能立即触发 ready，再实际调用一次桥接接口确认可用。
          try {
            jweixin.checkJsApi({
              jsApiList: [...apiList],
              success: (result) => {
                const support = result?.checkResult || {};
                shareDebug('接口支持', ['updateAppMessageShareData', 'onMenuShareAppMessage'].map((name) => `${name}=${support[name] ?? '未知'}`).join('\n'));
                finish(null, data);
              },
              fail: finish,
            });
          } catch (error) { finish(error); }
        });
      } catch (error) {
        finish(error);
      }
    }).catch(finish);
  });
  try {
    const data = await initializing;
    callback?.(data);
    return data;
  } finally {
    initializing = undefined;
  }
}

// 同时兼容 Promise 和旧回调调用者，初始化失败、取消、超时都会结束操作。
function invoke(method, data = {}, callbacks = {}, timeoutMs = 20000) {
  if (typeof callbacks === 'function') callbacks = { success: callbacks };
  const promise = new Promise((resolve, reject) => {
    let finished = false;
    let timer;
    const finish = (kind, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      try {
        if (kind === 'success') {
          callbacks.success?.(result);
          resolve(result);
        } else {
          const error = asError(result);
          if (kind === 'cancel') error.cancelled = true;
          (callbacks[kind] || callbacks.fail)?.(error);
          if (callbacks.error !== callbacks.fail) callbacks.error?.(error);
          reject(error);
        }
      } catch (error) {
        reject(error);
      } finally {
        callbacks.complete?.(result);
      }
    };
    init().then(() => {
      if (typeof jweixin[method] !== 'function') {
        finish('fail', asError(null, '当前微信版本不支持此功能，请升级微信'));
        return;
      }
      timer = setTimeout(() => finish('fail', asError(null, '微信操作超时，请重试')), timeoutMs);
      jweixin[method]({
        ...data,
        success: (result) => finish('success', result),
        cancel: (result) => finish('cancel', result),
        fail: (error) => finish(/cancel/i.test(error?.errMsg || '') ? 'cancel' : 'fail', error),
      });
    }).catch((error) => finish('fail', error));
  });
  // 仅使用回调的调用者也不会产生未处理的 Promise rejection。
  promise.catch(() => {});
  return promise;
}

// 保留新版预设接口，同时兼容通过 menu:share 事件取分享信息的原生转发入口。
// 旧接口的回调发生在实际分享时，注册时不能等待它，否则会一直阻塞页面更新。
function registerShareMenu(data, current) {
  for (const method of ['onMenuShareAppMessage', 'onMenuShareTimeline']) {
    if (typeof jweixin[method] !== 'function') continue;
    try {
      jweixin[method]({
        ...data,
        type: 'link',
        trigger: () => {
          if (current === shareGeneration) shareDebug('菜单事件', method);
        },
        success: () => {
          if (current === shareGeneration) shareDebug('菜单返回', method + ':ok');
        },
        cancel: () => {
          if (current === shareGeneration) shareDebug('菜单返回', method + ':cancel');
        },
        fail: (error) => {
          if (current === shareGeneration) shareDebug('菜单返回', asError(error).message);
        },
      });
      shareDebug(method, '已注册，等待点击转发');
    } catch (error) {
      // 兼容接口不可用不能覆盖新版接口的结果。
      shareDebug(method, asError(error).message);
    }
  }
}

export default {
  isWechat,
  init,
  isReady(api, fail) {
    return init().then(api).catch((error) => fail?.(error));
  },
  getLocation(callbacks) {
    return invoke('getLocation', { type: 'gcj02' }, callbacks);
  },
  openAddress(callbacks) {
    return invoke('openAddress', {}, callbacks);
  },
  scanQRCode(callbacks) {
    return invoke('scanQRCode', { needResult: 1, scanType: ['qrCode', 'barCode'] }, callbacks);
  },
  updateShareInfo(data, callback) {
    const current = ++shareGeneration;
    const operation = sharing.catch(() => {}).then(async () => {
      await init();
      if (current !== shareGeneration) return false;
      const shareData = { title: data.title, desc: data.desc, link: data.link, imgUrl: data.image };
      shareDebug('分享标题', shareData.title);
      shareDebug('分享图片', shareData.imgUrl);
      shareDebug('分享链接', shareData.link);
      registerShareMenu(shareData, current);
      await Promise.all([
        ...['updateAppMessageShareData', 'updateTimelineShareData'].map(async (method) => {
          try {
            await invoke(method, shareData);
            if (current === shareGeneration) shareDebug(method, '设置成功');
          } catch (error) {
            if (current === shareGeneration) shareDebug(method, asError(error).message);
            throw error;
          }
        }),
      ]);
      if (current !== shareGeneration) return false;
      // 这里只表示分享内容设置成功，不能据此统计用户已经分享。
      callback?.();
      return true;
    });
    sharing = operation;
    return operation;
  },
  openLocation(data, callbacks) {
    return invoke('openLocation', data, callbacks);
  },
  chooseImage(callbacks) {
    return invoke('chooseImage', { count: 1, sizeType: ['compressed'], sourceType: ['album'] }, callbacks);
  },
  wxpay(data, callbacks) {
    return invoke('chooseWXPay', {
      timestamp: data.timeStamp || data.timestamp,
      nonceStr: data.nonceStr,
      package: data.packageValue || data.package,
      signType: data.signType,
      paySign: data.paySign,
    }, callbacks, 120000);
  },
};
