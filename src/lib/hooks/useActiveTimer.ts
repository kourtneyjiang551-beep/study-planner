'use client';

import { createContext, useContext, useCallback, useRef } from 'react';

/**
 * 全局单活跃计时器协调器
 *
 * 同一时间只允许一个任务在计时。启动 Timer B 时自动暂停 Timer A。
 * 通过 React Context 在组件树中共享。
 */

export interface ActiveTimerContextValue {
  /** 当前活跃（正在计时）的 recordId，null 表示无活跃计时器 */
  activeRecordId: React.RefObject<string | null>;
  /** 注册暂停回调，用于协调自动暂停 */
  registerPause: (recordId: string, pauseFn: () => Promise<void>) => void;
  /** 取消注册（组件卸载时） */
  unregisterPause: (recordId: string) => void;
  /** 请求成为活跃计时器，如果已有其他活跃计时器则先暂停它 */
  requestActive: (recordId: string) => Promise<string | null>;
  /** 清除活跃状态（暂停/完成时调用） */
  clearActive: (recordId: string) => void;
}

export const ActiveTimerContext = createContext<ActiveTimerContextValue | null>(null);

/**
 * 在 Provider 中使用的核心逻辑 hook
 */
export function useActiveTimerProvider(): ActiveTimerContextValue {
  const activeRecordId = useRef<string | null>(null);
  const pauseCallbacks = useRef<Map<string, () => Promise<void>>>(new Map());

  const registerPause = useCallback((recordId: string, pauseFn: () => Promise<void>) => {
    pauseCallbacks.current.set(recordId, pauseFn);
  }, []);

  const unregisterPause = useCallback((recordId: string) => {
    pauseCallbacks.current.delete(recordId);
  }, []);

  const requestActive = useCallback(async (recordId: string): Promise<string | null> => {
    const currentId = activeRecordId.current;
    let pausedId: string | null = null;

    // 如果有其他活跃计时器，先暂停它
    if (currentId && currentId !== recordId) {
      const pauseFn = pauseCallbacks.current.get(currentId);
      if (pauseFn) {
        await pauseFn();
      }
      pausedId = currentId;
    }

    activeRecordId.current = recordId;
    return pausedId;
  }, []);

  const clearActive = useCallback((recordId: string) => {
    if (activeRecordId.current === recordId) {
      activeRecordId.current = null;
    }
  }, []);

  return { activeRecordId, registerPause, unregisterPause, requestActive, clearActive };
}

/**
 * 消费端 hook
 */
export function useActiveTimer(): ActiveTimerContextValue {
  const ctx = useContext(ActiveTimerContext);
  if (!ctx) {
    throw new Error('useActiveTimer must be used within an ActiveTimerProvider');
  }
  return ctx;
}
