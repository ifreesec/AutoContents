const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.join(__dirname, '../uploads/rendered');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// cover 尺寸 1080x1440
const COVER_W = 1080;
const COVER_H = 1440;
const BG_COLOR = '#1E2028';
const ACCENT_COLOR = '#06FFA5';

function fitText(ctx, text, maxWidth, maxFontSize, minFontSize = 10, fontWeight = '900', fontFamily = 'sans-serif') {
  let size = maxFontSize;
  while (size >= minFontSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) break;
    size--;
  }
  return size;
}

function fitTextMultiline(ctx, text, maxWidth, maxHeight, maxFontSize, minFontSize = 10, fontWeight = '900', fontFamily = 'sans-serif') {
  let size = maxFontSize;
  while (size >= minFontSize) {
    ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
    const lines = wrapText(ctx, text, maxWidth, size);
    const totalH = lines.length * size * 1.2;
    if (totalH <= maxHeight) break;
    size--;
  }
  return size;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split('');
  const lines = [];
  let current = '';
  for (const ch of words) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function renderCover({ cover_word, cover_title, cover_description, cover_emoji }, sessionId) {
  const canvas = createCanvas(COVER_W, COVER_H);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  // cover_word (left=90, top=140, width=700, single line)
  {
    const fontSize = fitText(ctx, cover_word, 700, 150, 10, '900');
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.fillStyle = '#8E8E8E';
    ctx.textBaseline = 'top';
    ctx.fillText(cover_word, 90, 140);
  }

  // cover_title (left=90, top=330, width=900, height=600)
  {
    const fontSize = fitTextMultiline(ctx, cover_title, 900, 600, 150, 10, '900');
    ctx.font = `900 ${fontSize}px sans-serif`;
    ctx.fillStyle = ACCENT_COLOR;
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, cover_title, 900);
    const lineH = fontSize * 1.1;
    const totalH = lines.length * lineH;
    const startY = 330 + (600 - totalH) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, 90, startY + i * lineH);
    });
  }

  // cover_description (left=90, top=951, width=900, height=200)
  {
    const fontSize = fitTextMultiline(ctx, cover_description, 900, 200, 80, 10, '400');
    ctx.font = `400 ${fontSize}px sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';
    const lines = wrapText(ctx, cover_description, 900);
    const lineH = fontSize * 1.2;
    const totalH = lines.length * lineH;
    const startY = 951 + (200 - totalH) / 2;
    lines.forEach((line, i) => {
      ctx.fillText(line, 90, startY + i * lineH);
    });
  }

  // cover_emoji (left=690, top=1097, size=300, opacity=0.5)
  {
    ctx.globalAlpha = 0.5;
    ctx.font = '250px serif';
    ctx.textBaseline = 'top';
    ctx.fillText(cover_emoji, 700, 1100);
    ctx.globalAlpha = 1.0;
  }

  const outPath = path.join(OUTPUT_DIR, `${sessionId}_cover.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

async function renderDetail(imagePath, sessionId, index) {
  const DETAIL_W = 1080;
  const DETAIL_H = 1440;
  const PADDING = 80;

  const canvas = createCanvas(DETAIL_W, DETAIL_H);
  const ctx = canvas.getContext('2d');

  // 背景
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, DETAIL_W, DETAIL_H);

  // 加载图片
  const img = await loadImage(imagePath);
  const imgW = img.width;
  const imgH = img.height;

  const maxW = DETAIL_W - PADDING * 2;
  const maxH = DETAIL_H - PADDING * 2;

  const scaleX = maxW / imgW;
  const scaleY = maxH / imgH;
  const scale = Math.min(scaleX, scaleY, 1);

  const finalW = imgW * scale;
  const finalH = imgH * scale;
  const x = (DETAIL_W - finalW) / 2;
  const y = (DETAIL_H - finalH) / 2;

  // 阴影/装饰
  ctx.shadowColor = ACCENT_COLOR;
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 20;
  ctx.shadowOffsetY = 20;

  // 圆角裁剪
  const radius = 50;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + finalW - radius, y);
  ctx.arcTo(x + finalW, y, x + finalW, y + radius, radius);
  ctx.lineTo(x + finalW, y + finalH - radius);
  ctx.arcTo(x + finalW, y + finalH, x + finalW - radius, y + finalH, radius);
  ctx.lineTo(x + radius, y + finalH);
  ctx.arcTo(x, y + finalH, x, y + finalH - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.clip();

  ctx.drawImage(img, x, y, finalW, finalH);

  const outPath = path.join(OUTPUT_DIR, `${sessionId}_detail_${index}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

module.exports = { renderCover, renderDetail, OUTPUT_DIR };
