'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 捕获子组件树中的渲染错误，防止白屏。
 * 显示友好错误提示 + 重试/返回首页按钮。
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] 渲染异常:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        className="flex items-center justify-center min-h-screen p-6"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div
          className="max-w-md w-full rounded-2xl p-8 text-center"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <AlertTriangle size={28} style={{ color: '#EF4444' }} />
          </div>

          <h2
            className="text-lg font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            页面出了点问题
          </h2>

          <p
            className="text-sm mb-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            {this.state.error?.message || '发生了未知错误，请重试'}
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              <RotateCcw size={16} />
              重试
            </button>
            <button
              onClick={this.handleGoHome}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
              }}
            >
              <Home size={16} />
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }
}
