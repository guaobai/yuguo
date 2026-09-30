import request from '@/sheep/request';

const PayOrderApi = {
  // 获得支付订单
  getOrder: (id, sync, silent = false) => {
    return request({
      url: '/pay/order/get',
      method: 'GET',
      params: { id, sync },
      custom: { showLoading: !silent, showError: !silent },
    });
  },
  // 提交支付订单
  submitOrder: (data) => {
    return request({
      url: '/pay/order/submit',
      method: 'POST',
      data,
      custom: { showError: false },
    });
  },
};

export default PayOrderApi;
