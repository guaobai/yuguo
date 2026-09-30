// 仅显式打开诊断链接时在本机显示；不上传信息，不记录凭据或签名。
const enabled = new URLSearchParams(window.location.search).get('wechatShareDebug') === '1';
const results = {};
let output;

export function shareDebug(step, message) {
  if (!enabled) return;
  results[step] = String(message).replace(/https?:\/\/[^\s"']+/g, (value) => value.split(/[?#]/)[0]);
  if (!document.body) return;
  if (!output) {
    const panel = document.createElement('details');
    panel.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;z-index:99999;background:#fff;color:#222;border:1px solid #aaa;border-radius:8px;padding:10px;font-size:13px;box-shadow:0 2px 12px #0003';
    const title = document.createElement('summary');
    title.textContent = '微信分享诊断（点击展开）';
    panel.appendChild(title);
    output = document.createElement('pre');
    output.style.cssText = 'white-space:pre-wrap;word-break:break-word;max-height:50vh;overflow:auto;font:12px/1.7 monospace;margin:8px 0 0';
    panel.appendChild(output);
    document.body.appendChild(panel);
  }
  output.textContent = '版本：20260915-menu\n' + Object.entries(results).map(([key, value]) => `${key}：${value}`).join('\n');
}
