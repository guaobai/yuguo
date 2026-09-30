<!-- 微信公众号授权回调 -->
<template>
  <s-layout title="微信登录" :onShareAppMessage="false">
    <view class="oauth-box">
      <view class="oauth-title">{{ title }}</view>
      <view class="oauth-message">{{ state.message }}</view>
      <template v-if="state.phase === 'choose'">
        <button class="oauth-primary" @tap="useExistingAccount">关联已有账号</button>
        <button @tap="registerWechat">首次使用，注册新会员</button>
        <view class="oauth-tip">已有订单、余额或小程序会员，请关联原账号，保留原会员资料。</view>
      </template>
      <template v-if="state.phase === 'bind'">
        <view class="oauth-tip">将微信关联到当前会员：{{ user.userInfo.nickname || user.userInfo.username || user.userInfo.id }}</view>
        <button class="oauth-primary" @tap="bindAccount">确认关联当前账号</button>
      </template>
      <template v-if="['error', 'account'].includes(state.phase)">
        <button v-if="state.phase === 'error' && canWechatLogin" class="oauth-primary" @tap="retry">重新微信授权</button>
        <button @tap="passwordLogin">账号密码登录</button>
      </template>
      <button v-if="state.phase !== 'working'" @tap="goBack">返回商城</button>
    </view>
  </s-layout>
</template>

<script setup>
  import { computed, reactive, watch } from 'vue';
  import { onLoad } from '@dcloudio/uni-app';
  import sheep from '@/sheep';
  import { showAuthModal, closeAuthModal } from '@/sheep/hooks/useModal';
  import { getRootUrl } from '@/sheep/helper';

  const user = sheep.$store('user');
  const canWechatLogin = sheep.$platform.name === 'WechatOfficialAccount';
  const state = reactive({ phase: 'working', message: '正在确认微信授权…', event: 'login', linkExisting: false });
  const title = computed(() => ({
    working: '正在登录', choose: '微信尚未关联会员', bind: '关联会员账号',
    account: '登录原会员账号', error: '微信授权未完成',
  }[state.phase]));

  function fail(error) {
    state.phase = 'error';
    state.message = error?.message || '微信授权失败，请重试';
  }
  function goBack() {
    // #ifdef H5
    closeAuthModal();
    const provider = sheep.$platform.useProvider('wechat');
    location.replace(provider?.getReturnUrl?.() || getRootUrl());
    // #endif
    // #ifndef H5
    sheep.$router.go('/pages/index/index');
    // #endif
  }
  function passwordLogin() {
    state.phase = 'account';
    state.message = '请使用原会员的账号密码登录。';
    showAuthModal();
  }
  function useExistingAccount() {
    state.linkExisting = true;
    if (user.isLogin) {
      state.phase = 'bind';
      state.message = '关联后可使用微信登录同一个会员。';
    } else {
      passwordLogin();
    }
  }
  watch(() => user.isLogin, (loggedIn) => {
    if (!loggedIn || state.phase !== 'account') return;
    closeAuthModal();
    if (state.linkExisting) {
      state.phase = 'bind';
      state.message = '登录成功，请确认关联微信。';
    } else {
      goBack();
    }
  });
  async function bindAccount() {
    state.phase = 'working';
    try {
      const provider = sheep.$platform.useProvider('wechat');
      await provider.bind('', '', provider.getReturnUrl());
    } catch (error) { fail(error); }
  }
  async function registerWechat() {
    const choice = await uni.showModal({
      title: '注册新会员',
      content: '将创建独立的新会员。已有账号的订单、余额和积分不会自动转入，已有会员请选择关联已有账号。',
      confirmText: '注册新会员',
    });
    if (!choice.confirm) return;
    state.phase = 'working';
    try { await sheep.$platform.useProvider('wechat').register(); } catch (error) { fail(error); }
  }
  async function retry() {
    state.phase = 'working';
    try {
      const provider = sheep.$platform.useProvider('wechat');
      // 注册需要再次明确选择，错误重试默认只尝试登录。
      await provider.startOAuth(state.event === 'bind' && user.isLogin ? 'bind' : 'login', provider.getReturnUrl());
    } catch (error) { fail(error); }
  }

  onLoad(async (options) => {
    // #ifndef H5
    fail(new Error('请返回商城使用微信登录。'));
    // #endif
    // #ifdef H5
    if (!canWechatLogin) {
      fail(new Error('请在微信中使用微信登录，也可返回商城使用账号密码。'));
      return;
    }
    const params = { ...options };
    new URLSearchParams(location.search).forEach((value, key) => { params[key] = value; });
    state.event = params.event || 'login';
    const cleanUrl = new URL(location.href);
    ['code', 'state', 'event'].forEach((key) => cleanUrl.searchParams.delete(key));
    history.replaceState(history.state, '', cleanUrl.href);
    const provider = sheep.$platform.useProvider('wechat');
    try {
      provider.consumeOAuth(params);
      const response = state.event === 'bind'
        ? await provider.bind(params.code, params.state)
        : await provider.login(params.code, params.state, state.event === 'register');
      if (response.data?.bindRequired) {
        state.phase = 'choose';
        state.message = '为避免生成重复账号，请选择关联已有会员或注册新会员。';
        return;
      }
      if (state.event !== 'bind' && !response.data?.accessToken) {
        throw new Error('未取得登录结果，请重试');
      }
      goBack();
    } catch (error) { fail(error); }
    // #endif
  });
</script>

<style lang="scss" scoped>
  .oauth-box { padding: 80rpx 40rpx; }
  .oauth-title { font-size: 38rpx; font-weight: bold; margin-bottom: 24rpx; }
  .oauth-message, .oauth-tip { color: #666; font-size: 28rpx; line-height: 1.7; margin: 24rpx 0; }
  button { margin-top: 28rpx; font-size: 30rpx; border-radius: 40rpx; }
  .oauth-primary { background: var(--ui-BG-Main); color: white; }
</style>
