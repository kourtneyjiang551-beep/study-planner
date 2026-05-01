'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import { now } from '@/lib/utils/id';
import { awardPoints } from '@/lib/utils/points';
import { useStreak } from './useStreak';
import { useActiveTimer } from './useActiveTimer';
import { useMedalChecker } from './useMedalChecker';
import { toast } from '@/components/ui/Toast';
import { useCelebration } from './useCelebration';
import type { TaskRecord } from '@/types';

/** 12 小时阈值（秒） */
const ABNORMAL_THRESHOLD = 12 * 3600;

export interface UseTimerReturn {
  /** 当前记录 */
  record: TaskRecord | undefined;
  /** 显示用已消耗秒数（每秒刷新） */
  displaySeconds: number;
  /** 是否超过 12 小时（异常标记） */
  isAbnormal: boolean;
  /** 开始计时 */
  start: () => Promise<void>;
  /** 暂停计时 */
  pause: () => Promise<void>;
  /** 完成（计时完成） */
  complete: () => Promise<void>;
  /** 手动完成（不计时） */
  manualComplete: () => Promise<void>;
  /** 跳过（标记 skipped） */
  skip: () => Promise<void>;
}

/**
 * 核心计时器 hook
 *
 * - 基于 started_at 时间戳恢复计时（页面关闭重开后时间正确）
 * - 使用 requestAnimationFrame 每秒更新显示
 * - 超过 12 小时标记为异常
 * - 通过 useActiveTimer 协调单活跃计时器
 */
export function useTimer(recordId: string): UseTimerReturn {
  const record = useLiveQuery(() => db.taskRecords.get(recordId), [recordId]);
  const [displaySeconds, setDisplaySeconds] = useState(0);
  const [isAbnormal, setIsAbnormal] = useState(false);
  const rafRef = useRef<number>(0);
  const { updateStreak } = useStreak();
  const activeTimer = useActiveTimer();
  const { checkMedals } = useMedalChecker(record?.child_id ?? '');
  const { celebrate } = useCelebration();

  // 计算实际已用时间
  const calcElapsed = useCallback((rec: TaskRecord): number => {
    let total = rec.actual_duration_seconds;
    if (rec.status === 'in_progress' && rec.started_at) {
      const running = (Date.now() - new Date(rec.started_at).getTime()) / 1000;
      total += running;
    }
    return Math.floor(total);
  }, []);

  // requestAnimationFrame 循环 -- 每秒更新一次显示
  useEffect(() => {
    if (!record) return;

    let lastUpdate = 0;

    const tick = (timestamp: number) => {
      // 限制更新频率：约每秒一次
      if (timestamp - lastUpdate >= 1000 || lastUpdate === 0) {
        lastUpdate = timestamp;
        const elapsed = calcElapsed(record);
        setDisplaySeconds(elapsed);
        setIsAbnormal(elapsed > ABNORMAL_THRESHOLD);
      }

      if (record.status === 'in_progress') {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    // 首帧立即触发 tick 以计算初始值（tick 内通过 rAF callback 设置 state，不违反 set-state-in-effect 规则）
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [record, calcElapsed]);

  // 注册/取消注册暂停回调给全局协调器
  const pauseImpl = useCallback(async () => {
    const rec = await db.taskRecords.get(recordId);
    if (!rec || rec.status !== 'in_progress' || !rec.started_at) return;

    const elapsed = (Date.now() - new Date(rec.started_at).getTime()) / 1000;
    await db.taskRecords.update(recordId, {
      status: 'pending',
      actual_duration_seconds: rec.actual_duration_seconds + Math.floor(elapsed),
      started_at: undefined,
      paused_at: now(),
      updated_at: now(),
    });
    activeTimer.clearActive(recordId);
  }, [recordId, activeTimer]);

  useEffect(() => {
    activeTimer.registerPause(recordId, pauseImpl);
    return () => {
      activeTimer.unregisterPause(recordId);
    };
  }, [recordId, pauseImpl, activeTimer]);

  // 如果记录已是 in_progress，同步标记为活跃（页面恢复场景）
  useEffect(() => {
    if (record?.status === 'in_progress') {
      activeTimer.requestActive(recordId);
    }
  }, [record?.status, recordId, activeTimer]);

  const start = useCallback(async () => {
    // 请求成为活跃计时器（会自动暂停其他计时器）
    await activeTimer.requestActive(recordId);

    await db.taskRecords.update(recordId, {
      status: 'in_progress',
      started_at: now(),
      updated_at: now(),
    });
  }, [recordId, activeTimer]);

  const pause = useCallback(async () => {
    await pauseImpl();
  }, [pauseImpl]);

  const complete = useCallback(async (e?: React.MouseEvent) => {
    const rec = await db.taskRecords.get(recordId);
    if (!rec) return;

    // 如果正在计时，先累加时间
    let finalDuration = rec.actual_duration_seconds;
    if (rec.status === 'in_progress' && rec.started_at) {
      const elapsed = (Date.now() - new Date(rec.started_at).getTime()) / 1000;
      finalDuration += Math.floor(elapsed);
    }

    await db.taskRecords.update(recordId, {
      status: 'completed',
      actual_duration_seconds: finalDuration,
      started_at: undefined,
      completed_at: now(),
      is_manual_complete: false,
      updated_at: now(),
    });

    activeTimer.clearActive(recordId);

    // 奖励积分
    const task = await db.tasks.get(rec.task_id);
    if (task && task.points_reward > 0) {
      await awardPoints(rec.child_id, task.points_reward, 'task_complete', recordId);
    }

    // 更新连续打卡天数
    await updateStreak(rec.child_id);

    // 检查勋章解锁
    const newMedals = await checkMedals();
    newMedals.forEach(name => toast(`恭喜解锁勋章：${name}`, 'success'));

    // 礼花筒 — 在按钮位置喷射
    celebrate(e ? { x: e.clientX, y: e.clientY } : undefined);
  }, [recordId, activeTimer, updateStreak, checkMedals, celebrate]);

  const manualComplete = useCallback(async (e?: React.MouseEvent) => {
    const rec = await db.taskRecords.get(recordId);
    if (!rec) return;

    await db.taskRecords.update(recordId, {
      status: 'completed',
      started_at: undefined,
      completed_at: now(),
      is_manual_complete: true,
      updated_at: now(),
    });

    activeTimer.clearActive(recordId);

    // 手动完成也奖励积分
    const task = await db.tasks.get(rec.task_id);
    if (task && task.points_reward > 0) {
      await awardPoints(rec.child_id, task.points_reward, 'task_complete', recordId);
    }

    // 更新连续打卡天数
    await updateStreak(rec.child_id);

    // 检查勋章解锁
    const newMedals = await checkMedals();
    newMedals.forEach(name => toast(`恭喜解锁勋章：${name}`, 'success'));

    // 礼花筒 — 在按钮位置喷射
    celebrate(e ? { x: e.clientX, y: e.clientY } : undefined);
  }, [recordId, activeTimer, updateStreak, checkMedals, celebrate]);

  const skip = useCallback(async () => {
    await db.taskRecords.update(recordId, {
      status: 'skipped',
      started_at: undefined,
      updated_at: now(),
    });
    activeTimer.clearActive(recordId);
  }, [recordId, activeTimer]);

  return {
    record,
    displaySeconds,
    isAbnormal,
    start,
    pause,
    complete,
    manualComplete,
    skip,
  };
}
