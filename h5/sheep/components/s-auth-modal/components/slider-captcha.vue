<template>
  <view v-if="visible" class="captcha-mask" @tap.self="close">
    <view class="captcha-panel" @tap.stop>
      <view class="captcha-header ss-flex ss-row-between ss-col-center">
        <text class="captcha-title">安全验证</text>
        <button class="ss-reset-button icon-button" @tap="close">
          <uni-icons type="closeempty" size="22" color="#666666" />
        </button>
      </view>

      <view class="captcha-image-box">
        <image
          v-if="backgroundImage"
          class="captcha-image"
          :src="backgroundImage"
          mode="scaleToFill"
        />
        <view v-else class="captcha-placeholder ss-flex ss-row-center ss-col-center">
          <text>{{ loading ? '验证码加载中' : '验证码加载失败' }}</text>
        </view>
        <image
          v-if="puzzleImage"
          class="captcha-piece"
          :src="puzzleImage"
          mode="scaleToFill"
          :style="pieceStyle"
        />
        <button class="ss-reset-button refresh-button" :disabled="loading" @tap="loadCaptcha">
          <uni-icons type="refreshempty" size="20" color="#ffffff" />
        </button>
        <view v-if="message" class="captcha-message" :class="status">
          {{ message }}
        </view>
      </view>

      <view
        class="slider-track"
        :class="status"
        @mousemove.stop.prevent="move"
        @mouseup.stop.prevent="end"
        @mouseleave="end"
        @touchmove.stop.prevent="move"
        @touchend.stop.prevent="end"
        @touchcancel.stop.prevent="end"
      >
        <view class="slider-progress" :style="{ width: `${sliderLeft + handleSize}px` }" />
        <text class="slider-text">{{ sliderText }}</text>
        <view
          class="slider-handle ss-flex ss-row-center ss-col-center"
          :style="{ transform: `translateX(${sliderLeft}px)` }"
          @mousedown.stop.prevent="start"
          @touchstart.stop.prevent="start"
        >
          <uni-icons
            :type="status === 'success' ? 'checkmarkempty' : 'right'"
            size="22"
            :color="status === 'success' ? '#ffffff' : '#555555'"
          />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
  import { computed, getCurrentInstance, nextTick, onUnmounted, ref } from 'vue';
  import AuthUtil from '@/sheep/api/member/auth';
  import { aesEncrypt } from '@/sheep/util/crypto';

  const emits = defineEmits(['success']);
  const instance = getCurrentInstance();

  const visible = ref(false);
  const loading = ref(false);
  const verifying = ref(false);
  const dragging = ref(false);
  const status = ref('ready');
  const message = ref('');
  const backgroundImage = ref('');
  const puzzleImage = ref('');
  const token = ref('');
  const secretKey = ref('');
  const imageWidth = ref(310);
  const trackWidth = ref(310);
  const sliderLeft = ref(0);
  const dragStartX = ref(0);
  const dragStartLeft = ref(0);
  const handleSize = 44;
  let successTimer;
  let refreshTimer;

  const maxSliderLeft = computed(() => Math.max(trackWidth.value - handleSize, 0));
  const sliderText = computed(() => {
    if (verifying.value) return '正在验证';
    if (status.value === 'success') return '验证通过';
    return '向右拖动滑块完成验证';
  });
  const pieceStyle = computed(() => ({
    width: `${(imageWidth.value * 47) / 310}px`,
    transform: `translateX(${sliderLeft.value}px)`,
  }));

  function toImageUrl(base64) {
    if (!base64) return '';
    return base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
  }

  function getClientUid() {
    const storageKey = 'mall-slider-captcha-client';
    let clientUid = uni.getStorageSync(storageKey);
    if (!clientUid) {
      clientUid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      uni.setStorageSync(storageKey, clientUid);
    }
    return clientUid;
  }

  async function measure() {
    await nextTick();
    await new Promise((resolve) => {
      uni
        .createSelectorQuery()
        .in(instance.proxy)
        .select('.captcha-image-box')
        .boundingClientRect((rect) => {
          if (rect && rect.width) imageWidth.value = rect.width;
        })
        .select('.slider-track')
        .boundingClientRect((rect) => {
          if (rect && rect.width) trackWidth.value = rect.width;
        })
        .exec(resolve);
    });
  }

  function resetPosition() {
    sliderLeft.value = 0;
    dragging.value = false;
    verifying.value = false;
    status.value = 'ready';
    message.value = '';
  }

  async function loadCaptcha() {
    if (loading.value) return;
    clearTimeout(refreshTimer);
    loading.value = true;
    resetPosition();
    backgroundImage.value = '';
    puzzleImage.value = '';
    try {
      const result = await AuthUtil.getCaptcha({
        captchaType: 'blockPuzzle',
        clientUid: getClientUid(),
        ts: Date.now(),
      });
      const captcha = result && result.data;
      if (!result || result.code !== 0 || !captcha || captcha.repCode !== '0000') {
        message.value = (captcha && captcha.repMsg) || (result && result.msg) || '验证码加载失败';
        status.value = 'error';
        return;
      }
      backgroundImage.value = toImageUrl(captcha.repData.originalImageBase64);
      puzzleImage.value = toImageUrl(captcha.repData.jigsawImageBase64);
      token.value = captcha.repData.token;
      secretKey.value = captcha.repData.secretKey;
      await measure();
    } catch (error) {
      status.value = 'error';
      message.value = '验证码加载失败，请检查网络';
    } finally {
      loading.value = false;
    }
  }

  function pointerX(event) {
    if (!event) return 0;
    const touch = event.touches && event.touches[0];
    if (touch && touch.clientX != null) return touch.clientX;
    const changedTouch = event.changedTouches && event.changedTouches[0];
    if (changedTouch && changedTouch.clientX != null) return changedTouch.clientX;
    return event.clientX != null ? event.clientX : 0;
  }

  function start(event) {
    if (loading.value || verifying.value || status.value === 'success' || !token.value) return;
    dragging.value = true;
    dragStartX.value = pointerX(event);
    dragStartLeft.value = sliderLeft.value;
    message.value = '';
    status.value = 'ready';
  }

  function move(event) {
    if (!dragging.value) return;
    const offset = pointerX(event) - dragStartX.value;
    sliderLeft.value = Math.min(Math.max(dragStartLeft.value + offset, 0), maxSliderLeft.value);
  }

  async function end() {
    if (!dragging.value) return;
    dragging.value = false;
    await verify();
  }

  async function verify() {
    if (verifying.value || !token.value) return;
    verifying.value = true;
    const point = {
      x: Math.round((sliderLeft.value * 310) / imageWidth.value),
      y: 5,
    };
    try {
      const result = await AuthUtil.checkCaptcha({
        captchaType: 'blockPuzzle',
        pointJson: encryptCaptchaValue(JSON.stringify(point)),
        token: token.value,
      });
      if (!visible.value) return;
      const captcha = result && result.data;
      if (!result || result.code !== 0 || !captcha || captcha.repCode !== '0000') {
        status.value = 'error';
        message.value = (captcha && captcha.repMsg) || (result && result.msg) || '验证失败，请重试';
        refreshTimer = setTimeout(loadCaptcha, 700);
        return;
      }
      status.value = 'success';
      message.value = '验证通过';
      const captchaVerification = encryptCaptchaValue(`${token.value}---${JSON.stringify(point)}`);
      successTimer = setTimeout(() => {
        visible.value = false;
        emits('success', captchaVerification);
      }, 450);
    } catch (error) {
      status.value = 'error';
      message.value = '验证失败，请检查网络';
      refreshTimer = setTimeout(loadCaptcha, 700);
    } finally {
      verifying.value = false;
    }
  }

  function encryptCaptchaValue(value) {
    return secretKey.value ? aesEncrypt(value, secretKey.value) : value;
  }

  async function open() {
    clearTimeout(successTimer);
    clearTimeout(refreshTimer);
    visible.value = true;
    await nextTick();
    await loadCaptcha();
  }

  function close() {
    clearTimeout(successTimer);
    clearTimeout(refreshTimer);
    visible.value = false;
    resetPosition();
  }

  onUnmounted(() => {
    clearTimeout(successTimer);
    clearTimeout(refreshTimer);
  });
  defineExpose({ open, close });
</script>

<style lang="scss" scoped>
  .captcha-mask {
    position: fixed;
    z-index: 12000;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32rpx;
    background: rgba(0, 0, 0, 0.5);
  }

  .captcha-panel {
    width: 620rpx;
    max-width: calc(100vw - 48px);
    padding: 28rpx;
    background: #ffffff;
    border-radius: 16rpx;
    box-sizing: border-box;
    box-shadow: 0 18rpx 60rpx rgba(0, 0, 0, 0.18);
  }

  .captcha-header {
    height: 64rpx;
    margin-bottom: 20rpx;
  }

  .captcha-title {
    color: #24292f;
    font-size: 32rpx;
    font-weight: 600;
  }

  .icon-button,
  .refresh-button {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-button {
    width: 56rpx;
    height: 56rpx;
  }

  .captcha-image-box {
    position: relative;
    width: 100%;
    aspect-ratio: 2 / 1;
    overflow: hidden;
    background: #f2f4f7;
    border-radius: 8rpx;
  }

  .captcha-image,
  .captcha-placeholder {
    width: 100%;
    height: 100%;
  }

  .captcha-placeholder {
    color: #8c959f;
    font-size: 26rpx;
  }

  .captcha-piece {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    will-change: transform;
  }

  .refresh-button {
    position: absolute;
    top: 16rpx;
    right: 16rpx;
    width: 60rpx;
    height: 60rpx;
    background: rgba(0, 0, 0, 0.52);
    border-radius: 8rpx;
  }

  .captcha-message {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    padding: 14rpx 20rpx;
    color: #ffffff;
    font-size: 24rpx;
    background: rgba(219, 48, 48, 0.88);
  }

  .captcha-message.success {
    background: rgba(39, 152, 80, 0.9);
  }

  .slider-track {
    position: relative;
    width: 100%;
    height: 88rpx;
    margin-top: 24rpx;
    overflow: hidden;
    background: #f3f5f7;
    border: 2rpx solid #d8dee4;
    border-radius: 8rpx;
    box-sizing: border-box;
    user-select: none;
  }

  .slider-progress {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    background: rgba(23, 119, 255, 0.13);
    border-right: 2rpx solid #1677ff;
  }

  .slider-track.success .slider-progress {
    background: rgba(39, 152, 80, 0.18);
    border-color: #279850;
  }

  .slider-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #7d8590;
    font-size: 26rpx;
  }

  .slider-handle {
    position: absolute;
    top: -2rpx;
    left: -2rpx;
    width: 88rpx;
    height: 88rpx;
    background: #ffffff;
    border: 2rpx solid #b8c0ca;
    border-radius: 8rpx;
    box-sizing: border-box;
    will-change: transform;
  }

  .slider-track.success .slider-handle {
    background: #279850;
    border-color: #279850;
  }
</style>
