import sheep from '@/sheep';
// #ifdef H5
import $wxsdk from '@/sheep/libs/sdk-h5-weixin';
// #endif
import { getRootUrl } from '@/sheep/helper';
import PayOrderApi from '@/sheep/api/pay/order';

// 同一支付单在唤起收银台到收到结果期间只允许一条支付流程。
const activePayments = new Map();

export default class SheepPay {
  constructor(payment, orderType, id) {
    this.payment = payment;
    this.id = id;
    this.orderType = orderType;
    const key = String(id);
    if (activePayments.has(key)) {
      this.promise = activePayments.get(key);
      return;
    }
    this.promise = Promise.resolve().then(() => this.payAction()).catch((error) => {
      sheep.$helper.toast(error?.message || error?.errMsg || '暂时无法支付，请重试');
      return false;
    }).finally(() => activePayments.delete(key));
    activePayments.set(key, this.promise);
  }

  payAction() {
    const actions = {
      WechatOfficialAccount: { wechat: 'wechatOfficialAccountPay', alipay: 'redirectPay' },
      WechatMiniProgram: { wechat: 'wechatMiniProgramPay', alipay: 'copyPayLink' },
      H5: { wechat: 'wechatWapPay', alipay: 'redirectPay' },
      App: { wechat: 'wechatAppPay', alipay: 'alipay' },
    };
    const method = this.payment === 'wallet' ? 'walletPay'
      : this.payment === 'mock' ? 'mockPay'
      : actions[sheep.$platform.name]?.[this.payment];
    if (!method || typeof this[method] !== 'function') {
      throw new Error('当前环境暂不支持此支付方式');
    }
    return this[method]();
  }

  async prepay(channel) {
    const data = { id: this.id, channelCode: channel, channelExtras: {} };
    if (['wx_pub', 'wx_lite'].includes(channel)) {
      const openid = await sheep.$platform.useProvider('wechat').getOpenid();
      if (!openid) {
        await this.bindWeixin();
        return null;
      }
      data.channelExtras.openid = openid;
    }
    const response = await PayOrderApi.submitOrder(data);
    if (response?.code === 0 && response.data) return response;
    const message = response?.msg || '预支付失败，请重试';
    if (/无效的\s*openid|openid.*(?:invalid|无效)|下单账号与支付账号不一致/i.test(message)) {
      await this.bindWeixin();
      return null;
    }
    throw new Error(message);
  }

  // #ifdef H5
  async wechatOfficialAccountPay() {
    await $wxsdk.init();
    const response = await this.prepay('wx_pub');
    if (!response) return false;
    const config = JSON.parse(response.data.displayContent);
    try {
      await $wxsdk.wxpay(config);
      this.payResult('success');
      return true;
    } catch (error) {
      return this.handleWechatResult(error);
    }
  }

  async wechatWapPay() {
    const response = await this.prepay('wx_wap');
    if (!response) return false;
    const target = new URL(response.data.displayContent);
    const returnUrl = getRootUrl() + 'pages/pay/result?id=' + encodeURIComponent(this.id)
      + '&orderType=' + encodeURIComponent(this.orderType);
    target.searchParams.set('redirect_url', returnUrl);
    location.assign(target.href);
    return true;
  }

  async redirectPay() {
    const response = await this.prepay('alipay_wap');
    if (!response) return false;
    location.assign(response.data.displayContent);
    return true;
  }
  // #endif

  async wechatMiniProgramPay() {
    const response = await this.prepay('wx_lite');
    if (!response) return false;
    const config = JSON.parse(response.data.displayContent);
    try {
      await this.nativePay({
        provider: 'wxpay', timeStamp: config.timeStamp, nonceStr: config.nonceStr,
        package: config.packageValue || config.package, signType: config.signType, paySign: config.paySign,
      });
      this.payResult('success');
      return true;
    } catch (error) {
      return this.handleWechatResult(error);
    }
  }

  nativePay(options) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('支付结果尚未确认')), 120000);
      uni.requestPayment({
        ...options,
        success: (result) => { clearTimeout(timer); resolve(result); },
        fail: (error) => { clearTimeout(timer); reject(error); },
      });
    });
  }

  handleWechatResult(error) {
    if (error?.cancelled || /cancel/i.test(error?.errMsg || '')) {
      sheep.$helper.toast('支付已取消，可重新支付');
      return false;
    }
    sheep.$helper.toast('暂未确认支付结果，正在查询订单');
    this.payResult('pending');
    return false;
  }

  async walletPay() {
    const response = await this.prepay('wallet');
    if (!response) return false;
    this.payResult('success');
    return true;
  }

  async mockPay() {
    const response = await this.prepay('mock');
    if (!response) return false;
    this.payResult('success');
    return true;
  }

  async copyPayLink() {
    const response = await this.prepay('alipay_wap');
    if (!response) return false;
    const result = await uni.showModal({ title: '支付宝支付', content: '复制链接到外部浏览器', confirmText: '复制链接' });
    if (result.confirm) sheep.$helper.copyText(response.data.displayContent);
    return false;
  }

  async alipay() {
    const response = await this.prepay('alipay_app');
    if (!response) return false;
    try {
      await this.nativePay({ provider: 'alipay', orderInfo: response.data.displayContent });
      this.payResult('success');
      return true;
    } catch (error) { return this.handleWechatResult(error); }
  }

  async wechatAppPay() {
    const response = await this.prepay('wx_app');
    if (!response) return false;
    try {
      await this.nativePay({ provider: 'wxpay', orderInfo: JSON.parse(response.data.displayContent) });
      this.payResult('success');
      return true;
    } catch (error) { return this.handleWechatResult(error); }
  }

  payResult(resultType) {
    goPayResult(this.id, this.orderType, resultType);
  }

  async bindWeixin() {
    const result = await uni.showModal({
      title: '微信支付',
      content: '需要关联当前微信后支付，是否现在关联？',
      confirmText: '关联微信',
    });
    if (!result.confirm) return false;
    const bound = await sheep.$platform.useProvider('wechat').bind();
    if (bound === true) sheep.$helper.toast('关联成功，请重新支付');
    return false;
  }
}

export function getPayMethods(channels) {
  const payMethods = [
    {
      icon: '/static/img/shop/pay/wechat.png',
      title: '微信支付',
      value: 'wechat',
      disabled: true,
    },
    {
      icon: '/static/img/shop/pay/alipay.png',
      title: '支付宝支付',
      value: 'alipay',
      disabled: true,
    },
    {
      icon: '/static/img/shop/pay/wallet.png',
      title: '余额支付',
      value: 'wallet',
      disabled: true,
    },
    {
      icon: '/static/img/shop/pay/apple.png',
      title: 'Apple Pay',
      value: 'apple',
      disabled: true,
    },
    {
      icon: '/static/img/shop/pay/wallet.png',
      title: '模拟支付',
      value: 'mock',
      disabled: true,
    },
  ];
  const platform = sheep.$platform.name;

  // 1. 处理【微信支付】
  const wechatMethod = payMethods[0];
  if (
    (platform === 'WechatOfficialAccount' && channels.includes('wx_pub')) ||
    (platform === 'WechatMiniProgram' && channels.includes('wx_lite')) ||
    (platform === 'H5' && channels.includes('wx_wap')) ||
    (platform === 'App' && channels.includes('wx_app'))
  ) {
    wechatMethod.disabled = false;
  }

  // 2. 处理【支付宝支付】
  const alipayMethod = payMethods[1];
  if (
    (platform === 'H5' && channels.includes('alipay_wap')) ||
    (platform === 'WechatOfficialAccount' && channels.includes('alipay_wap')) ||
    (platform === 'WechatMiniProgram' && channels.includes('alipay_wap')) ||
    (platform === 'App' && channels.includes('alipay_app'))
  ) {
    alipayMethod.disabled = false;
  }
  // 3. 处理【余额支付】
  const walletMethod = payMethods[2];
  if (channels.includes('wallet')) {
    walletMethod.disabled = false;
  }
  // 4. 处理【苹果支付】TODO 芋艿：未来接入
  // 5. 处理【模拟支付】
  const mockMethod = payMethods[4];
  if (channels.includes('mock')) {
    mockMethod.disabled = false;
  }
  return payMethods;
}

// 支付结果跳转,success:成功，fail:失败
export function goPayResult(id, orderType, resultType) {
  sheep.$router.redirect('/pages/pay/result', {
    id,
    orderType,
    payState: resultType,
  });
}

