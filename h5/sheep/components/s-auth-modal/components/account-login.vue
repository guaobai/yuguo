<!-- 账号密码登录 accountLogin  -->
<template>
  <view>
    <!-- 标题栏 -->
    <view class="head-box ss-m-b-60 ss-flex-col">
      <view class="ss-flex ss-m-b-20">
        <view
          v-if="props.showSmsLogin"
          class="head-title-active head-title-line"
          @tap="showAuthModal('smsLogin')"
        >
          短信登录
        </view>
        <view class="head-title ss-m-r-40 head-title-animation">账号登录</view>
      </view>
      <view class="head-subtitle">使用手机号和密码登录</view>
    </view>

    <!-- 表单项 -->
    <uni-forms
      ref="accountLoginRef"
      v-model="state.model"
      :rules="state.rules"
      validateTrigger="bind"
      labelWidth="140"
      labelAlign="center"
    >
      <uni-forms-item name="mobile" label="手机号">
        <uni-easyinput placeholder="请输入手机号" v-model="state.model.mobile" :inputBorder="false">
          <template v-slot:right>
            <button class="ss-reset-button forgot-btn" @tap="showAuthModal('resetPassword')">
              忘记密码
            </button>
          </template>
        </uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="password" label="密码">
        <uni-easyinput
          type="password"
          placeholder="请输入密码"
          v-model="state.model.password"
          :inputBorder="false"
        >
          <template v-slot:right>
            <button
              class="ss-reset-button login-btn-start"
              :disabled="props.agreeStatus !== true"
              @tap="accountLoginSubmit"
            >
              登录
            </button>
          </template>
        </uni-easyinput>
      </uni-forms-item>
    </uni-forms>
  </view>
</template>

<script setup>
  import { ref, reactive, unref } from 'vue';
  import sheep from '@/sheep';
  import { mobile, password } from '@/sheep/validate/form';
  import { showAuthModal, closeAuthModal } from '@/sheep/hooks/useModal';
  import AuthUtil from '@/sheep/api/member/auth';

  const accountLoginRef = ref(null);

  const emits = defineEmits(['onConfirm']);

  const props = defineProps({
    agreeStatus: {
      type: [Boolean, null],
      default: null,
    },
    showSmsLogin: {
      type: Boolean,
      default: false,
    },
  });

  // 数据
  const state = reactive({
    model: {
      mobile: '', // 账号
      password: '', // 密码
    },
    rules: {
      mobile,
      password,
    },
  });

  // 账号登录
  async function accountLoginSubmit() {
    // 表单验证
    const validate = await unref(accountLoginRef)
      .validate()
      .catch((error) => {
        console.log('error: ', error);
      });
    if (!validate) return;

    // 检查协议状态
    if (props.agreeStatus !== true) {
      emits('onConfirm', true);
      sheep.$helper.toast('请先同意用户协议和隐私协议');
      return;
    }

    // 提交数据
    const { code, data } = await AuthUtil.login(state.model);
    if (code === 0) {
      closeAuthModal();
    }
  }
</script>

<style lang="scss" scoped>
  @import '../index.scss';
</style>
