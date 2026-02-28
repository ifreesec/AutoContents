const axios = require('axios');
const db = require('../db/database');
const { getConfig } = require('./configService');

const FEISHU_API = 'https://open.feishu.cn/open-apis';

let tokenCache = { token: null, expiresAt: 0 };

async function getTenantAccessToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  const appId = getConfig('feishu_app_id');
  const appSecret = getConfig('feishu_app_secret');

  if (!appId || !appSecret) {
    throw new Error('未配置飞书 App ID 或 App Secret');
  }

  const resp = await axios.post(`${FEISHU_API}/auth/v3/tenant_access_token/internal`, {
    app_id: appId,
    app_secret: appSecret,
  });

  if (resp.data.code !== 0) {
    throw new Error(`获取飞书 token 失败: ${resp.data.msg}`);
  }

  tokenCache = {
    token: resp.data.tenant_access_token,
    expiresAt: Date.now() + resp.data.expire * 1000,
  };

  return tokenCache.token;
}

async function getOrCreateDailyDoc(dateStr) {
  // 检查数据库中是否已有今天的文档
  const existing = db.prepare('SELECT * FROM feishu_daily_docs WHERE date = ?').get(dateStr);
  if (existing) return existing;

  const token = await getTenantAccessToken();
  const spaceId = getConfig('feishu_space_id');
  const parentNodeToken = getConfig('feishu_parent_node_token');

  if (!spaceId || !parentNodeToken) {
    throw new Error('未配置飞书知识库 space_id 或 parent_node_token');
  }

  const resp = await axios.post(
    `${FEISHU_API}/wiki/v2/spaces/${spaceId}/nodes`,
    {
      node_type: 'origin',
      obj_type: 'docx',
      parent_node_token: parentNodeToken,
      title: `${dateStr} AI 新闻`,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (resp.data.code !== 0) {
    throw new Error(`创建飞书文档失败: ${resp.data.msg}`);
  }

  const node = resp.data.data.node;
  const doc = {
    date: dateStr,
    node_token: node.node_token,
    obj_token: node.obj_token,
  };

  db.prepare(
    'INSERT OR REPLACE INTO feishu_daily_docs (date, node_token, obj_token) VALUES (?, ?, ?)'
  ).run(doc.date, doc.node_token, doc.obj_token);

  return doc;
}

async function convertMarkdownToBlocks(markdown, token) {
  const resp = await axios.post(
    `${FEISHU_API}/docx/v1/documents/blocks/convert`,
    { content: markdown, content_type: 'markdown' },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (resp.data.code !== 0) {
    throw new Error(`Markdown转换失败: ${resp.data.msg}`);
  }

  return {
    blocks: resp.data.data.blocks,
    firstLevelBlockIds: resp.data.data.first_level_block_ids,
  };
}

async function insertBlocksToDoc(documentId, blocks, childrenIds, token) {
  const resp = await axios.post(
    `${FEISHU_API}/docx/v1/documents/${documentId}/blocks/${documentId}/descendant?document_revision_id=-1`,
    {
      index: 0,
      children_id: childrenIds,
      descendants: blocks,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );

  if (resp.data.code !== 0) {
    throw new Error(`写入飞书文档失败: ${resp.data.msg}`);
  }

  return resp.data;
}

// titleEmoji: 标题前缀 Emoji，如 '🆕'、'💬'、'🛠'
async function saveNewsToFeishu(newsTitle, newsSummary, sourceUrl, titleEmoji = '🆕') {
  const today = new Date().toISOString().split('T')[0];
  const doc = await getOrCreateDailyDoc(today);
  const token = await getTenantAccessToken();

  const markdown = `### ${titleEmoji} ${newsTitle}\n> ${newsSummary}\n- 资讯链接：${sourceUrl}`;

  const { blocks, firstLevelBlockIds } = await convertMarkdownToBlocks(markdown, token);
  await insertBlocksToDoc(doc.node_token, blocks, firstLevelBlockIds, token);

  return { docToken: doc.node_token, date: today };
}

module.exports = { saveNewsToFeishu, getOrCreateDailyDoc };
