'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

export default function ResetPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-lg"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      >
        <h1
          className="text-2xl font-bold mb-6 text-center"
          style={{ color: 'var(--text-primary)' }}
        >
          重置密码
        </h1>

        {sent ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📧</div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              重置邮件已发送
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              请查收邮件并点击链接重置密码。
            </p>
            <Link
              href="/auth/login"
              className="inline-block text-sm"
              style={{ color: 'var(--accent-1)' }}
            >
              返回登录
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              输入注册邮箱，我们将发送密码重置链接。
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  邮箱
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg text-sm font-medium text-white"
                style={{ backgroundColor: 'var(--accent-1)', opacity: loading ? 0.6 : 1 }}
              >
                {loading ? '发送中...' : '发送重置邮件'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Link href="/auth/login" style={{ color: 'var(--accent-1)' }}>
                返回登录
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
