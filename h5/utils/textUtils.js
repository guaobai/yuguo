export function measureTextWidth(text, fontSize = 14, fontFamily = 'sans-serif') {
  if (typeof uni === 'undefined' || typeof uni.createCanvasContext !== 'function') {
    return estimateTextWidth(text, fontSize);
  }

  try {
    const ctx = uni.createCanvasContext('tempCanvasForText');
    ctx.setFontSize(fontSize);
    ctx.font = `${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    return metrics.width;
  } catch (e) {
    return estimateTextWidth(text, fontSize);
  }
}

function estimateTextWidth(text, fontSize = 14) {
  let width = 0;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    width += charCode >= 0x4e00 && charCode <= 0x9fff ? fontSize : fontSize * 0.5;
  }
  return width;
}
