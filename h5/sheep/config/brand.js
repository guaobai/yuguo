import { h5Url } from '@/sheep/config';

export const SHOP_NAME = '娱果商城';
// 使用本站公开 HTTPS 图片，避免相对路径被拼接到第三方素材 CDN。
export const SHARE_LOGO = `${h5Url.replace(/\/$/, '')}/static/share/yuguo-logo-edb98138.png`;
