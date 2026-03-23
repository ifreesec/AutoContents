const axios = require('axios');
const { getLLMConfig } = require('./configService');

// 直接用传入的配置对象调用 LLM（用于 AITopics/AITools 复用 edit 模型但换提示词）
async function callLLMWithOverride({ model, baseUrl, apiKey, sysPrompt }, userContent, schema = null) {
  if (!apiKey || !model) throw new Error('LLM 配置不完整：API Key 或模型名称未配置');

  const base = (baseUrl || 'https://api.openai.com').replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const url = `${base}/v1/chat/completions`;

  let systemPrompt = sysPrompt;
  if (schema) {
    const fieldDescs = Object.entries(schema.properties)
      .map(([k, v]) => `- ${k}：${v.description}`)
      .join('\n');
    systemPrompt = `${sysPrompt}\n\n请严格以 JSON 格式输出，包含以下字段：\n${fieldDescs}\n\n只输出 JSON，不要有任何其他文字。`;
  }

  const body = { model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }], temperature: 0.7 };
  if (schema) body.response_format = { type: 'json_object' };

  const resp = await axios.post(url, body, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 60000,
  });

  const content = resp.data.choices[0].message.content;
  if (schema) {
    try {
      return JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim());
    } catch { return content; }
  }
  return content;
}

async function callLLM(type, userContent, schema = null) {
  const { model, baseUrl, apiKey, sysPrompt } = getLLMConfig(type);

  if (!apiKey || !model) {
    throw new Error(`LLM 配置不完整：${type} 模型未配置 API Key 或模型名称`);
  }

  // 去掉末尾的 /v1 或 / 避免重复拼接
  const base = (baseUrl || 'https://api.openai.com').replace(/\/v1\/?$/, '').replace(/\/$/, '');
  const url = `${base}/v1/chat/completions`;

  // 需要结构化输出时，将 schema 附加到系统提示词，并要求输出 JSON
  let systemPrompt = sysPrompt;
  if (schema) {
    const fieldDescs = Object.entries(schema.properties)
      .map(([k, v]) => `- ${k}：${v.description}`)
      .join('\n');
    systemPrompt = `${sysPrompt}\n\n请严格以 JSON 格式输出，包含以下字段：\n${fieldDescs}\n\n只输出 JSON，不要有任何其他文字。`;
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userContent },
  ];

  const body = {
    model,
    messages,
    temperature: 0.7,
  };

  // 使用兼容性更好的 json_object 格式（DeepSeek / OpenAI 均支持）
  if (schema) {
    body.response_format = { type: 'json_object' };
  }

  const resp = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  const content = resp.data.choices[0].message.content;
  if (schema) {
    try {
      let cleaned = content;

      // 1. 去掉 markdown 代码块
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

      // 2. 去掉 <thinking>...</thinking> 思考过程（MiniMax、DeepSeek 等模型）
      cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

      // 3. 去掉类似 [DONE]、<eos> 等标记
      cleaned = cleaned.replace(/\[DONE\]/gi, '').replace(/<eos>/gi, '').trim();

      // 4. 直接找第一个 { 提取 JSON（兼容各种前缀）
      const jsonStart = cleaned.indexOf('{');
      if (jsonStart >= 0) {
        cleaned = cleaned.slice(jsonStart);
      }

      return JSON.parse(cleaned);
    } catch (e) {
      // 解析失败时记录详细错误，供排查
      const errorMsg = `LLM JSON 解析失败 | 模型: ${model} | 错误: ${e.message} | 原始内容: ${content.slice(0, 300)}...`;
      console.error(errorMsg);
      // 抛出一个带信息的错误，让调用方知道
      throw new Error(`LLM 输出解析失败: ${e.message}`);
    }
  }
  return content;
}

// 翻译文本
async function translate(text) {
  if (!text || text.trim() === '') return text;
  return callLLM('translate', text);
}

// 格式化新闻（AINews）
async function formatNewsForAINews(title, description) {
  const prompt = `请将以下新闻内容结构化提炼：
标题：${title}
内容：${description}`;

  const schema = {
    type: 'object',
    properties: {
      news_title: { type: 'string', description: '简短精炼的资讯标题，不超过30字' },
      news_summary: { type: 'string', description: '新闻概要，100-200字，简明扼要' },
    },
    required: ['news_title', 'news_summary'],
    additionalProperties: false,
  };

  return callLLM('edit', prompt, schema);
}

// 格式化新闻（AITopics：引导讨论型）
async function formatNewsForAITopics(title, description) {
  const { model, baseUrl, apiKey } = getLLMConfig('edit');
  const { sysPrompt } = getLLMConfig('aitopics');

  const prompt = `标题：${title}\n内容：${description}`;

  const schema = {
    type: 'object',
    properties: {
      news_title: { type: 'string', description: '话题性标题，不超过30字，有引导性' },
      news_summary: { type: 'string', description: '100-200字，有观点、有问题引导读者思考和讨论' },
    },
    required: ['news_title', 'news_summary'],
    additionalProperties: false,
  };

  // 复用 edit 模型，但替换系统提示词
  return callLLMWithOverride({ model, baseUrl, apiKey, sysPrompt }, prompt, schema);
}

// 格式化新闻（AITools：工具推荐型）
async function formatNewsForAITools(title, description) {
  const { model, baseUrl, apiKey } = getLLMConfig('edit');
  const { sysPrompt } = getLLMConfig('aitools');

  const prompt = `标题：${title}\n内容：${description}`;

  const schema = {
    type: 'object',
    properties: {
      news_title: { type: 'string', description: '工具推荐标题，不超过30字，突出工具名称和核心价值' },
      news_summary: { type: 'string', description: '100-200字，介绍工具功能、亮点和使用场景，语气积极推荐' },
    },
    required: ['news_title', 'news_summary'],
    additionalProperties: false,
  };

  return callLLMWithOverride({ model, baseUrl, apiKey, sysPrompt }, prompt, schema);
}

// 创作内容（MakeContent）
async function createContent(title, description, extraInfo) {
  const parts = [`资讯标题：${title}`];
  if (description) parts.push(`资讯详情：${description}`);
  if (extraInfo) parts.push(`补充信息：${extraInfo}`);

  const prompt = parts.join('\n\n');

  const schema = {
    type: 'object',
    properties: {
      cover_word: { type: 'string', description: '一个概括性的英文单词' },
      cover_title: { type: 'string', description: '主标题，不超过15字' },
      cover_description: { type: 'string', description: '描述性文本，不超过20字' },
      cover_emoji: { type: 'string', description: '一个相关Emoji' },
      title: { type: 'string', description: '内容标题，不超过20字' },
      content: { type: 'string', description: '内容正文，关于内容的论述' },
    },
    required: ['cover_word', 'cover_title', 'cover_description', 'cover_emoji', 'title', 'content'],
    additionalProperties: false,
  };

  return callLLM('create', prompt, schema);
}

module.exports = { translate, formatNewsForAINews, formatNewsForAITopics, formatNewsForAITools, createContent };
