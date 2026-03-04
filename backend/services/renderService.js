const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ── 字体路径解析 ─────────────────────────────────────────────────────────────
// Noto Sans SC：优先本地安装路径，本地找不到才用 Google Fonts URL
// Apple Color Emoji：macOS 用系统字体，Linux/Windows 用项目 fonts/ 目录里的 .ttf
const FONTS_DIR = path.join(__dirname, '../../fonts');

// Noto Sans SC 本地路径候选（Docker 安装 fonts-noto-cjk 后的路径）
const NOTO_CANDIDATES = [
  '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
  '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
  '/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc',
  // macOS 系统字体（有就直接用 local()，不用 @font-face）
];

// Apple Color Emoji 候选（安装到系统字体目录后可 local() 直接用）
const EMOJI_SYSTEM_CANDIDATES = [
  '/usr/local/share/fonts/AppleColorEmoji.ttf',   // Dockerfile 安装位置
  '/usr/share/fonts/AppleColorEmoji.ttf',
  '/Library/Fonts/Apple Color Emoji.ttc',         // macOS
  path.join(os.homedir(), 'Library/Fonts/Apple Color Emoji.ttc'),
];

// 项目 fonts/ 目录里的字体（fallback，作为 @font-face file:// 引用）
const EMOJI_PROJECT_CANDIDATES = [
  path.join(FONTS_DIR, 'AppleColorEmoji-Linux.ttf'),
  path.join(FONTS_DIR, 'AppleColorEmoji-Windows.ttf'),
];

function findFile(candidates) {
  return candidates.find((p) => fs.existsSync(p)) || null;
}

// 模块加载时确定字体策略，避免每次渲染重复 I/O
const EMOJI_SYSTEM_PATH = findFile(EMOJI_SYSTEM_CANDIDATES);
const EMOJI_PROJECT_PATH = !EMOJI_SYSTEM_PATH ? findFile(EMOJI_PROJECT_CANDIDATES) : null;

// 生成 cover HTML 里的字体 CSS
function getFontCSS() {
  let css = '';

  // Emoji 字体：系统已安装 → local()；否则 file:// 引用项目字体
  if (EMOJI_SYSTEM_PATH) {
    css += `
    @font-face {
      font-family: 'Apple Color Emoji';
      src: local('Apple Color Emoji'), url('file://${EMOJI_SYSTEM_PATH}') format('truetype');
    }`;
  } else if (EMOJI_PROJECT_PATH) {
    css += `
    @font-face {
      font-family: 'Apple Color Emoji';
      src: url('file://${EMOJI_PROJECT_PATH}') format('truetype');
    }`;
  }

  return css;
}

const OUTPUT_DIR = process.env.RENDER_OUTPUT_DIR || path.join(__dirname, '../uploads/rendered');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Chrome/Chromium 路径：优先用环境变量，其次 macOS 默认，最后 Linux apt 路径
const CHROME_PATH =
  process.env.CHROME_PATH ||
  (() => {
    const fs = require('fs');
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/chromium',          // Debian/Ubuntu apt
      '/usr/bin/chromium-browser',  // 部分发行版
      '/usr/bin/google-chrome',     // Linux Chrome
    ];
    return candidates.find((p) => fs.existsSync(p)) || candidates[0];
  })();

let browserInstance = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: [
      '--no-sandbox',                  // 容器内必须
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',       // 避免共享内存不足崩溃
      '--disable-gpu',
      '--font-render-hinting=none',
      '--disable-extensions',
      '--disable-background-networking',
    ],
  });
  browserInstance.on('disconnected', () => { browserInstance = null; });
  return browserInstance;
}

async function screenshotHTML(html, width, height) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width, height, deviceScaleFactor: 1 });
    // domcontentloaded 避免等待任何网络请求（字体走本地 file:// 不算网络）
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    // 等待字体（本地 file:// 字体加载极快）及脚本执行完毕
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return buffer;
  } finally {
    await page.close();
  }
}

async function renderCover({ cover_word, cover_title, cover_description, cover_emoji, cover_title_color }, sessionId) {
  const titleColor = cover_title_color || '#06FFA5';
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    ${getFontCSS()}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1440px; overflow: hidden; background: #1E2028; }

    .cover { position: relative; width: 1080px; height: 1440px; background: #1E2028; overflow: hidden; }

    .cover_word {
      position: absolute; width: 700px; left: 90px; top: 140px;
      font-family: 'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-weight: 900; color: #8E8E8E;
      white-space: nowrap; transform-origin: left center;
    }
    .cover_title {
      position: absolute; width: 900px; height: 600px; left: 90px; top: 330px;
      font-family: 'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-weight: 900; color: ${escHtml(titleColor)};
      display: flex; align-items: center; justify-content: flex-start; overflow: hidden;
    }
    .cover_title span { display: block; width: 100%; line-height: 1.1; }
    .cover_description {
      position: absolute; width: 900px; height: 200px; left: 90px; top: 951px;
      font-family: 'Noto Sans CJK SC', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
      font-weight: 400; color: #FFFFFF;
      display: flex; align-items: center; justify-content: flex-start; overflow: hidden;
    }
    .cover_description span { display: block; width: 100%; line-height: 1.2; }
    .cover_emoji {
      position: absolute; width: 300px; height: 300px; left: 690px; top: 1097px;
      font-family: 'Apple Color Emoji', sans-serif;
      font-size: 240px; line-height: 300px; opacity: 0.5;
      display: flex; align-items: center; justify-content: center;
    }
  </style>
</head>
<body>
  <div class="cover">
    <div class="cover_word" id="coverWord">${escHtml(cover_word)}</div>
    <div class="cover_title" id="coverTitle"><span>${escHtml(cover_title)}</span></div>
    <div class="cover_description" id="coverDesc"><span>${escHtml(cover_description)}</span></div>
    <div class="cover_emoji">${escHtml(cover_emoji)}</div>
  </div>
  <script>
    function fitText(el, maxW, maxH, maxSize) {
      let size = maxSize;
      if (!maxH) {
        el.style.fontSize = size + 'px';
        while (el.scrollWidth > maxW && size > 10) { size--; el.style.fontSize = size + 'px'; }
      } else {
        const span = el.querySelector('span');
        span.style.fontSize = size + 'px';
        while ((span.scrollWidth > maxW || span.scrollHeight > maxH) && size > 10) {
          size--; span.style.fontSize = size + 'px';
        }
      }
    }
    fitText(document.getElementById('coverWord'), 700, null, 150);
    fitText(document.getElementById('coverTitle'), 900, 600, 150);
    fitText(document.getElementById('coverDesc'), 900, 200, 80);
  </script>
</body>
</html>`;

  const buffer = await screenshotHTML(html, 1080, 1440);
  const outPath = path.join(OUTPUT_DIR, `${sessionId}_cover.png`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

async function renderDetail(imagePath, sessionId, index, shadowColor) {
  const color = shadowColor || '#06FFA5';
  // 把图片转为 base64 内嵌（避免 file:// 协议跨域问题）
  const imgBase64 = fs.readFileSync(imagePath).toString('base64');
  const ext = path.extname(imagePath).slice(1).replace('jpg', 'jpeg');
  const imgSrc = `data:image/${ext};base64,${imgBase64}`;

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: 1080px; height: 1440px; overflow: hidden; background: #1E2028;
           display: flex; align-items: center; justify-content: center; }
    .image-container {
      position: relative;
      box-shadow: 20px 20px 0px ${escHtml(color)};
      border-radius: 50px;
      overflow: hidden;
    }
    .image-container img {
      display: block; width: 100%; height: 100%;
      object-fit: contain; border-radius: 50px;
    }
  </style>
</head>
<body>
  <div class="image-container" id="imgContainer">
    <img src="${imgSrc}" id="img" />
  </div>
  <script>
    const img = document.getElementById('img');
    const container = document.getElementById('imgContainer');
    function adjust() {
      const maxW = 1080 - 80 * 2;
      const maxH = 1440 - 80 * 2;
      const iw = img.naturalWidth || 920;
      const ih = img.naturalHeight || 1280;
      const scale = Math.min(maxW / iw, maxH / ih, 1);
      container.style.width = (iw * scale) + 'px';
      container.style.height = (ih * scale) + 'px';
    }
    if (img.complete) adjust(); else img.onload = adjust;
  </script>
</body>
</html>`;

  const buffer = await screenshotHTML(html, 1080, 1440);
  const outPath = path.join(OUTPUT_DIR, `${sessionId}_detail_${index}.png`);
  fs.writeFileSync(outPath, buffer);
  return outPath;
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 截取外部 URL 页面截图，并按需裁切为多张 3:4 图片
 * 宽高比 < 3:4（即很长的页面）→ 裁切为 N 张 3:4 的图
 * 宽高比 ≥ 3:4 → 直接整张截图
 * 返回本地文件路径数组
 */
async function screenshotUrl(url, sessionId) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const TARGET_W = 1080;
  const TARGET_H = 1440; // 3:4 比例

  try {
    await page.setViewport({ width: TARGET_W, height: TARGET_H, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);

    // 获取实际页面高度
    const fullHeight = await page.evaluate(() => document.body.scrollHeight);
    const ratio = TARGET_W / fullHeight; // width/height

    const paths = [];

    if (ratio >= 3 / 4) {
      // 宽高比 ≥ 3:4，整张截图缩放到 1080×1440
      const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: TARGET_W, height: Math.min(fullHeight, TARGET_H) } });
      const outPath = path.join(OUTPUT_DIR, `${sessionId}_screenshot_0.png`);
      fs.writeFileSync(outPath, buffer);
      paths.push(outPath);
    } else {
      // 页面很长，每 TARGET_H px 裁一张（最多 5 张）
      const sliceCount = Math.min(Math.ceil(fullHeight / TARGET_H), 5);
      await page.setViewport({ width: TARGET_W, height: fullHeight, deviceScaleFactor: 1 });
      // 重新等待避免重排
      await new Promise((r) => setTimeout(r, 500));

      for (let i = 0; i < sliceCount; i++) {
        const y = i * TARGET_H;
        const sliceH = Math.min(TARGET_H, fullHeight - y);
        if (sliceH < 200) break; // 太短的尾部忽略
        const buffer = await page.screenshot({ type: 'png', clip: { x: 0, y, width: TARGET_W, height: sliceH } });
        // 如不足 TARGET_H，用白色背景补全
        const outPath = path.join(OUTPUT_DIR, `${sessionId}_screenshot_${i}.png`);
        fs.writeFileSync(outPath, buffer);
        paths.push(outPath);
      }
    }

    return paths;
  } finally {
    await page.close();
  }
}

// 进程退出时关闭浏览器
process.on('exit', () => { if (browserInstance) browserInstance.close(); });

module.exports = { renderCover, renderDetail, screenshotUrl, OUTPUT_DIR };
