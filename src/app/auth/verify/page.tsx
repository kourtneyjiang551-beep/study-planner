'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function VerifyPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'success' | 'failed'>('checking');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setStatus('success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setStatus('failed');
      }
    });
  }, [router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-8 shadow-lg text-center space-y-4"
        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
      >
        {status === 'checking' && (
          <>
            <div className="text-4xl animate-spin inline-block">⏳</div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              验证中...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-4xl">✅</div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              邮箱验证成功！
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              正在跳转到主页...
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="text-4xl">❌</div>
            <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
              验证失败
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              链接可能已过期，请重新注册或联系支持。
            </p>
          </>
        )}
      </div>
    </div>
  );
}
