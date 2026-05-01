'use client';

import { useRef, useState, useEffect } from 'react';

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  error?: boolean;
  disabled?: boolean;
}

export default function PinInput({ length = 4, onComplete, error, disabled }: PinInputProps) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const prevErrorRef = useRef(false);

  useEffect(() => {
    if (error && !prevErrorRef.current) {
      // error 从 false→true，清空并聚焦（rAF 避免同步 setState）
      requestAnimationFrame(() => {
        setValues(Array(length).fill(''));
        refs.current[0]?.focus();
      });
    }
    prevErrorRef.current = !!error;
  }, [error, length]);

  const handleChange = (index: number, val: string) => {
    if (disabled) return;
    const digit = val.replace(/\D/g, '').slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }

    if (digit && index === length - 1 && next.every(v => v)) {
      onComplete(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center" role="group" aria-label="PIN 输入">
      {values.map((v, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={v}
          disabled={disabled}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          aria-label={`PIN 第 ${i + 1} 位`}
          className="w-12 h-14 text-center text-xl font-bold rounded-xl outline-none transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: `2px solid ${error ? '#EF4444' : v ? 'var(--accent-1)' : 'var(--border)'}`,
            animation: error ? 'shake 0.4s ease-in-out' : undefined,
          }}
        />
      ))}
    </div>
  );
}
