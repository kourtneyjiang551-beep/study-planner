'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
    } else {
      router.push('/dashboard');
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
          登录好学伴
        </h1>

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
              placeholder="请输入密码"
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
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <Link href="/auth/reset" style={{ color: 'var(--accent-1)' }}>
              忘记密码？
            </Link>
          </div>
          <div>
            还没有账号？{' '}
            <Link href="/auth/register" style={{ color: 'var(--accent-1)' }}>
              注册
            </Link>
          </div>
          <div className="pt-2 border-t" style={{ borderColor: 'var(--border-primary)' }}>
            <Link
              href="/dashboard"
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              跳过，以游客身份使用
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
