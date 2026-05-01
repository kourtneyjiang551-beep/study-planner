'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
const listeners = new Set<(t: ToastItem) => void>();

/** 全局 toast 函数，任何地方可调用 */
export function toast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const item: ToastItem = { id: ++toastId, message, type };
  listeners.forEach(fn => fn(item));
}

/** 放在 layout 中，渲染 toast 容器 */
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setItems(prev => [...prev, t]);
      // 每条 toast 独立计时 3 秒后自动消失
      const timer = setTimeout(() => {
        setItems(prev => prev.filter(i => i.id !== t.id));
        timersRef.current.delete(t.id);
      }, 3000);
      timersRef.current.set(t.id, timer);
    };
    listeners.add(handler);
    const timers = timersRef.current;
    return () => {
      listeners.delete(handler);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
      {items.map(item => (
        <div
          key={item.id}
          className="pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            animation: 'fadeIn 200ms ease-out',
          }}
        >
          {item.type === 'success' && <CheckCircle size={16} style={{ color: '#10B981' }} />}
          {item.type === 'error' && <AlertCircle size={16} style={{ color: '#EF4444' }} />}
          {item.type === 'info' && <AlertCircle size={16} style={{ color: 'var(--accent-1)' }} />}
          <span>{item.message}</span>
          <button
            onClick={() => dismiss(item.id)}
            className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
            aria-label="关闭通知"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
