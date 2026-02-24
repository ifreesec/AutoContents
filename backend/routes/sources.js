const express = require('express');
const router = express.Router();
const db = require('../db/database');

// 获取所有信源
router.get('/', (req, res) => {
  const sources = db.prepare('SELECT * FROM sources ORDER BY id').all();
  res.json({ success: true, data: sources });
});

// 新增信源
router.post('/', (req, res) => {
  const { name, type, route, enabled, limit_count, translate } = req.body;
  if (!name || !type || !route) {
    return res.status(400).json({ success: false, error: '缺少必填字段' });
  }
  if (!['rsshub', 'rss'].includes(type)) {
    return res.status(400).json({ success: false, error: 'type 必须是 rsshub 或 rss' });
  }

  const result = db.prepare(`
    INSERT INTO sources (name, type, route, enabled, limit_count, translate)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    name,
    type,
    route,
    enabled ? 1 : 0,
    limit_count || 20,
    translate ? 1 : 0
  );

  const source = db.prepare('SELECT * FROM sources WHERE id = ?').get(result.lastInsertRowid);
  res.json({ success: true, data: source });
});

// 更新信源
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, type, route, enabled, limit_count, translate } = req.body;

  const existing = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ success: false, error: '信源不存在' });
  }

  db.prepare(`
    UPDATE sources SET 
      name = ?, type = ?, route = ?, enabled = ?, 
      limit_count = ?, translate = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    name ?? existing.name,
    type ?? existing.type,
    route ?? existing.route,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    limit_count ?? existing.limit_count,
    translate !== undefined ? (translate ? 1 : 0) : existing.translate,
    id
  );

  const updated = db.prepare('SELECT * FROM sources WHERE id = ?').get(id);
  res.json({ success: true, data: updated });
});

// 删除信源
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  db.prepare('DELETE FROM sources WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
