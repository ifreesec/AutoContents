import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import HomePage from './pages/HomePage';
import SourcesPage from './pages/SourcesPage';
import ConfigPage from './pages/ConfigPage';
import MakeContentPage from './pages/MakeContentPage';
import ResourcePage from './pages/ResourcePage';

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <Layout>
                <HomePage />
              </Layout>
            }
          />
          <Route
            path="/sources"
            element={
              <Layout>
                <SourcesPage />
              </Layout>
            }
          />
          <Route
            path="/config"
            element={
              <Layout>
                <ConfigPage />
              </Layout>
            }
          />
          <Route
            path="/resources"
            element={
              <Layout>
                <ResourcePage />
              </Layout>
            }
          />
          <Route path="/make-content" element={<MakeContentPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
