<script setup>
  import { onLaunch, onShow, onError } from '@dcloudio/uni-app';
  import sheep, { ShoproInit } from './sheep';

  onLaunch(() => {
    // 延时隐藏原生导航栏
    setTimeout(() => {
      // OAuth 回调、商品详情等非 tabBar 页直接进入时，没有原生栏可隐藏。
      uni.hideTabBar({ fail: () => {} });
    }, 200);

    // 加载Shopro底层依赖
    ShoproInit();
  });

  onShow((options) => {
    // #ifdef APP-PLUS
    // 获取urlSchemes参数
    const args = plus.runtime.arguments;
    if (args) {
    }

    // 获取剪贴板
    uni.getClipboardData({
      success: (res) => {},
    });
    // #endif

    // #ifdef MP-WEIXIN
    // 确认收货回调结果
    if (options.query?.spm) {
      // 朋友圈直接进入当前商品页，仅记录推广来源，不再次跳转到其他页面。
      sheep.$platform.share.decryptSpm(options.query.spm, false);
    }
    // #endif
  });
</script>

<style lang="scss">
  @import '@/sheep/scss/index.scss';
</style>
