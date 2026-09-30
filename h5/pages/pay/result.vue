<!-- 支付结果页面 -->
<template>
  <s-layout :bgStyle="{ color: '#FFF' }" title="支付结果">
    <view class="pay-result-box ss-flex-col ss-row-center ss-col-center">
      <!-- 信息展示 -->
      <view class="pay-waiting ss-m-b-30" v-if="payResult === 'waiting'" />
      <image
        class="pay-img ss-m-b-30"
        v-if="payResult === 'success'"
        :src="sheep.$url.static('/static/img/shop/order/order_pay_success.gif')"
      />
      <image
        class="pay-img ss-m-b-30"
        v-if="['failed', 'closed'].includes(payResult)"
        :src="sheep.$url.static('/static/img/shop/order/order_paty_fail.gif')"
      />
      <view class="tip-text ss-m-b-30" v-if="payResult === 'success'">支付成功</view>
      <view class="tip-text ss-m-b-30" v-if="payResult === 'failed'">支付失败</view>
      <view class="tip-text ss-m-b-30" v-if="payResult === 'closed'">该订单已关闭</view>
      <view class="tip-text ss-m-b-30" v-if="payResult === 'waiting'">检测支付结果...</view>
      <view class="tip-text ss-m-b-30" v-if="payResult === 'pending'">支付结果确认中</view>
      <view class="ss-p-x-30 ss-m-b-20" v-if="['pending', 'waiting'].includes(payResult)">
        {{ state.message }}
      </view>
      <view class="pay-total-num ss-flex" v-if="payResult === 'success'">
        <view>￥{{ fen2yuan(state.orderInfo.price) }}</view>
      </view>

      <!-- 操作区 -->
      <view class="btn-box ss-flex ss-row-center ss-m-t-50">
        <button class="back-btn ss-reset-button" @tap="sheep.$router.go('/pages/index/index')">
          返回首页
        </button>
        <button
          class="check-btn ss-reset-button"
          v-if="payResult === 'failed'"
          @tap="
            sheep.$router.redirect('/pages/pay/index', { id: state.id, orderType: state.orderType })
          "
        >
          重新支付
        </button>
        <button class="check-btn ss-reset-button" v-if="payResult === 'success'" @tap="onOrder">
          查看订单
        </button>
        <button class="check-btn ss-reset-button" v-if="payResult === 'pending'" @tap="startPolling">
          重新查询
        </button>
        <button class="check-btn ss-reset-button" v-if="payResult === 'pending'" @tap="onOrder">
          查看订单
        </button>
        <button
          class="check-btn ss-reset-button"
          v-if="payResult === 'success' && state.tradeOrder.type === 3"
          @tap="sheep.$router.redirect('/pages/activity/groupon/order')"
        >
          我的拼团
        </button>
      </view>

      <!-- #ifdef MP-WEIXIN -->
      <view
        class="subscribe-box ss-flex ss-m-t-44"
        v-if="showSubscribeBtn && payResult === 'success' && state.orderType === 'goods'"
      >
        <image class="subscribe-img" :src="sheep.$url.static('/static/img/shop/order/cargo.png')" />
        <view class="subscribe-title ss-m-r-48 ss-m-l-16">获取实时发货信息与订单状态</view>
        <view class="subscribe-start" @tap="subscribeMessage">立即订阅</view>
      </view>
      <!-- #endif -->
    </view>
  </s-layout>
</template>

<script setup>
  import { onHide, onLoad, onShow, onUnload } from '@dcloudio/uni-app';
  import { computed, reactive, ref } from 'vue';
  import sheep from '@/sheep';
  import PayOrderApi from '@/sheep/api/pay/order';
  import { fen2yuan } from '@/sheep/hooks/useGoods';
  import OrderApi from '@/sheep/api/trade/order';
  import { WxaSubscribeTemplate } from '@/sheep/util/const';

  const state = reactive({
    id: '', orderType: 'goods', result: 'unpaid', orderInfo: {}, tradeOrder: {},
    counter: 0, clientFailed: false, message: '请稍候，正在向后台确认支付结果。',
  });
  const payResult = computed(() => ({
    unpaid: 'waiting', paid: 'success', failed: 'failed', closed: 'closed', pending: 'pending',
  }[state.result]));
  const showSubscribeBtn = ref(true);
  const subscribing = ref(false);
  let timer;
  let visible = false;
  let running = false;
  let refreshQueued = false;
  let pollVersion = 0;

  async function getOrderInfo() {
    if (!visible || !state.id) return;
    if (running) { refreshQueued = true; return; }
    running = true;
    const version = pollVersion;
    state.counter++;
    try {
      const response = await PayOrderApi.getOrder(state.id, true, true);
      if (!visible || version !== pollVersion) return;
      if (response?.code === 0 && response.data) {
        state.orderInfo = response.data;
        if (response.data.status === 30) {
          state.result = 'closed';
          return;
        }
        if ([10, 20].includes(response.data.status)) {
          state.result = 'paid';
          if (state.orderType === 'goods') {
            const detail = await OrderApi.getOrderDetail(response.data.merchantOrderId, true);
            if (visible && version === pollVersion && detail?.code === 0) state.tradeOrder = detail.data || {};
          }
          return;
        }
        if (state.clientFailed && response.data.status === 0) {
          state.result = 'failed';
          return;
        }
      } else {
        state.message = '暂时未能获取结果，可稍后重新查询或查看订单。';
      }
    } catch {
      if (visible && version === pollVersion) {
        state.message = '网络暂时不可用，请稍后重新查询；请勿重复付款。';
      }
    } finally {
      running = false;
      if (refreshQueued && visible) {
        refreshQueued = false;
        getOrderInfo();
      }
    }
    if (!visible || version !== pollVersion || ['paid', 'closed', 'failed'].includes(state.result)) return;
    if (state.counter < 8) {
      timer = setTimeout(getOrderInfo, Math.min(1500 + state.counter * 500, 4000));
    } else {
      // 通知延迟和网络失败不能用固定次数推断为支付失败。
      state.result = 'pending';
      state.message = '后台尚未确认支付结果。若已扣款，请稍后重新查询或查看订单，请勿重复付款。';
    }
  }

  function startPolling() {
    if (!state.id || ['paid', 'closed'].includes(state.result)) return;
    clearTimeout(timer);
    pollVersion++;
    state.counter = 0;
    state.result = 'unpaid';
    state.message = '请稍候，正在向后台确认支付结果。';
    getOrderInfo();
  }
  function pausePolling() {
    visible = false;
    clearTimeout(timer);
    refreshQueued = false;
    pollVersion++;
  }
  function onOrder() {
    sheep.$router.redirect(state.orderType === 'recharge' ? '/pages/pay/recharge-log' : '/pages/order/list');
  }

  // #ifdef MP-WEIXIN
  async function subscribeMessage() {
    if (subscribing.value || state.orderType !== 'goods') return;
    subscribing.value = true;
    const event = [WxaSubscribeTemplate.TRADE_ORDER_DELIVERY];
    if (state.tradeOrder.type === 3) event.push(WxaSubscribeTemplate.PROMOTION_COMBINATION_SUCCESS);
    try {
      const result = await sheep.$platform.useProvider('wechat').subscribeMessage(event);
      const acceptedAll = result.requested.length > 0 &&
        result.accepted.length === result.requested.length && result.missing.length === 0;
      showSubscribeBtn.value = !acceptedAll;
      if (acceptedAll) sheep.$helper.toast('订阅成功');
      else if (result.accepted.length) sheep.$helper.toast('已订阅部分通知，其余通知可重新选择');
      else sheep.$helper.toast('未订阅通知，可再次点击订阅');
    } finally { subscribing.value = false; }
  }
  // #endif

  onLoad((options) => {
    state.id = options.id || '';
    state.orderType = options.orderType || 'goods';
    state.clientFailed = options.payState === 'fail';
    if (!state.id) {
      state.result = 'pending';
      state.message = '缺少订单信息，请进入订单列表查看。';
    }
  });
  onShow(() => { visible = true; startPolling(); });
  onHide(pausePolling);
  onUnload(pausePolling);
</script>

<style lang="scss" scoped>
  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }

  .score-img {
    width: 36rpx;
    height: 36rpx;
    margin: 0 4rpx;
  }

  .pay-result-box {
    padding: 60rpx 0;

    .pay-waiting {
      margin-top: 20rpx;
      width: 60rpx;
      height: 60rpx;
      border: 10rpx solid rgb(233, 231, 231);
      border-bottom-color: rgb(204, 204, 204);
      border-radius: 50%;
      display: inline-block;
      // -webkit-animation: rotation 1s linear infinite;
      animation: rotation 1s linear infinite;
    }

    .pay-img {
      width: 130rpx;
      height: 130rpx;
    }

    .tip-text {
      font-size: 30rpx;
      font-weight: bold;
      color: #333333;
    }

    .pay-total-num {
      font-size: 36rpx;
      font-weight: 500;
      color: #333333;
      font-family: OPPOSANS;
    }

    .btn-box {
      width: 100%;

      .back-btn {
        width: 190rpx;
        height: 70rpx;
        font-size: 28rpx;
        border: 2rpx solid #dfdfdf;
        border-radius: 35rpx;
        font-weight: 400;
        color: #595959;
      }

      .check-btn {
        width: 190rpx;
        height: 70rpx;
        font-size: 28rpx;
        border: 2rpx solid #dfdfdf;
        border-radius: 35rpx;
        font-weight: 400;
        color: #595959;
        margin-left: 32rpx;
      }
    }

    .subscribe-box {
      .subscribe-img {
        width: 44rpx;
        height: 44rpx;
      }

      .subscribe-title {
        font-weight: 500;
        font-size: 32rpx;
        line-height: 36rpx;
        color: #434343;
      }

      .subscribe-start {
        color: var(--ui-BG-Main);
        font-weight: 700;
        font-size: 32rpx;
        line-height: 36rpx;
      }
    }
  }
</style>

