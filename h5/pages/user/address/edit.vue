<!-- 收货地址的新增/编辑 -->
<template>
  <s-layout :title="state.model.id ? '编辑地址' : '新增地址'">
    <uni-forms
      ref="addressFormRef"
      v-model="state.model"
      :rules="rules"
      validateTrigger="bind"
      labelWidth="160"
      labelAlign="left"
      border
      :labelStyle="{ fontWeight: 'bold' }"
    >
      <view class="bg-white form-box ss-p-x-30">
        <uni-forms-item name="name" label="收货人" class="form-item">
          <uni-easyinput
            v-model="state.model.name"
            placeholder="请填写收货人姓名"
            :inputBorder="false"
            placeholderStyle="color:#BBBBBB;font-size:30rpx;font-weight:400;line-height:normal"
          />
        </uni-forms-item>

        <uni-forms-item name="mobile" label="手机号" class="form-item">
          <uni-easyinput
            v-model="state.model.mobile"
            type="number"
            placeholder="请输入手机号"
            :inputBorder="false"
            placeholderStyle="color:#BBBBBB;font-size:30rpx;font-weight:400;line-height:normal"
          >
          </uni-easyinput>
        </uni-forms-item>
		<!-- <uni-forms-item name="foreign" label="国外地址">
		  <view class="ss-flex ss-col-center ss-h-100">
		    <radio-group @change="onChangeGender" class="ss-flex ss-col-center">
		      <label class="radio" v-for="item in foreignRadioMap" :key="item.value">
		        <view class="ss-flex ss-col-center ss-m-r-32">
		          <radio
		            :value="item.value"
		            color="var(--ui-BG-Main)"
		            style="transform: scale(0.8)"
		            :checked="parseInt(item.value) === state.model?.foreign"
		          />
		          <view class="gender-name">{{ item.name }}</view>
		        </view>
		      </label>
		    </radio-group>
		  </view>
		</uni-forms-item> -->
		  <!-- v-if="state.model.foreign == 1" -->
        <uni-forms-item
          name="areaName"
          label="省市区"
          @tap="openRegionPicker"
          class="form-item"
        >
          <view
            class="region-selector ss-flex ss-row-between ss-col-center"
            @tap.stop="openRegionPicker"
          >
            <text
              class="region-selector__text"
              :class="{ 'region-selector__placeholder': !state.model.areaName }"
            >
              {{ state.model.areaName || '请选择省市区' }}
            </text>
            <uni-icons type="right" />
          </view>
        </uni-forms-item>
        <uni-forms-item
          name="detailAddress"
          label="详细地址"
          :formItemStyle="{ alignItems: 'flex-start' }"
          :labelStyle="{ lineHeight: '5em' }"
          class="textarea-item"
        >
          <uni-easyinput
            :inputBorder="false"
            type="textarea"
            v-model="state.model.detailAddress"
            placeholderStyle="color:#BBBBBB;font-size:30rpx;font-weight:400;line-height:normal"
            placeholder="请输入详细地址"
            clearable
          />
        </uni-forms-item>
      </view>
      <view class="ss-m-y-20 bg-white ss-p-x-30 ss-flex ss-row-between ss-col-center default-box">
        <view class="default-box-title"> 设为默认地址 </view>
        <su-switch style="transform: scale(0.8)" v-model="state.model.defaultStatus" />
      </view>
    </uni-forms>
    <su-fixed bottom :opacity="false" bg="" placeholder :noFixed="false" :index="10">
      <view class="footer-box ss-flex-col ss-row-between ss-p-20">
        <view class="ss-m-b-20">
          <button class="ss-reset-button save-btn ui-Shadow-Main" @tap="onSave">保存</button>
        </view>
        <button v-if="state.model.id" class="ss-reset-button cancel-btn" @tap="onDelete">
          删除
        </button>
      </view>
    </su-fixed>

    <!-- 省市区弹窗 -->
    <su-region-picker
      :show="state.showRegion"
      @cancel="state.showRegion = false"
      @confirm="onRegionConfirm"
    />
  </s-layout>
</template>

<script setup>
  import { ref, reactive, unref } from 'vue';
  import sheep from '@/sheep';
  import { onLoad } from '@dcloudio/uni-app';
  import { resolveWechatAddress } from '@/sheep/util/wechat-address';
  import { mobile } from '@/sheep/validate/form';
  import AreaApi from '@/sheep/api/system/area';
  import AddressApi from '@/sheep/api/member/address';

  const addressFormRef = ref(null);
  const state = reactive({
    showRegion: false,
    model: {
      name: '',
      mobile: '',
      detailAddress: '',
      defaultStatus: false,
      areaName: '',
	  foreign: 1,
    },
    rules: {},
  });

  const foreignRadioMap = [
    {
      name: '否',
      value: '1'
    },
    {
      name: '是',
      value: '2',
    },
  ];
  
  // 选择性别
  function onChangeGender(e) {
    state.model.foreign = e.detail.value;
  }
  
  const rules = {
    name: {
      rules: [
        {
          required: true,
          errorMessage: '请输入收货人姓名',
        },
      ],
    },
    mobile,
    detailAddress: {
      rules: [
        {
          required: true,
          errorMessage: '请输入详细地址',
        },
      ],
    },
    areaName: {
      rules: [
        {
          required: true,
          errorMessage: '请选择您的位置',
        },
      ],
    },
  };

  const openRegionPicker = () => {
    state.showRegion = true;
  };

  // 确认选择地区
  const onRegionConfirm = (e) => {
    state.model.areaName = `${e.province_name} ${e.city_name} ${e.district_name}`;
    state.model.areaId = e.district_id;
    unref(addressFormRef)?.setValue('areaName', state.model.areaName);
    state.showRegion = false;
  };

  // 获得地区数据
  const getAreaData = async () => {
    const cached = uni.getStorageSync('areaData');
    if (Array.isArray(cached) && cached.length) return cached;
    try {
      const response = await AreaApi.getAreaTree();
      if (response?.code === 0 && Array.isArray(response.data)) {
        uni.setStorageSync('areaData', response.data);
        return response.data;
      }
    } catch {}
    return [];
  };

  // 保存收货地址
  const onSave = async () => {
    // 参数校验
    const validate = await unref(addressFormRef)
      .validate()
      .catch((error) => {
        console.log('error: ', error);
      });
    if (!validate) {
      return;
    }

    // 提交请求
    const formData = {
      ...state.model,
    };
    const { code } =
      state.model.id > 0
        ? await AddressApi.updateAddress(formData)
        : await AddressApi.createAddress(formData);
    if (code === 0) {
      sheep.$router.back();
    }
  };

  // 删除收货地址
  const onDelete = () => {
    uni.showModal({
      title: '提示',
      content: '确认删除此收货地址吗？',
      success: async function (res) {
        if (!res.confirm) {
          return;
        }
        const { code } = await AddressApi.deleteAddress(state.model.id);
        if (code === 0) {
          sheep.$router.back();
        }
      },
    });
  };

  onLoad(async (options) => {
    // 获得地区数据
    const areasPromise = getAreaData();
    // 情况一：基于 id 获得收件地址
    if (options.id) {
      let { code, data } = await AddressApi.getAddress(options.id);
      if (code !== 0) {
        return;
      }
      state.model = data;
    }
    // 情况二：微信导入
    if (options.data) {
      let data;
      try {
        data = JSON.parse(options.data);
      } catch {
        sheep.$helper.toast('地址信息无效，请重新导入');
        return;
      }
      state.model = { ...state.model, ...resolveWechatAddress(await areasPromise, data || {}) };
      if (!state.model.areaId) {
        sheep.$helper.toast('已保留收件信息，请手动选择省市区');
      }
    }
  });
</script>

<style lang="scss" scoped>
  :deep() {
    .uni-forms-item__label .label-text {
      font-size: 28rpx !important;
      color: #333333 !important;
      line-height: normal !important;
    }

    .uni-easyinput__content-input {
      font-size: 28rpx !important;
      color: #333333 !important;
      line-height: normal !important;
      padding-left: 0 !important;
    }

    .uni-easyinput__content-textarea {
      font-size: 28rpx !important;
      color: #333333 !important;
      line-height: normal !important;
      margin-top: 8rpx !important;
    }

    .uni-icons {
      font-size: 40rpx !important;
    }

    .is-textarea-icon {
      margin-top: 22rpx;
    }

    .is-disabled {
      color: #333333;
    }
  }

  .default-box {
    width: 100%;
    box-sizing: border-box;
    height: 100rpx;

    .default-box-title {
      font-size: 28rpx;
      color: #333333;
      line-height: normal;
    }
  }

  .region-selector {
    width: 100%;
    min-height: 100rpx;
    box-sizing: border-box;

    .region-selector__text {
      flex: 1;
      min-width: 0;
      font-size: 28rpx;
      color: #333333;
      line-height: normal;
    }

    .region-selector__placeholder {
      color: #bbbbbb;
      font-size: 30rpx;
      font-weight: 400;
    }
  }

  .footer-box {
    .save-btn {
      width: 710rpx;
      height: 80rpx;
      border-radius: 40rpx;
      background: linear-gradient(90deg, var(--ui-BG-Main), var(--ui-BG-Main-gradient));
      color: $white;
    }

    .cancel-btn {
      width: 710rpx;
      height: 80rpx;
      border-radius: 40rpx;
      background: var(--ui-BG);
    }
  }
</style>
