// #ifdef H5
import wxsdk from '@/sheep/libs/sdk-h5-weixin';
// #endif

function invoke(method, options) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('定位服务超时，请重试')), 20000);
    uni[method]({
      ...options,
      success: (result) => { clearTimeout(timer); resolve(result); },
      fail: (error) => { clearTimeout(timer); reject(error); },
    });
  });
}

export function getLocation() {
  // #ifdef H5
  if (wxsdk.isWechat()) return wxsdk.getLocation();
  // #endif
  return invoke('getLocation', { type: 'gcj02' });
}

export function openLocation(value) {
  const latitude = value.latitude === '' || value.latitude == null ? NaN : Number(value.latitude);
  const longitude = value.longitude === '' || value.longitude == null ? NaN : Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Promise.reject(new Error('门店位置信息不完整，请联系门店'));
  }
  const options = { ...value, latitude, longitude };
  // #ifdef H5
  if (wxsdk.isWechat()) return wxsdk.openLocation(options);
  // #endif
  return invoke('openLocation', options);
}

export function locationErrorMessage(error) {
  const message = error?.errMsg || error?.message || '';
  if (/auth|deny|denied|permission|cancel|拒绝|取消/i.test(message)) {
    return '未获得定位权限。可直接选择门店，或开启微信和系统定位权限后重试。';
  }
  return '暂时无法定位。可直接选择门店，或检查网络和系统定位服务后重试。';
}
