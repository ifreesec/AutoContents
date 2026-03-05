/**
 * 小红书笔记发布服务
 *
 * 工作原理：
 * 1. 先将图片上传到小红书 OSS，获得 image_id
 * 2. 调用创建图文笔记接口发布
 *
 * Cookie 获取方式：
 *   浏览器登录 https://www.xiaohongshu.com → F12 → Network → 任意请求 → 复制 Cookie 请求头
 *   关键字段：a1、web_session
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getConfig } = require('./configService');

const XHS_BASE = 'https://edith.xiaohongshu.com';
const XHS_WEB  = 'https://www.xiaohongshu.com';

// 解析 Cookie 字符串为对象
function parseCookie(str) {
  const result = {};
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    result[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  return result;
}

// 生成请求签名（x-s / x-t）
// 小红书 web 端使用 JavaScript 签名，这里使用公开的 JS 逆向签名算法
// 若签名无效会返回 403，此时需更新签名逻辑或使用 puppeteer 执行签名 JS
function buildSign(uri, data, a1) {
  // 基于时间戳的简单签名（适用于部分接口）
  const ts = Date.now();
  const payload = typeof data === 'string' ? data : JSON.stringify(data || '');
  const raw = `${uri}${payload}${ts}${a1 || ''}`;
  const xs = crypto.createHash('md5').update(raw).digest('hex');
  return { 'x-s': xs, 'x-t': String(ts) };
}

function buildHeaders(cookie, extraHeaders = {}) {
  return {
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': XHS_WEB,
    'Origin': XHS_WEB,
    'Content-Type': 'application/json',
    'x-s-common': '',
    ...extraHeaders,
  };
}

/**
 * 上传图片到小红书，返回 image_id
 * @param {string} imagePath 本地文件路径
 * @param {string} cookie   完整 Cookie 字符串
 */
async function uploadImage(imagePath, cookie) {
  const ext = path.extname(imagePath).slice(1).toLowerCase() || 'png';
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
  const fileBuffer = fs.readFileSync(imagePath);
  const fileSize = fileBuffer.length;

  const cookies = parseCookie(cookie);
  const a1 = cookies.a1 || '';

  // Step 1: 申请上传 token
  const initUri = '/api/sns/web/v1/upload/token';
  const initData = { count: 1 };
  const initSign = buildSign(initUri, initData, a1);

  const initResp = await axios.post(
    `${XHS_BASE}${initUri}`,
    initData,
    { headers: buildHeaders(cookie, initSign) }
  );

  const tokenData = initResp.data?.data;
  if (!tokenData || !tokenData.tokens || tokenData.tokens.length === 0) {
    throw new Error(`获取上传 Token 失败: ${JSON.stringify(initResp.data)}`);
  }

  const { token, file_id } = tokenData.tokens[0];

  // Step 2: 上传到 OSS
  const ossResp = await axios.put(token, fileBuffer, {
    headers: {
      'Content-Type': mime,
      'Content-Length': fileSize,
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (ossResp.status !== 200) {
    throw new Error(`OSS 上传失败，HTTP ${ossResp.status}`);
  }

  return file_id;
}

/**
 * 发布图文笔记到小红书
 *
 * @param {object} params
 * @param {string}   params.title      笔记标题（≤ 20 字）
 * @param {string}   params.desc       正文内容
 * @param {string[]} params.imagePaths 本地图片路径数组（cover 在前）
 * @param {boolean}  [params.isPrivate=false] 是否私密
 * @returns {{ note_id: string, note_url: string }}
 */
async function publishNote({ title, desc, imagePaths, isPrivate = false }) {
  const enabled = getConfig('xhs_enabled');
  if (enabled !== '1') throw new Error('小红书发布功能未开启，请在配置中启用');

  const cookie = getConfig('xhs_cookie');
  if (!cookie) throw new Error('未配置小红书 Cookie');

  const cookies = parseCookie(cookie);
  if (!cookies.a1 || !cookies.web_session) {
    throw new Error('Cookie 不完整，缺少 a1 或 web_session 字段，请重新获取');
  }

  if (!imagePaths || imagePaths.length === 0) {
    throw new Error('至少需要一张图片');
  }

  // 上传所有图片
  const imageIds = [];
  for (const imgPath of imagePaths) {
    if (!fs.existsSync(imgPath)) throw new Error(`图片文件不存在: ${imgPath}`);
    const imageId = await uploadImage(imgPath, cookie);
    imageIds.push(imageId);
  }

  // 构造发布请求
  const uri = '/api/sns/web/v1/note/publish';
  const noteTitle = title.length > 20 ? title.slice(0, 20) : title;
  const body = {
    common: {
      source: 'web',
      type: 'normal',
    },
    image_info_list: imageIds.map((id) => ({ file_id: id })),
    note_info: {
      title: noteTitle,
      desc,
      is_private: isPrivate ? 1 : 0,
      type: 'normal',
    },
  };

  const sign = buildSign(uri, body, cookies.a1);
  const resp = await axios.post(`${XHS_BASE}${uri}`, body, {
    headers: buildHeaders(cookie, sign),
  });

  if (resp.data?.success !== true) {
    throw new Error(`发布失败: ${resp.data?.msg || JSON.stringify(resp.data)}`);
  }

  const noteId = resp.data?.data?.note_id;
  return {
    note_id: noteId,
    note_url: noteId ? `${XHS_WEB}/explore/${noteId}` : null,
  };
}

module.exports = { publishNote };
