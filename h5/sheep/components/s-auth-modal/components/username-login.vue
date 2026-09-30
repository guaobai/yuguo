<template>
  <view>
    <view class="head-box ss-m-b-40 ss-flex-col">
      <view class="head-title ss-m-b-20">用户名登录</view>
      <view class="head-subtitle">使用注册的用户名和密码登录</view>
    </view>

    <uni-forms
      ref="loginFormRef"
      v-model="state.model"
      :rules="state.rules"
      validateTrigger="bind"
      labelWidth="140"
      labelAlign="center"
    >
      <uni-forms-item name="username" label="用户名">
        <uni-easyinput
          v-model="state.model.username"
          placeholder="请输入用户名"
          :inputBorder="false"
          :maxlength="20"
        />
      </uni-forms-item>

      <uni-forms-item name="password" label="密码">
        <uni-easyinput
          v-model="state.model.password"
          type="password"
          placeholder="请输入密码"
          :inputBorder="false"
          :maxlength="20"
          @confirm="submit"
        />
      </uni-forms-item>
    </uni-forms>

    <button
      class="ss-reset-button primary-submit"
      :disabled="state.submitting || props.agreeStatus !== true"
      @tap="submit"
    >
      {{ state.submitting ? '登录中' : '登录' }}
    </button>

    <view class="auth-switch ss-flex ss-row-center ss-col-center">
      <text>还没有账号？</text>
      <button class="ss-reset-button switch-button" @tap="showAuthModal('register')">
        注册账号
      </button>
    </view>

    <slider-captcha ref="captchaRef" @success="login" />
  </view>
</template>

<script setup>
  import { reactive, ref, unref } from 'vue';
  import sheep from '@/sheep';
  import AuthUtil from '@/sheep/api/member/auth';
  import { closeAuthModal, showAuthModal } from '@/sheep/hooks/useModal';
  import { accountPassword, username } from '@/sheep/validate/form';
  import sliderCaptcha from './slider-captcha.vue';

  const emits = defineEmits(['onConfirm']);
  const props = defineProps({
    agreeStatus: {
      type: [Boolean, null],
      default: null,
    },
  });

  const loginFormRef = ref(null);
  const captchaRef = ref(null);
  const state = reactive({
    submitting: false,
    model: {
      username: '',
      password: '',
    },
    rules: {
      username,
      password: accountPassword,
    },
  });

  function validateProtocol() {
    if (props.agreeStatus === true) return true;
    emits('onConfirm', true);
    sheep.$helper.toast('请先同意用户协议和隐私协议');
    return false;
  }

  async function submit() {
    if (state.submitting) return;
    const valid = await unref(loginFormRef)
      .validate()
      .catch(() => false);
    if (!valid || !validateProtocol()) return;
    captchaRef.value?.open();
  }

  async function login(captchaVerification) {
    state.submitting = true;
    try {
      const result = await AuthUtil.usernameLogin({
        username: state.model.username.trim().toLowerCase(),
        password: state.model.password,
        captchaVerification,
      });
      if (result?.code === 0) {
        closeAuthModal();
      }
    } finally {
      state.submitting = false;
    }
  }
</script>

<style lang="scss" scoped>
  @import '../index.scss';

  .primary-submit {
    width: 100%;
    height: 76rpx;
    margin-top: 30rpx;
    color: #ffffff;
    font-size: 28rpx;
    font-weight: 500;
    background: linear-gradient(90deg, var(--ui-BG-Main), var(--ui-BG-Main-gradient));
    border-radius: 38rpx;
  }

  .primary-submit[disabled] {
    color: #7a7f87;
    background: #e1e4e8;
    opacity: 1;
  }

  .auth-switch {
    margin-top: 32rpx;
    color: #8c959f;
    font-size: 26rpx;
  }

  .switch-button {
    margin-left: 10rpx;
    color: var(--ui-BG-Main);
    font-size: 26rpx;
    font-weight: 500;
  }
</style>
