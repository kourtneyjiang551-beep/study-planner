'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

export default function RegisterPage() {
  const { signUp } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError('密码至少需要 8 个字符');
      return;
    }

    setLoading(true);
    setError(null);

    const signUpResult = await signUp(email, password, displayName);
    if (signUpResult.error) {
      setError(signUpResult.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setSuccess(true);
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
          注册好学伴
        </h1>

        {success ? (
          <div className="text-center space-y-4">
            <div className="text-4xl">📬</div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              验证邮件已发送
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              请查收邮件并点击验证链接完成注册。登录后需输入邀请码激活账号。
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
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  昵称
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="你的昵称"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>

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

              <div>
                <label
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  密码
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 个字符"
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
                {loading ? '注册中...' : '注册'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              已有账号？{' '}
              <Link href="/auth/login" style={{ color: 'var(--accent-1)' }}>
                登录
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
