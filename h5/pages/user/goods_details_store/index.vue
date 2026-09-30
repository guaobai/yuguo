<template>
  <s-layout :bgStyle="{ color: '#FFF' }" title="选择自提门店">
    <view class="ss-p-30">
      <view class="ss-m-b-20">{{ state.locationMessage }}</view>
      <button size="mini" :loading="state.locating" :disabled="state.locating" @tap="selfLocation">
        {{ state.locating ? '定位中' : '重新定位' }}
      </button>
      <button v-if="state.listError" size="mini" @tap="getList">重新加载门店</button>
    </view>
    <view class="storeBox" ref="container">
      <view
        class="storeBox-box"
        v-for="(item, index) in state.storeList"
        :key="index"
        @tap="checked(item)"
      >
        <view class="store-img">
          <image :src="item.logo" class="img" />
        </view>
        <view class="store-cent-left">
          <view class="store-name">{{ item.name }}</view>
          <view class="store-address line1">
            {{ item.areaName }}{{ ', ' + item.detailAddress }}
          </view>
        </view>
        <view class="row-right ss-flex-col ss-col-center">
          <view>
            <!-- #ifdef H5 -->
            <a class="store-phone" :href="'tel:' + item.phone" @tap.stop>
              <view class="iconfont">
                <view class="ss-rest-button">
                  <text class="_icon-forward" />
                </view>
              </view>
            </a>
            <!-- #endif -->
            <!-- #ifdef MP -->
            <view class="store-phone" @tap.stop="call(item.phone)">
              <view class="iconfont">
                <view class="ss-rest-button">
                  <text class="_icon-forward" />
                </view>
              </view>
            </view>
            <!-- #endif -->
          </view>
          <view class="store-distance ss-flex ss-row-center" @tap.stop="showMaoLocation(item)">
            <text class="addressTxt" v-if="item.distance">
              距离{{ item.distance.toFixed(2) }}千米
            </text>
            <text class="addressTxt" v-else>查看地图</text>
            <view class="iconfont">
              <view class="ss-rest-button">
                <text class="_icon-forward" />
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </s-layout>
</template>

<script setup>
  import DeliveryApi from '@/sheep/api/trade/delivery';
  import { onMounted, reactive } from 'vue';
  import sheep from '@/sheep';
  import { getLocation, openLocation, locationErrorMessage } from '@/sheep/platform/location';

  const state = reactive({
    loading: false, locating: false, storeList: [], latitude: undefined, longitude: undefined,
    locationMessage: '可直接选择门店，也可定位查看附近门店。',
    listError: false, locationDenied: false,
  });
  let refreshQueued = false;
  const call = (phone) => uni.makePhoneCall({ phoneNumber: phone });

  const selfLocation = async () => {
    if (state.locating) return;
    state.locating = true;
    state.locationMessage = '正在获取当前位置…';
    try {
      // #ifdef MP-WEIXIN
      if (state.locationDenied) await uni.openSetting();
      // #endif
      const result = await getLocation();
      state.latitude = result.latitude;
      state.longitude = result.longitude;
      state.locationDenied = false;
      state.locationMessage = '已按当前位置显示附近门店。';
      await getList();
    } catch (error) {
      state.locationMessage = locationErrorMessage(error);
      state.locationDenied = /auth|deny|denied/i.test(error?.errMsg || error?.message || '');
    } finally {
      state.locating = false;
    }
  };

  const showMaoLocation = async (store) => {
    try {
      await openLocation({
        latitude: store.latitude, longitude: store.longitude,
        name: store.name, address: (store.areaName || '') + (store.detailAddress || ''),
      });
    } catch (error) {
      sheep.$helper.toast(error?.message || '暂时无法打开地图，请稍后重试');
    }
  };

  const checked = (addressInfo) => {
    uni.$emit('SELECT_PICK_UP_INFO', { addressInfo });
    sheep.$router.back();
  };

  const getList = async () => {
    if (state.loading) { refreshQueued = true; return; }
    state.loading = true;
    state.listError = false;
    try {
      const response = await DeliveryApi.getDeliveryPickUpStoreList({
        latitude: state.latitude, longitude: state.longitude,
      });
      if (response?.code !== 0) throw new Error('门店加载失败');
      state.storeList = response.data || [];
    } catch {
      state.listError = true;
    } finally {
      state.loading = false;
      if (refreshQueued) { refreshQueued = false; getList(); }
    }
  };

  onMounted(() => {
    getList();
    selfLocation();
  });
</script>
<style lang="scss" scoped>
  .line1 {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .geoPage {
    position: fixed;
    width: 100%;
    height: 100%;
    top: 0;
    z-index: 10000;
  }

  .storeBox {
    width: 100%;
    background-color: #fff;
    padding: 0 30rpx;
  }

  .storeBox-box {
    width: 100%;
    height: auto;
    display: flex;
    align-items: center;
    padding: 23rpx 0;
    justify-content: space-between;
    border-bottom: 1px solid #eee;
  }

  .store-cent {
    display: flex;
    align-items: center;
    width: 80%;
  }

  .store-cent-left {
    //width: 45%;
    flex: 2;
  }

  .store-img {
    flex: 1;
    width: 120rpx;
    height: 120rpx;
    border-radius: 6rpx;
    margin-right: 22rpx;
  }

  .store-img .img {
    width: 100%;
    height: 100%;
  }

  .store-name {
    color: #282828;
    font-size: 30rpx;
    margin-bottom: 22rpx;
    font-weight: 800;
  }

  .store-address {
    color: #666666;
    font-size: 24rpx;
  }

  .store-phone {
    width: 50rpx;
    height: 50rpx;
    color: #fff;
    border-radius: 50%;
    display: block;
    text-align: center;
    line-height: 48rpx;
    background-color: #e83323;
    margin-bottom: 22rpx;
    text-decoration: none;
  }

  .store-distance {
    font-size: 22rpx;
    color: #e83323;
  }

  .iconfont {
    font-size: 20rpx;
  }

  .row-right {
    flex: 2;
    //display: flex;
    //flex-direction: column;
    //align-items: flex-end;
    //width: 33.5%;
  }
</style>

