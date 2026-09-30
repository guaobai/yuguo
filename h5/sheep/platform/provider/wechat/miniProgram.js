import AuthUtil from '@/sheep/api/member/auth';
import SocialApi from '@/sheep/api/member/social';
import UserApi from '@/sheep/api/member/user';

const socialType = 34; // 社交类型 - 微信小程序

let subscribeEventList = [];

// 加载微信小程序
function load() {
  checkUpdate();
  getSubscribeTemplate().catch(() => { subscribeEventList = []; });
}

// 微信小程序静默授权登陆
const login = async () => {
  try {
    const codeResult = await uni.login();
    if (codeResult.errMsg !== 'login:ok') {
      return false;
    }

    // 2. 社交登录
    const loginResult = await AuthUtil.socialLogin(socialType, codeResult.code, 'default');
    if (loginResult.code === 0) {
      clearLegacyOpenid();
      return true;
    } else {
      return false;
    }
  } catch {
    uni.showToast({ title: '微信登录失败，请重试', icon: 'none' });
    return false;
  }
};

// 微信小程序手机号授权登陆
const mobileLogin = async (e) => {
  try {
    if (e.errMsg !== 'getPhoneNumber:ok') {
      return false;
    }

    // 1. 获得微信 code
    const codeResult = await uni.login();
    if (codeResult.errMsg !== 'login:ok') {
      return false;
    }

    // 2. 一键登录
    const loginResult = await AuthUtil.weixinMiniAppLogin(e.code, codeResult.code, 'default');
    if (loginResult.code === 0) {
      clearLegacyOpenid();
      return true;
    } else {
      return false;
    }
  } catch {
    uni.showToast({ title: '微信登录失败，请重试', icon: 'none' });
    return false;
  }
};

// 微信小程序绑定
const bind = async () => {
  try {
    // 1. 获得微信 code
    const codeResult = await uni.login();
    if (codeResult.errMsg !== 'login:ok') {
      return false;
    }

    // 2. 绑定账号
    const bindResult = await SocialApi.socialBind(socialType, codeResult.code, 'default');
    if (bindResult.code === 0) {
      clearLegacyOpenid();
      return true;
    } else {
      return false;
    }
  } catch {
    uni.showToast({ title: '微信绑定失败，请重试', icon: 'none' });
    return false;
  }
};

// 微信小程序解除绑定
const unbind = async (openid) => {
  const { code } = await SocialApi.socialUnbind(socialType, openid);
  if (code === 0) uni.removeStorageSync('openid');
  return code === 0;
};

// 绑定用户手机号
const bindUserPhoneNumber = async (e) => {
  if (!e.code) return false;
  const { code } = await UserApi.updateUserMobileByWeixin(e.code);
  return code === 0;
};

// 清理旧版本缓存，支付改用当前会员的服务端绑定。
function clearLegacyOpenid() {
  uni.removeStorageSync('openid');
}

// 获得 openid
async function getOpenid() {
  uni.removeStorageSync('openid');
  const info = await getInfo();
  return info?.openid || '';
}

// 获得社交信息
async function getInfo() {
  const { code, data } = await SocialApi.getSocialUser(socialType);
  if (code !== 0) {
    throw new Error('微信绑定信息获取失败，请重试');
  }
  return data;
}

// ========== 非登录相关的逻辑 ==========

// 小程序更新
const checkUpdate = async (silence = true) => {
  if (uni.canIUse('getUpdateManager')) {
    const updateManager = uni.getUpdateManager();
    updateManager.onCheckForUpdate(function(res) {
      // 请求完新版本信息的回调
      if (res.hasUpdate) {
        updateManager.onUpdateReady(function() {
          uni.showModal({
            title: '更新提示',
            content: '新版本已经准备好，是否重启应用？',
            success: function(res) {
              if (res.confirm) {
                // 新的版本已经下载好，调用 applyUpdate 应用新版本并重启
                updateManager.applyUpdate();
              }
            },
          });
        });
        updateManager.onUpdateFailed(function() {
          // 新的版本下载失败
          // uni.showModal({
          //   title: '已经有新版本了哟~',
          //   content: '新版本已经上线啦，请您删除当前小程序，重新搜索打开~',
          // });
        });
      } else {
        if (!silence) {
          uni.showModal({
            title: '当前为最新版本',
            showCancel: false,
          });
        }
      }
    });
  }
};

// 获取订阅消息模板
async function getSubscribeTemplate() {
  const { code, data } = await SocialApi.getSubscribeTemplateList();
  if (code === 0) {
    subscribeEventList = Array.isArray(data) ? data : [];
  }
}

// 每个模板独立返回 accept / reject / ban / filter，调用成功不代表接受订阅。
function subscribeMessage(event, callback) {
  const events = Array.isArray(event) ? event : [event];
  const missing = [];
  const ids = events.map((name) => {
    const template = subscribeEventList.find((item) => item.title?.includes(name));
    if (!template) missing.push(name);
    return template?.id;
  }).filter(Boolean);
  const tmplIds = [...new Set(ids)].slice(0, 3);
  const result = { requested: tmplIds, accepted: [], rejected: [], blocked: [], filtered: [], missing };
  return new Promise((resolve) => {
    let settled = false;
    let timer;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
      callback?.(value);
    };
    if (!tmplIds.length) {
      finish({ ...result, error: '暂时无法订阅，请稍后重试' });
      return;
    }
    timer = setTimeout(() => finish({ ...result, error: '订阅操作超时，请重试' }), 60000);
    try { uni.requestSubscribeMessage({
      tmplIds,
      success: (response) => {
        result.accepted = tmplIds.filter((id) => response[id] === 'accept');
        result.rejected = tmplIds.filter((id) => response[id] === 'reject');
        result.blocked = tmplIds.filter((id) => response[id] === 'ban');
        result.filtered = tmplIds.filter((id) => response[id] === 'filter');
        finish(result);
      },
      fail: (error) => finish({ ...result, error: error.errMsg || '订阅失败，请稍后重试' }),
    }); } catch (error) {
      finish({ ...result, error: error.errMsg || error.message || '订阅失败，请稍后重试' });
    }
  });
}

export default {
  load,
  login,
  bind,
  unbind,
  bindUserPhoneNumber,
  mobileLogin,
  getInfo,
  getOpenid,
  subscribeMessage,
  checkUpdate,
};
