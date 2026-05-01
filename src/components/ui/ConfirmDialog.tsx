'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
          style={{ animation: 'fadeIn 150ms ease-out' }}
        />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[60] w-[85vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl focus:outline-none"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            animation: 'scaleIn 200ms ease-out forwards',
          }}
        >
          <Dialog.Title className="text-base font-semibold">
            {title}
          </Dialog.Title>
          {description && (
            <Dialog.Description className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </Dialog.Description>
          )}
          <div className="flex gap-3 mt-5 justify-end">
            <Dialog.Close asChild>
              <button
                className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
              >
                {cancelText}
              </button>
            </Dialog.Close>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: danger ? '#EF4444' : 'var(--accent-1)' }}
            >
              {loading ? '处理中...' : confirmText}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Hook: 简化使用 ConfirmDialog 的状态管理
 * 用法:
 *   const { confirm, ConfirmDialogEl } = useConfirmDialog();
 *   await confirm({ title: '确认删除?', danger: true });
 */
export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, props: { title: '' }, resolve: null });

  const confirm = (props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange' | 'onConfirm'>): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ open: true, props, resolve });
    });
  };

  const handleConfirm = () => {
    state.resolve?.(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      state.resolve?.(false);
      setState(prev => ({ ...prev, open: false, resolve: null }));
    }
  };

  const ConfirmDialogEl = (
    <ConfirmDialog
      open={state.open}
      onOpenChange={handleOpenChange}
      onConfirm={handleConfirm}
      {...state.props}
    />
  );

  return { confirm, ConfirmDialogEl };
}
