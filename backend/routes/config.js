const express = require('express');
const router = express.Router();
const { getAllConfig, setMultiConfig } = require('../services/configService');

// 获取所有配置
router.get('/', (req, res) => {
  const config = getAllConfig();
  // 不返回敏感字段明文，只返回是否已配置的标记
  res.json({ success: true, data: config });
});

// 更新配置
router.post('/', (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ success: false, error: '无效的配置数据' });
  }
  setMultiConfig(updates);
  res.json({ success: true });
});

module.exports = router;
