<!-- 全局分享弹框 -->
<template>
  <view>
    <su-popup :show="state.showShareGuide" :showClose="false" @close="onCloseGuide" />
    <view v-if="state.showShareGuide" class="guide-wrap">
      <image class="guide-image" :src="sheep.$url.static('/static/img/shop/share/share_guide.png')" />
      <!-- #ifdef H5 -->
      <view class="guide-note">
        若转发后只显示网址，请先用微信扫描商城或商品海报的二维码进入，再分享。
      </view>
      <!-- #endif -->
    </view>

    <su-popup :show="show" round="10" :showClose="false" @close="closeShareModal">
      <!-- 分享 tools -->
      <view class="share-box">
        <view class="share-list-box ss-flex">
          <!-- 操作 ①：发送给微信好友 -->
          <button
            v-if="shareConfig.methods.includes('forward')"
            class="share-item share-btn ss-flex-col ss-col-center"
            open-type="share"
            @tap="onShareByForward"
          >
            <image class="share-img" :src="sheep.$url.static('/static/img/shop/share/share_wx.png')" mode="" />
            <text class="share-title">微信好友</text>
          </button>

          <!-- 操作 ②：生成海报图片 -->
          <button
            v-if="shareConfig.methods.includes('poster')"
            class="share-item share-btn ss-flex-col ss-col-center"
            @tap="onShareByPoster"
          >
            <image
              class="share-img"
              :src="sheep.$url.static('/static/img/shop/share/share_poster.png')"
              mode=""
            />
            <text class="share-title">生成海报</text>
          </button>

          <!-- 操作 ③：生成链接 -->
          <button
            v-if="shareConfig.methods.includes('link')"
            class="share-item share-btn ss-flex-col ss-col-center"
            @tap="onShareByCopyLink"
          >
            <image class="share-img" :src="sheep.$url.static('/static/img/shop/share/share_link.png')" mode="" />
            <text class="share-title">复制链接</text>
          </button>
        </view>
        <!-- #ifdef H5 -->
        <view v-if="sheep.$platform.name === 'WechatOfficialAccount'" class="share-note">
          复制链接发送的是网址。若右上角转发也只显示网址，请扫描海报二维码进入后再分享。
        </view>
        <!-- #endif -->
        <view class="share-foot ss-flex ss-row-center ss-col-center" @tap="closeShareModal">
          取消
        </view>
      </view>
    </su-popup>

    <!-- 分享海报，对应操作 ② -->
    <canvas-poster
      ref="SharePosterRef"
      :show="state.showPosterModal"
      :shareInfo="shareInfo"
      @close="state.showPosterModal = false"
    />
  </view>
</template>
<script setup>
  /**
   * 分享弹窗
   */
  import { ref, unref, reactive, computed } from 'vue';
  import sheep from '@/sheep';
  import canvasPoster from './canvas-poster/index.vue';
  import { closeShareModal, showAuthModal } from '@/sheep/hooks/useModal';

  const show = computed(() => sheep.$store('modal').share);
  const shareConfig = computed(() => sheep.$store('app').platform.share);
  const SharePosterRef = ref('');

  const props = defineProps({
    shareInfo: {
      type: Object,
      default() {},
    },
  });

  const state = reactive({
    showShareGuide: false, // H5 的指引
    showPosterModal: false, // 海报弹窗
  });

  // 操作 ②：生成海报分享
  const onShareByPoster = () => {
    closeShareModal();
    if (!sheep.$store('user').isLogin) {
      showAuthModal();
      return;
    }
    unref(SharePosterRef).getPoster();
    state.showPosterModal = true;
  };

  // 操作 ①：直接转发分享
  const onShareByForward = async () => {
    closeShareModal();

    // #ifdef H5
    if (sheep.$platform.name === 'WechatOfficialAccount') {
      const ready = await sheep.$platform.share.updateShareInfo(props.shareInfo);
      if (!ready) {
        sheep.$helper.toast('分享设置暂时失败，请重试');
        return;
      }
      state.showShareGuide = true;
      return;
    }
    if (sheep.$platform.name === 'H5') {
      sheep.$helper.copyText(props.shareInfo.link);
      return;
    }
    // #endif

    // #ifdef APP-PLUS
    uni.share({
      provider: 'weixin',
      scene: 'WXSceneSession',
      type: 0,
      href: props.shareInfo.link,
      title: props.shareInfo.title,
      summary: props.shareInfo.desc,
      imageUrl: props.shareInfo.image,
      success: (res) => {
        console.log('success:' + JSON.stringify(res));
      },
      fail: (err) => {
        console.log('fail:' + JSON.stringify(err));
      },
    });
    // #endif
  };

  // 操作 ③：复制链接分享
  const onShareByCopyLink = () => {
    sheep.$helper.copyText(props.shareInfo.link);
    closeShareModal();
  };

  function onCloseGuide() {
    state.showShareGuide = false;
  }
</script>

<style lang="scss" scoped>
  /* #ifdef H5 */
  .guide-note {
    position: fixed;
    top: 450rpx;
    left: 40rpx;
    right: 40rpx;
    z-index: 10080;
    color: #fff;
    font-size: 28rpx;
    line-height: 1.6;
    text-align: center;
    pointer-events: none;
  }

  .share-note {
    padding: 4rpx 36rpx 24rpx;
    font-size: 24rpx;
    line-height: 1.6;
    color: $gray-b;
  }
  /* #endif */

  .guide-image {
    right: 30rpx;
    top: 0;
    position: fixed;
    width: 580rpx;
    height: 430rpx;
    z-index: 10080;
  }

  // 分享tool
  .share-box {
    background: $white;
    width: 750rpx;
    border-radius: 30rpx 30rpx 0 0;
    padding-top: 30rpx;

    .share-foot {
      font-size: 24rpx;
      color: $gray-b;
      height: 80rpx;
      border-top: 1rpx solid $gray-e;
    }

    .share-list-box {
      .share-btn {
        background: none;
        border: none;
        line-height: 1;
        padding: 0;

        &::after {
          border: none;
        }
      }

      .share-item {
        flex: 1;
        padding-bottom: 20rpx;

        .share-img {
          width: 70rpx;
          height: 70rpx;
          background: $gray-f;
          border-radius: 50%;
          margin-bottom: 20rpx;
        }

        .share-title {
          font-size: 24rpx;
          color: $dark-6;
        }
      }
    }
  }
</style>
