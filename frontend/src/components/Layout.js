import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

const NAV_ITEMS = [
  { path: '/', label: '资讯首页', icon: '◈' },
  { path: '/sources', label: '信源管理', icon: '⊞' },
  { path: '/resources', label: '资源库', icon: '◉' },
  { path: '/config', label: '系统配置', icon: '⚙' },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">◆</span>
          <span className="brand-name">MakeContents</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-version">v2.0</span>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
