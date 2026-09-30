import request from '@/sheep/request';

const AuthUtil = {
  // 使用用户名 + 密码登录
  usernameLogin: (data) => {
    return request({
      url: '/member/auth/username-login',
      method: 'POST',
      data,
      custom: {
        showSuccess: true,
        loadingMsg: '登录中',
        successMsg: '登录成功',
      },
    });
  },
  // 使用用户名 + 密码注册
  register: (data) => {
    return request({
      url: '/member/auth/register',
      method: 'POST',
      data,
      custom: {
        showSuccess: true,
        loadingMsg: '注册中',
        successMsg: '注册成功',
      },
    });
  },
  // 获得滑块验证码
  getCaptcha: (data) => {
    return request({
      url: '/member/auth/captcha/get',
      method: 'POST',
      data,
      custom: {
        showLoading: false,
        showError: false,
        skipAuthRefresh: true,
      },
    });
  },
  // 校验滑块验证码
  checkCaptcha: (data) => {
    return request({
      url: '/member/auth/captcha/check',
      method: 'POST',
      data,
      custom: {
        showLoading: false,
        showError: false,
        skipAuthRefresh: true,
      },
    });
  },
  // 使用手机 + 密码登录
  login: (data) => {
    return request({
      url: '/member/auth/login',
      method: 'POST',
      data,
      custom: {
        showSuccess: true,
        loadingMsg: '登录中',
        successMsg: '登录成功',
      },
    });
  },
  // 使用手机 + 验证码登录
  smsLogin: (data) => {
    return request({
      url: '/member/auth/sms-login',
      method: 'POST',
      data,
      custom: {
        showSuccess: true,
        loadingMsg: '登录中',
        successMsg: '登录成功',
      },
    });
  },
  // 发送手机验证码
  sendSmsCode: (mobile, scene) => {
    return request({
      url: '/member/auth/send-sms-code',
      method: 'POST',
      data: {
        mobile,
        scene,
      },
      custom: {
        loadingMsg: '发送中',
        showSuccess: true,
        successMsg: '发送成功',
      },
    });
  },
  // 登出系统
  logout: () => {
    return request({
      url: '/member/auth/logout',
      method: 'POST',
    });
  },
  // 刷新令牌
  refreshToken: (refreshToken) => {
    return request({
      url: '/member/auth/refresh-token',
      method: 'POST',
      params: {
        refreshToken,
      },
      custom: {
        showLoading: false, // 不用加载中
        showError: false, // 不展示错误提示
        skipAuthRefresh: true,
      },
    });
  },
  // 社交授权的跳转
  socialAuthRedirect: (type, redirectUri) => {
    return request({
      url: '/member/auth/social-auth-redirect',
      method: 'GET',
      params: {
        type,
        redirectUri,
      },
      custom: {
        showSuccess: true,
        loadingMsg: '登陆中',
      },
    });
  },
  // 社交快捷登录
  socialLogin: (type, code, state, createUser = false) => {
    return request({
      url: '/member/auth/social-login',
      method: 'POST',
      data: {
        type,
        code,
        state,
        createUser,
      },
      custom: {
        showSuccess: false,
        loadingMsg: '登录中',
      },
    });
  },
  // 微信小程序的一键登录
  weixinMiniAppLogin: (phoneCode, loginCode, state) => {
    return request({
      url: '/member/auth/weixin-mini-app-login',
      method: 'POST',
      data: {
        phoneCode,
        loginCode,
        state,
      },
      custom: {
        showSuccess: true,
        loadingMsg: '登陆中',
        successMsg: '登录成功',
      },
    });
  },
  // 创建微信 JS SDK 初始化所需的签名
  createWeixinMpJsapiSignature: (url) => {
    return request({
      url: '/member/auth/create-weixin-jsapi-signature',
      method: 'POST',
      params: {
        url,
      },
      custom: {
        showError: false,
        showLoading: false,
      },
    });
  },
  //
};

export default AuthUtil;
