<!-- 收件地址列表 -->
<template>
  <s-layout :bgStyle="{ color: '#FFF' }" title="收货地址">
    <view v-if="state.list.length">
      <s-address-item
        hasBorderBottom
        v-for="item in state.list"
        :key="item.id"
        :item="item"
        @tap="onSelect(item)"
      />
    </view>

    <su-fixed bottom placeholder>
      <view class="footer-box ss-flex ss-row-between ss-p-20">
        <!-- 微信小程序和微信H5 -->
        <button
          v-if="['WechatMiniProgram', 'WechatOfficialAccount'].includes(sheep.$platform.name)"
          @tap="importWechatAddress"
          class="border ss-reset-button sync-wxaddress ss-m-20 ss-flex ss-row-center ss-col-center"
        >
          <text class="cicon-weixin ss-p-r-10" style="color: #09bb07; font-size: 40rpx"></text>
          导入微信地址
        </button>
        <button
          class="add-btn ss-reset-button ui-Shadow-Main"
          @tap="sheep.$router.go('/pages/user/address/edit')"
        >
          新增收货地址
        </button>
      </view>
    </su-fixed>
    <s-empty
      v-if="state.list.length === 0 && !state.loading"
      text="暂无收货地址"
      icon="/static/data-empty.png"
    />
  </s-layout>
</template>

<script setup>
  import { onBeforeMount, reactive } from 'vue';
  import { onLoad, onShow } from '@dcloudio/uni-app';
  import sheep from '@/sheep';
  import AreaApi from '@/sheep/api/system/area';
  import AddressApi from '@/sheep/api/member/address';

  const state = reactive({
    list: [], // 地址列表
    loading: true,
    importing: false,
    openType: '', // 页面打开类型
  });

  // 选择收货地址
  const onSelect = (addressInfo) => {
    if (state.openType !== 'select') {
      // 不作为选择组件时阻断操作
      return;
    }
    uni.$emit('SELECT_ADDRESS', {
      addressInfo,
    });
    sheep.$router.back();
  };

  // 微信小程序与公众号 H5 的地址字段名称不完全一致，在这里统一转换
  function normalizeWechatAddress(res) {
    return {
      consignee: res.userName,
      mobile: res.telNumber,
      province_name: res.provinceName,
      city_name: res.cityName,
      district_name: res.countyName || res.countryName,
      address: res.detailInfoNew || res.detailInfo,
      region: '',
      is_default: false,
    };
  }

  function onWechatAddressSuccess(res) {
    state.importing = false;
    sheep.$router.go('/pages/user/address/edit', {
      data: JSON.stringify(normalizeWechatAddress(res)),
    });
  }

  function onWechatAddressFail(err) {
    state.importing = false;
    const errMsg = err?.errMsg || '';
    if (errMsg.toLowerCase().includes('cancel')) {
      return;
    }
    console.error('导入微信地址失败', err);
    sheep.$helper.toast('导入微信地址失败，请稍后重试');
  }

  // 导入微信地址
  function importWechatAddress() {
    if (state.importing) {
      return;
    }
    state.importing = true;

    // #ifdef MP-WEIXIN
    uni.chooseAddress({
      success: onWechatAddressSuccess,
      fail: onWechatAddressFail,
    });
    // #endif

    // #ifdef H5
    const jsWxSdk = sheep.$platform.useProvider('wechat')?.jsWxSdk;
    if (!jsWxSdk?.isWechat()) {
      state.importing = false;
      sheep.$helper.toast('请使用微信内置浏览器打开');
      return;
    }
    jsWxSdk.openAddress({
      success: onWechatAddressSuccess,
      fail: onWechatAddressFail,
      cancel: () => {
        state.importing = false;
      },
    });
    // #endif
  }

  onLoad((option) => {
    if (option.type) {
      state.openType = option.type;
    }
  });

  onShow(async () => {
    state.list = (await AddressApi.getAddressList()).data;
    state.loading = false;
  });

  onBeforeMount(() => {
    if (!!uni.getStorageSync('areaData')) {
      return;
    }
    // 提前加载省市区数据
    AreaApi.getAreaTree().then((res) => {
      if (res.code === 0) {
        uni.setStorageSync('areaData', res.data);
      }
    });
  });
</script>

<style lang="scss" scoped>
  .footer-box {
    .add-btn {
      flex: 1;
      background: linear-gradient(90deg, var(--ui-BG-Main), var(--ui-BG-Main-gradient));
      border-radius: 80rpx;
      font-size: 30rpx;
      font-weight: 500;
      line-height: 80rpx;
      color: $white;
      position: relative;
      z-index: 1;
    }

    .sync-wxaddress {
      flex: 1;
      line-height: 80rpx;
      background: $white;
      border-radius: 80rpx;
      font-size: 30rpx;
      font-weight: 500;
      color: $dark-6;
      margin-right: 18rpx;
    }
  }
</style>
