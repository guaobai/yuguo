<template>
  <view>
    <view class="head-box ss-m-b-40 ss-flex-col">
      <view class="head-title ss-m-b-20">注册账号</view>
      <view class="head-subtitle">用户名注册后不可修改，请妥善保管密码</view>
    </view>

    <uni-forms
      ref="registerFormRef"
      v-model="state.model"
      :rules="state.rules"
      validateTrigger="bind"
      labelWidth="140"
      labelAlign="center"
    >
      <uni-forms-item name="username" label="用户名">
        <uni-easyinput
          v-model="state.model.username"
          placeholder="4-20位字母、数字或下划线"
          :inputBorder="false"
          :maxlength="20"
        />
      </uni-forms-item>

      <uni-forms-item name="password" label="密码">
        <uni-easyinput
          v-model="state.model.password"
          type="password"
          placeholder="6-20位，需包含字母和数字"
          :inputBorder="false"
          :maxlength="20"
        />
      </uni-forms-item>

      <uni-forms-item name="confirmPassword" label="确认密码">
        <uni-easyinput
          v-model="state.model.confirmPassword"
          type="password"
          placeholder="请再次输入密码"
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
      {{ state.submitting ? '注册中' : '注册并登录' }}
    </button>

    <view class="auth-switch ss-flex ss-row-center ss-col-center">
      <text>已有账号？</text>
      <button class="ss-reset-button switch-button" @tap="showAuthModal('usernameLogin')">
        返回登录
      </button>
    </view>

    <slider-captcha ref="captchaRef" @success="register" />
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

  const registerFormRef = ref(null);
  const captchaRef = ref(null);
  const state = reactive({
    submitting: false,
    model: {
      username: '',
      password: '',
      confirmPassword: '',
    },
    rules: {
      username,
      password: accountPassword,
      confirmPassword: {
        rules: [
          {
            required: true,
            errorMessage: '请再次输入密码',
          },
          {
            validateFunction: function (rule, value, data, callback) {
              if (value !== data.password) {
                callback('两次输入的密码不一致');
              }
              return true;
            },
          },
        ],
      },
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
    const valid = await unref(registerFormRef)
      .validate()
      .catch(() => false);
    if (!valid || !validateProtocol()) return;
    captchaRef.value?.open();
  }

  async function register(captchaVerification) {
    state.submitting = true;
    try {
      const result = await AuthUtil.register({
        username: state.model.username.trim().toLowerCase(),
        password: state.model.password,
        confirmPassword: state.model.confirmPassword,
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
