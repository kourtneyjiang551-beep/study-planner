'use client';

import { useState, type FormEvent } from 'react';
import { isValidInviteCodeFormat, formatInviteCodeInput, redeemInviteCode } from '@/lib/db/invite';

interface InviteCodeGateProps {
  onActivated: () => void;
}

export default function InviteCodeGate({ onActivated }: InviteCodeGateProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (cooldown) {
      setError('操作过于频繁，请稍后再试');
      return;
    }

    if (!isValidInviteCodeFormat(code)) {
      setError('请输入有效的邀请码（格式：HXB-XXXX）');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await redeemInviteCode(code);
    setLoading(false);

    if (!result.success) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(result.error ?? '验证失败');

      // 连续 3 次失败，冷却 30 秒
      if (newAttempts >= 3) {
        setCooldown(true);
        setTimeout(() => {
          setCooldown(false);
          setAttempts(0);
        }, 30_000);
      }
      return;
    }

    onActivated();
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
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🎟️</div>
          <h2
            className="text-xl font-bold"
            style={{ color: 'var(--text-primary)' }}
          >
            需要邀请码
          </h2>
          <p
            className="text-sm mt-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            你的账号尚未激活，请输入邀请码完成激活。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(formatInviteCodeInput(e.target.value))}
              placeholder="HXB-XXXX"
              maxLength={8}
              className="w-full px-3 py-2 rounded-lg border text-sm font-mono tracking-wider text-center"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          {cooldown && (
            <p className="text-xs text-center" style={{ color: 'var(--text-secondary)' }}>
              请等待 30 秒后再试
            </p>
          )}

          <button
            type="submit"
            disabled={loading || cooldown}
            className="w-full py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-1)', opacity: (loading || cooldown) ? 0.6 : 1 }}
          >
            {loading ? '验证中...' : '激活账号'}
          </button>
        </form>
      </div>
    </div>
  );
}
