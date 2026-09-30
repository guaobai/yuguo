const IMAGE_URL_KEY_PATTERN =
  /(?:avatar|logo|icon|image|img|pic|poster|cover|thumbnail|idcard)(?:url|urls)?$/i;
const IMAGE_URL_VALUE_PATTERN =
  /\.(?:apng|avif|bmp|gif|ico|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

/**
 * 微信小程序不支持通过 HTTP 加载网络图片，统一升级为 HTTPS。
 */
export function forceHttps(url = '') {
  if (typeof url !== 'string') {
    return url;
  }
  return url.replace(/^http:\/\//i, 'https://');
}

/**
 * 递归处理接口响应中的图片地址，同时保留普通 HTTP 业务链接。
 */
export function normalizeImageUrls(value, key = '') {
  if (typeof value === 'string') {
    if (
      /^http:\/\//i.test(value) &&
      (IMAGE_URL_KEY_PATTERN.test(key) || IMAGE_URL_VALUE_PATTERN.test(value))
    ) {
      return forceHttps(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeImageUrls(item, key));
  }

  if (value && Object.prototype.toString.call(value) === '[object Object]') {
    Object.keys(value).forEach((itemKey) => {
      value[itemKey] = normalizeImageUrls(value[itemKey], itemKey);
    });
  }

  return value;
}
