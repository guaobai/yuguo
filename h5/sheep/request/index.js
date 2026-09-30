/**
 * Shopro-request
 * @description api模块管理，loading配置，请求拦截，错误处理
 */

import Request from 'luch-request';
import { apiPath, baseUrl, tenantId } from '@/sheep/config';
import $store from '@/sheep/store';
import $platform from '@/sheep/platform';
import { showAuthModal } from '@/sheep/hooks/useModal';
import AuthUtil from '@/sheep/api/member/auth';
import { getTerminal } from '@/sheep/util/const';
import { normalizeImageUrls } from '@/sheep/util/url';

const options = {
  // 显示操作成功消息 默认不显示
  showSuccess: false,
  // 成功提醒 默认使用后端返回值
  successMsg: '',
  // 显示失败消息 默认显示
  showError: true,
  // 失败提醒 默认使用后端返回信息
  errorMsg: '',
  // 显示请求时loading模态框 默认显示
  showLoading: true,
  // loading提醒文字
  loadingMsg: '加载中',
  // 需要授权才能请求 默认放开
  auth: false,
  // 公开接口返回 401 时，不触发刷新令牌或打开登录弹窗
  skipAuthRefresh: false,
  // ...
};

// Loading全局实例
let LoadingInstance = {
  target: null,
  count: 0,
};

/**
 * 关闭loading
 */
function closeLoading() {
  if (LoadingInstance.count > 0) LoadingInstance.count--;
  if (LoadingInstance.count === 0) uni.hideLoading();
}

const getSessionVersion = () => $store('user').getSessionVersion();
const isCurrentSession = (config) => config.custom.authSession === undefined ||
  config.custom.authSession === getSessionVersion();
const sessionChanged = () => ({ code: 401, msg: '登录账号已切换，请重新操作', staleSession: true });

/**
 * @description 请求基础配置 可直接使用访问自定义请求
 */
const http = new Request({
  baseURL: baseUrl + apiPath,
  timeout: 8000,
  method: 'GET',
  header: {
    Accept: 'text/json',
    'Content-Type': 'application/json;charset=UTF-8',
    platform: $platform.name,
  },
  // #ifdef APP-PLUS
  sslVerify: false,
  // #endif
  // #ifdef H5
  // 跨域请求时是否携带凭证（cookies）仅H5支持（HBuilderX 2.6.15+）
  withCredentials: false,
  // #endif
  custom: options,
});

/**
 * @description 请求拦截器
 */
http.interceptors.request.use(
  (config) => {
    // 保留重试请求原来的会话，不能将旧账号的操作改用新账号提交。
    if (!isCurrentSession(config)) return Promise.reject(sessionChanged());
    config.custom.authSession = getSessionVersion();

    // 自定义处理【auth 授权】：必须登录的接口，则跳出 AuthModal 登录弹窗
    if (config.custom.auth && !$store('user').isLogin) {
      showAuthModal();
      return Promise.reject();
    }

    // 自定义处理【loading 加载中】：如果需要显示 loading，则显示 loading
    if (config.custom.showLoading) {
      LoadingInstance.count++;
      LoadingInstance.count === 1 &&
        uni.showLoading({
          title: config.custom.loadingMsg,
          mask: true,
          fail: () => {
            uni.hideLoading();
          },
        });
    }

    // 增加 token 令牌、terminal 终端、tenant 租户的请求头
    const token = getAccessToken();
    if (token) {
      config.header['Authorization'] = token;
    }
    config.header['terminal'] = getTerminal();

    config.header['Accept'] = '*/*';
    config.header['tenant-id'] = tenantId;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * @description 响应拦截器
 */
http.interceptors.response.use(
  async (response) => {
    response.config.custom.showLoading && closeLoading();
    // 包括刷新令牌响应：退出或切换账号后，旧请求不得重新登录旧会员。
    if (!isCurrentSession(response.config)) return Promise.reject(sessionChanged());
    normalizeImageUrls(response.data);

    // 约定：如果是 /auth/ 下的 URL 地址，并且返回了 accessToken 说明是登录相关的接口，则自动设置登陆令牌
    if (response.config.url.indexOf('/member/auth/') >= 0 && response.data?.data?.accessToken) {
      await $store('user').setToken(
        response.data.data.accessToken,
        response.data.data.refreshToken,
        response.config.url.includes('/member/auth/refresh-token'),
      );
    }

    // 自定义处理【error 错误提示】：如果需要显示错误提示，则显示错误提示
    if (response.data.code !== 0) {
      // 特殊：如果 401 错误码，则跳转到登录页 or 刷新令牌
      if (response.data.code === 401) {
        if (response.config.custom.skipAuthRefresh) {
          return Promise.resolve(response.data);
        }
        return refreshToken(response.config);
      }
      // 特殊：处理分销用户绑定失败的提示
      if ((response.data.code + '').includes('1011007')) {
        console.error(`分销用户绑定失败，原因：${response.data.msg}`);
      } else if (response.config.custom.showError) {
        // 错误提示
        uni.showToast({
          title: response.data.msg || '服务器开小差啦,请稍后再试~',
          icon: 'none',
          mask: true,
        });
      }
    }

    // 自定义处理【showSuccess 成功提示】：如果需要显示成功提示，则显示成功提示
    if (
      response.config.custom.showSuccess &&
      response.config.custom.successMsg !== '' &&
      response.data.code === 0
    ) {
      uni.showToast({
        title: response.config.custom.successMsg,
        icon: 'none',
      });
    }

    // 返回结果：包括 code + data + msg
    return Promise.resolve(response.data);
  },
  (error) => {
    if (error?.config && !isCurrentSession(error.config)) {
      error.config.custom.showLoading && closeLoading();
      return Promise.reject(sessionChanged());
    }
    const userStore = $store('user');
    const isLogin = userStore.isLogin;
    let errorMessage = '网络请求出错';
    if (error !== undefined) {
      switch (error.statusCode) {
        case 400:
          errorMessage = '请求错误';
          break;
        case 401:
          errorMessage = isLogin ? '您的登陆已过期' : '请先登录';
          // 正常情况下，后端不会返回 401 错误，所以这里不处理 handleAuthorized
          break;
        case 403:
          errorMessage = '拒绝访问';
          break;
        case 404:
          errorMessage = '请求出错';
          break;
        case 408:
          errorMessage = '请求超时';
          break;
        case 429:
          errorMessage = '请求频繁, 请稍后再访问';
          break;
        case 500:
          errorMessage = '服务器开小差啦,请稍后再试~';
          break;
        case 501:
          errorMessage = '服务未实现';
          break;
        case 502:
          errorMessage = '网络错误';
          break;
        case 503:
          errorMessage = '服务不可用';
          break;
        case 504:
          errorMessage = '网络超时';
          break;
        case 505:
          errorMessage = 'HTTP 版本不受支持';
          break;
      }
      if (error.errMsg?.includes('timeout')) errorMessage = '请求超时';
      // #ifdef H5
      if (error.errMsg?.includes('Network'))
        errorMessage = window.navigator.onLine ? '服务器异常' : '请检查您的网络连接';
      // #endif
    }

    if (error && error.config?.custom?.skipAuthRefresh) {
      error.config.custom.showLoading && closeLoading();
      return Promise.resolve(
        error.data || {
          code: error.statusCode || 500,
          data: null,
          msg: errorMessage,
        },
      );
    }

    if (error && error.config) {
      if (error.config.custom.showError !== false) {
        uni.showToast({
          title: error.data?.msg || errorMessage,
          icon: 'none',
          mask: true,
        });
      }
      error.config.custom.showLoading && closeLoading();
    }

    return false;
  },
);

// 并发的 401 共用一次刷新；失败时全部结束，后续请求仍可重新登录。
let refreshingToken;
let refreshSession;
const refreshToken = async (config) => {
  if (!isCurrentSession(config)) throw sessionChanged();
  const session = getSessionVersion();
  if (config.url.includes('/member/auth/refresh-token') || config.custom.authRetried) {
    return handleAuthorized();
  }
  // 某些旧请求较晚才返回 401，此时直接使用已经刷新的凭据重试一次。
  const sentToken = (config.header.Authorization || '').replace(/^Bearer\s+/i, '');
  if (!getAccessToken() || sentToken === getAccessToken()) {
    if (!refreshingToken || refreshSession !== session) {
      refreshSession = session;
      const currentRefresh = Promise.resolve().then(async () => {
        if (session !== getSessionVersion()) throw sessionChanged();
        const token = getRefreshToken();
        if (!token) throw new Error('未登录');
        const result = await AuthUtil.refreshToken(token);
        if (result?.code !== 0 || !result.data?.accessToken) throw new Error('刷新令牌失败');
      }).catch(() => {
        if (session !== getSessionVersion()) throw sessionChanged();
        return handleAuthorized();
      }).finally(() => {
        if (refreshingToken === currentRefresh) refreshingToken = undefined;
      });
      refreshingToken = currentRefresh;
    }
    await refreshingToken;
  }
  if (session !== getSessionVersion()) throw sessionChanged();
  config.custom.authRetried = true;
  config.header.Authorization = getAccessToken();
  return request(config);
};

/**
 * 处理 401 未登录的错误
 */
const handleAuthorized = () => {
  const userStore = $store('user');
  const wasLoggedIn = userStore.isLogin;
  userStore.logout(true);
  showAuthModal();
  // 登录超时
  return Promise.reject({
    code: 401,
    msg: wasLoggedIn ? '您的登陆已过期' : '请先登录',
  });
};

/** 获得访问令牌 */
export const getAccessToken = () => {
  return uni.getStorageSync('token');
};

/** 获得刷新令牌 */
export const getRefreshToken = () => {
  return uni.getStorageSync('refresh-token');
};

const request = (config) => {
  return http.middleware(config);
};

export default request;
