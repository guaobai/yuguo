import CryptoJS from 'crypto-js';

export function aesEncrypt(value, secretKey) {
  const key = CryptoJS.enc.Utf8.parse(secretKey);
  const content = CryptoJS.enc.Utf8.parse(value);
  return CryptoJS.AES.encrypt(content, key, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
}
