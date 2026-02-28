import React, { useState, useEffect, useCallback } from 'react';
import { newsAPI, contentAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './ResourcePage.css';

const API_BASE = process.env.NODE_ENV === 'production'
  ? (process.env.REACT_APP_API_URL?.replace('/api', '') || '')
  : '';

// ── 原始资讯（按信源分组，含 hidden） ───────────────────────
function RawNewsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await newsAPI.raw();
      if (resp.data.success) setGroups(resp.data.data);
    } catch {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [toast]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="tab-loading"><span className="spinner" /> 加载中…</div>;

  return (
    <div className="raw-news-list">
      {groups.map((g) => (
        <div key={g.source.id} className="raw-source-group">
          <div className="raw-source-header">
            <span className="raw-source-name">{g.source.name}</span>
            <span className="raw-source-count">{g.items.length} 条</span>
          </div>
          <div className="raw-items">
            {g.items.length === 0 ? (
              <div className="empty-hint">暂无数据</div>
            ) : g.items.map((item) => (
              <div key={item.id} className={`raw-item ${item.hidden ? 'raw-item-hidden' : ''}`}>
                <div className="raw-item-meta">
                  {item.hidden ? <span className="badge-muted">已隐藏</span> : null}
                  {item.saved ? <span className="badge-saved">已保存</span> : null}
                  {item.ai_newsed ? <span className="badge-pushed">已推送</span> : null}
                  <span className="raw-item-date">
                    {item.pub_date ? new Date(item.pub_date).toLocaleString('zh-CN', {
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                    }) : ''}
                  </span>
                </div>
                <div className="raw-item-title">{item.translated_title || item.title || '无标题'}</div>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" className="raw-item-link">
                    查看原文 ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 已保存资讯 ─────────────────────────────────────────────
function SavedNewsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await newsAPI.saved();
      if (resp.data.success) setItems(resp.data.data);
    } catch {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleUnsave = async (id) => {
    try {
      await newsAPI.unsave(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success('已取消保存');
    } catch {
      toast.error('操作失败');
    }
  };

  if (loading) return <div className="tab-loading"><span className="spinner" /> 加载中…</div>;
  if (items.length === 0) return <div className="tab-empty">暂无已保存资讯</div>;

  return (
    <div className="saved-news-list">
      {items.map((item) => (
        <div key={item.id} className="saved-news-item">
          <div className="saved-news-meta">
            <span className="saved-news-source">{item.source_name}</span>
            <span className="saved-news-date">
              {item.saved_at ? new Date(item.saved_at).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
              }) : ''}
            </span>
          </div>
          <div className="saved-news-title">{item.translated_title || item.title || '无标题'}</div>
          {(item.translated_description || item.description) && (
            <div className="saved-news-desc">
              {(item.translated_description || item.description).substring(0, 200)}
              {(item.translated_description || item.description).length > 200 ? '…' : ''}
            </div>
          )}
          <div className="saved-news-actions">
            {item.link && (
              <a href={item.link} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                查看原文
              </a>
            )}
            <button className="btn btn-danger btn-sm" onClick={() => handleUnsave(item.id)}>
              移除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 已保存内容 ─────────────────────────────────────────────
function SavedContentsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [currentImg, setCurrentImg] = useState(0);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await contentAPI.savedList();
      if (resp.data.success) setItems(resp.data.data);
    } catch {
      toast.error('加载失败');
    } finally {
      setLoading(false);
    }
  }, [toast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await contentAPI.deleteSaved(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success('已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const openDetail = (item) => {
    setSelected(item);
    setCurrentImg(0);
  };

  if (loading) return <div className="tab-loading"><span className="spinner" /> 加载中…</div>;
  if (items.length === 0) return <div className="tab-empty">暂无已保存内容</div>;

  const allImages = selected
    ? [selected.cover_url, ...(selected.detail_urls || [])].filter(Boolean)
    : [];

  return (
    <>
      <div className="contents-grid">
        {items.map((item) => (
          <div key={item.id} className="content-grid-item" onClick={() => openDetail(item)}>
            {item.cover_url ? (
              <img
                src={`${API_BASE}${item.cover_url}`}
                alt={item.title}
                className="content-grid-thumb"
              />
            ) : (
              <div className="content-grid-placeholder">◈</div>
            )}
            <div className="content-grid-info">
              <div className="content-grid-title">{item.title || '无标题'}</div>
              <div className="content-grid-date">
                {item.created_at ? new Date(item.created_at).toLocaleDateString('zh-CN') : ''}
              </div>
            </div>
            <button
              className="content-grid-delete"
              onClick={(e) => handleDelete(item.id, e)}
              title="删除"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* 详情弹窗 */}
      {selected && (
        <div className="content-modal-overlay" onClick={() => setSelected(null)}>
          <div className="content-modal" onClick={(e) => e.stopPropagation()}>
            <button className="content-modal-close" onClick={() => setSelected(null)}>✕</button>
            <div className="content-modal-body">
              {/* 图片轮播 */}
              <div className="content-modal-images">
                {allImages.length > 0 ? (
                  <div className="modal-image-wrap">
                    <img src={`${API_BASE}${allImages[currentImg]}`} alt="" />
                    {allImages.length > 1 && (
                      <>
                        <button className="img-nav prev" onClick={() => setCurrentImg((p) => (p - 1 + allImages.length) % allImages.length)}>‹</button>
                        <button className="img-nav next" onClick={() => setCurrentImg((p) => (p + 1) % allImages.length)}>›</button>
                        <div className="img-dots">
                          {allImages.map((_, i) => (
                            <span key={i} className={`dot ${i === currentImg ? 'active' : ''}`} onClick={() => setCurrentImg(i)} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="modal-no-image">无渲染图片</div>
                )}
              </div>
              {/* 文字 */}
              <div className="content-modal-text">
                <div className="content-modal-title">{selected.title || '无标题'}</div>
                <div className="content-modal-content">{selected.content || ''}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 主页面 ─────────────────────────────────────────────────
const TABS = [
  { key: 'raw', label: '原始资讯' },
  { key: 'saved-news', label: '保存的资讯' },
  { key: 'saved-contents', label: '保存的内容' },
];

export default function ResourcePage() {
  const [activeTab, setActiveTab] = useState('raw');

  return (
    <div className="resource-page page-container">
      <div className="page-header">
        <div className="page-title-area">
          <h1 className="page-title">资源库</h1>
        </div>
      </div>

      <div className="resource-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`resource-tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="resource-tab-content">
        {activeTab === 'raw' && <RawNewsTab />}
        {activeTab === 'saved-news' && <SavedNewsTab />}
        {activeTab === 'saved-contents' && <SavedContentsTab />}
      </div>
    </div>
  );
}
