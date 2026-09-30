import $wxsdk from '@/sheep/libs/sdk-h5-weixin';
import { getRootUrl } from '@/sheep/helper';
import AuthUtil from '@/sheep/api/member/auth';
import SocialApi from '@/sheep/api/member/social';

const socialType = 31;
const flowKey = 'wechat-oauth-flow';
const returnKey = 'wechat-oauth-return';

async function load() {
  try {
    await $wxsdk.init();
  } catch (error) {
    // 页面仍可浏览，用户操作时会重试并给出对应的失败反馈。
    console.warn('[wechat] ' + error.message);
  }
}

function safeReturnUrl(value) {
  const fallback = getRootUrl();
  try {
    const target = new URL(value || fallback, location.origin);
    if (target.origin !== location.origin || target.pathname.includes('/pages/index/login')) {
      return fallback;
    }
    return target.href;
  } catch {
    return fallback;
  }
}

function getReturnUrl() {
  return safeReturnUrl(sessionStorage.getItem(returnKey));
}

async function startOAuth(event, returnUrl) {
  const page = getRootUrl() + 'pages/index/login?event=' + event;
  const response = await AuthUtil.socialAuthRedirect(socialType, page);
  if (response?.code !== 0 || !response.data) {
    throw new Error(response?.msg || '暂时无法打开微信授权，请重试');
  }
  const target = new URL(response.data);
  const state = target.searchParams.get('state');
  if (!state || target.origin !== 'https://open.weixin.qq.com') {
    throw new Error('微信授权地址无效，请联系客服');
  }
  sessionStorage.setItem(returnKey, safeReturnUrl(returnUrl || location.href));
  sessionStorage.setItem(flowKey, JSON.stringify({ event, state, createdAt: Date.now() }));
  window.location.assign(target.href);
  return { redirecting: true };
}

// 先校验本次授权的 state，再立即消费。刷新、取消和重复回调不会循环发起 OAuth。
function consumeOAuth(options) {
  let flow;
  try {
    flow = JSON.parse(sessionStorage.getItem(flowKey) || 'null');
  } catch {
    flow = null;
  }
  sessionStorage.removeItem(flowKey);
  if (!flow || !['login', 'bind', 'register'].includes(flow.event) ||
      flow.state !== options.state || flow.event !== options.event ||
      !Number.isFinite(flow.createdAt) || Date.now() < flow.createdAt ||
      Date.now() - flow.createdAt > 10 * 60 * 1000) {
    throw new Error('微信授权已失效，请重新登录');
  }
  if (!options.code) throw new Error('未完成微信授权，可重试或使用账号密码登录');
  return flow;
}

async function login(code = '', state = '', createUser = false) {
  if (!code) return startOAuth('login');
  const response = await AuthUtil.socialLogin(socialType, code, state, createUser);
  if (response?.code !== 0) throw new Error(response?.msg || '微信登录失败，请重新授权');
  return response;
}

async function register() {
  return startOAuth('register', getReturnUrl());
}

async function bind(code = '', state = '', returnUrl) {
  if (!uni.getStorageSync('token')) throw new Error('请先登录需要关联的会员账号');
  if (!code) return startOAuth('bind', returnUrl);
  const response = await SocialApi.socialBind(socialType, code, state);
  if (response?.code !== 0) throw new Error(response?.msg || '微信关联失败，请重试');
  uni.removeStorageSync('openid');
  return response;
}

async function unbind(openid) {
  const { code } = await SocialApi.socialUnbind(socialType, openid);
  if (code === 0) uni.removeStorageSync('openid');
  return code === 0;
}

async function getInfo() {
  const response = await SocialApi.getSocialUser(socialType);
  if (response?.code !== 0) throw new Error(response?.msg || '微信绑定信息获取失败');
  return response.data;
}

// 不缓存 OpenID；每次支付都从当前登录账号的公众号绑定读取。
async function getOpenid() {
  uni.removeStorageSync('openid');
  return (await getInfo())?.openid || '';
}

export default {
  load, login, register, bind, unbind, getInfo, getOpenid,
  consumeOAuth, getReturnUrl, startOAuth, safeReturnUrl,
  jsWxSdk: $wxsdk,
};
