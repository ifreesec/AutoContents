const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { fetchAllSources, fetchAndUpdateSource } = require('../services/rssService');
const { formatNewsForAINews, formatNewsForAITopics, formatNewsForAITools } = require('../services/llmService');
const { pushAINews } = require('../services/wechatService');
const { saveNewsToFeishu } = require('../services/feishuService');

// 获取资讯列表
router.get('/', (req, res) => {
  const { source_id, page = 1, limit = 30 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query, params;
  if (source_id) {
    query = `
      SELECT n.*, s.name as source_name, s.translate as source_translate
      FROM news n JOIN sources s ON n.source_id = s.id
      WHERE n.hidden = 0 AND n.source_id = ?
      ORDER BY n.pub_date DESC, n.fetched_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [source_id, parseInt(limit), offset];
  } else {
    query = `
      SELECT n.*, s.name as source_name, s.translate as source_translate
      FROM news n JOIN sources s ON n.source_id = s.id
      WHERE n.hidden = 0
      ORDER BY n.pub_date DESC, n.fetched_at DESC
      LIMIT ? OFFSET ?
    `;
    params = [parseInt(limit), offset];
  }

  const news = db.prepare(query).all(...params);
  res.json({ success: true, data: news });
});

// 获取按信源分组的资讯（首页用，已过滤）
router.get('/grouped', (req, res) => {
  const sources = db.prepare('SELECT * FROM sources WHERE enabled = 1 ORDER BY id').all();
  const result = sources.map((source) => {
    const items = db.prepare(`
      SELECT * FROM news 
      WHERE source_id = ? AND hidden = 0 
      ORDER BY pub_date DESC, fetched_at DESC 
      LIMIT 30
    `).all(source.id);
    return { source, items };
  });
  res.json({ success: true, data: result });
});

// 获取原始资讯（未过滤，含 hidden，按信源分组，资源页用）
router.get('/raw', (req, res) => {
  const sources = db.prepare('SELECT * FROM sources ORDER BY id').all();
  const result = sources.map((source) => {
    const items = db.prepare(`
      SELECT * FROM news 
      WHERE source_id = ?
      ORDER BY pub_date DESC, fetched_at DESC 
      LIMIT 50
    `).all(source.id);
    return { source, items };
  });
  res.json({ success: true, data: result });
});

// 获取已保存的资讯列表
router.get('/saved', (req, res) => {
  const items = db.prepare(`
    SELECT n.*, s.name as source_name
    FROM news n JOIN sources s ON n.source_id = s.id
    WHERE n.saved = 1
    ORDER BY n.saved_at DESC
    LIMIT 200
  `).all();
  res.json({ success: true, data: items });
});

// 拉取资讯（全部或指定信源）
router.post('/fetch', async (req, res) => {
  const { source_id } = req.body;
  try {
    let results;
    if (source_id) {
      const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(source_id);
      if (!source) return res.status(404).json({ success: false, error: '信源不存在' });
      const r = await fetchAndUpdateSource(source);
      results = [r];
    } else {
      results = await fetchAllSources();
    }
    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 隐藏/移除资讯
router.post('/:id/hide', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE news SET hidden = 1 WHERE id = ?').run(id);
  res.json({ success: true });
});

// 保存资讯
router.post('/:id/save', (req, res) => {
  const { id } = req.params;
  db.prepare("UPDATE news SET saved = 1, saved_at = datetime('now') WHERE id = ?").run(id);
  res.json({ success: true });
});

// 取消保存资讯
router.post('/:id/unsave', (req, res) => {
  const { id } = req.params;
  db.prepare('UPDATE news SET saved = 0, saved_at = NULL WHERE id = ?').run(id);
  res.json({ success: true });
});

// 通用推送逻辑
async function doPush(id, type) {
  const item = db.prepare('SELECT * FROM news WHERE id = ?').get(id);
  if (!item) throw Object.assign(new Error('资讯不存在'), { status: 404 });

  let formatted;
  let tag;
  let feishuEmoji;

  if (type === 'ainews') {
    formatted = await formatNewsForAINews(item.translated_title || item.title, item.translated_description || item.description);
    tag = '#AINews';
    feishuEmoji = '🆕';
  } else if (type === 'aitopics') {
    formatted = await formatNewsForAITopics(item.translated_title || item.title, item.translated_description || item.description);
    tag = '#AITopic';
    feishuEmoji = '💬';
  } else if (type === 'aitools') {
    formatted = await formatNewsForAITools(item.translated_title || item.title, item.translated_description || item.description);
    tag = '#AITools';
    feishuEmoji = '🛠';
  } else {
    throw new Error('未知推送类型');
  }

  const newsTitle = formatted.news_title;
  const newsSummary = formatted.news_summary;
  const sourceUrl = item.link;

  const [wechatResult, feishuResult] = await Promise.allSettled([
    pushAINews(newsTitle, newsSummary, tag),
    saveNewsToFeishu(newsTitle, newsSummary, sourceUrl, feishuEmoji),
  ]);

  db.prepare('UPDATE news SET ai_newsed = 1 WHERE id = ?').run(id);

  return {
    formatted: { newsTitle, newsSummary },
    wechat: wechatResult.status === 'fulfilled' ? wechatResult.value : { error: wechatResult.reason?.message },
    feishu: feishuResult.status === 'fulfilled' ? feishuResult.value : { error: feishuResult.reason?.message },
  };
}

// 加入 AINews
router.post('/:id/ainews', async (req, res) => {
  try {
    const data = await doPush(req.params.id, 'ainews');
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// 加入 AITopics
router.post('/:id/aitopics', async (req, res) => {
  try {
    const data = await doPush(req.params.id, 'aitopics');
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// 加入 AITools
router.post('/:id/aitools', async (req, res) => {
  try {
    const data = await doPush(req.params.id, 'aitools');
    res.json({ success: true, data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// 获取单条资讯详情
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = db.prepare(`
    SELECT n.*, s.name as source_name 
    FROM news n JOIN sources s ON n.source_id = s.id
    WHERE n.id = ?
  `).get(id);
  if (!item) return res.status(404).json({ success: false, error: '资讯不存在' });
  res.json({ success: true, data: item });
});

module.exports = router;
