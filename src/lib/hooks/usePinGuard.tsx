'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/database';
import * as Dialog from '@radix-ui/react-dialog';
import { Lock } from 'lucide-react';
import PinInput from '@/components/ui/PinInput';
import bcrypt from 'bcryptjs';

const PIN_SESSION_KEY = 'study-planner-pin-verified';
const PIN_LOCK_KEY = 'study-planner-pin-lock';
const PIN_ERROR_COUNT_KEY = 'study-planner-pin-errors';
/** PIN 验证有效期（毫秒），默认 30 分钟 */
const PIN_TIMEOUT_MS = 30 * 60 * 1000;
/** 锁定时长（秒） */
const PIN_LOCK_DURATION = 30;
/** 最大错误次数 */
const PIN_MAX_ERRORS = 3;

// ─── sessionStorage 持久化工具 ───

function isSessionValid(): boolean {
  if (typeof window === 'undefined') return false;
  const ts = sessionStorage.getItem(PIN_SESSION_KEY);
  if (!ts) return false;
  const verifiedAt = Number(ts);
  if (isNaN(verifiedAt)) return false;
  return Date.now() - verifiedAt < PIN_TIMEOUT_MS;
}

/** 读取持久化的锁定剩余秒数（0 表示未锁定） */
function getPersistedLockRemaining(): number {
  if (typeof window === 'undefined') return 0;
  const lockUntil = Number(sessionStorage.getItem(PIN_LOCK_KEY) || '0');
  if (!lockUntil) return 0;
  const remaining = Math.ceil((lockUntil - Date.now()) / 1000);
  if (remaining <= 0) {
    sessionStorage.removeItem(PIN_LOCK_KEY);
    sessionStorage.removeItem(PIN_ERROR_COUNT_KEY);
    return 0;
  }
  return remaining;
}

/** 读取持久化的错误次数 */
function getPersistedErrorCount(): number {
  if (typeof window === 'undefined') return 0;
  return Number(sessionStorage.getItem(PIN_ERROR_COUNT_KEY) || '0');
}

/** 记录一次错误，如达上限则锁定 */
function persistError(): { errorCount: number; lockRemaining: number } {
  const count = getPersistedErrorCount() + 1;
  sessionStorage.setItem(PIN_ERROR_COUNT_KEY, String(count));
  if (count >= PIN_MAX_ERRORS) {
    const lockUntil = Date.now() + PIN_LOCK_DURATION * 1000;
    sessionStorage.setItem(PIN_LOCK_KEY, String(lockUntil));
    return { errorCount: count, lockRemaining: PIN_LOCK_DURATION };
  }
  return { errorCount: count, lockRemaining: 0 };
}

/** 清除错误和锁定状态（验证成功时调用） */
function clearLockState() {
  sessionStorage.removeItem(PIN_ERROR_COUNT_KEY);
  sessionStorage.removeItem(PIN_LOCK_KEY);
}

// ─── Context ───

interface PinGuardContextValue {
  /** 是否已设置 PIN */
  hasPin: boolean;
  /** 当前会话是否已验证 PIN（且未超时） */
  isVerified: boolean;
  /** 需要 PIN 验证时调用，返回 true 表示验证通过 */
  requirePin: () => Promise<boolean>;
  /** 标记已验证（设置页入口验证后可调用） */
  markVerified: () => void;
  /** 验证 PIN 码，返回是否成功。供设置页入口复用 */
  verifyPin: (pin: string) => Promise<boolean>;
  /** 是否被锁定 */
  locked: boolean;
  /** 锁定倒计时秒数 */
  lockCountdown: number;
  /** PIN 输入错误（触发抖动动画） */
  pinError: boolean;
}

const PinGuardContext = createContext<PinGuardContextValue | null>(null);

export function usePinGuard(): PinGuardContextValue {
  const ctx = useContext(PinGuardContext);
  if (!ctx) throw new Error('usePinGuard must be used within PinGuardProvider');
  return ctx;
}

export function PinGuardProvider({ children }: { children: ReactNode }) {
  const profile = useLiveQuery(() => db.profiles.toArray().then(p => p[0]), []);
  const hasPin = !!profile?.parent_pin_hash;
  const [isVerified, setIsVerified] = useState(() => isSessionValid());

  // 锁定状态从 sessionStorage 初始化
  const [locked, setLocked] = useState(() => getPersistedLockRemaining() > 0);
  const [lockCountdown, setLockCountdown] = useState(() => getPersistedLockRemaining());
  const [pinError, setPinError] = useState(false);

  // PIN 弹窗状态
  const [modalOpen, setModalOpen] = useState(false);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // 定时检查验证超时
  useEffect(() => {
    if (!isVerified || !hasPin) return;
    const check = () => {
      if (!isSessionValid()) setIsVerified(false);
    };
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, [isVerified, hasPin]);

  // 锁定倒计时（每秒从 sessionStorage 读取真实剩余时间）
  useEffect(() => {
    if (!locked) return;
    const interval = setInterval(() => {
      const remaining = getPersistedLockRemaining();
      if (remaining <= 0) {
        setLocked(false);
        setLockCountdown(0);
      } else {
        setLockCountdown(remaining);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const markVerified = useCallback(() => {
    sessionStorage.setItem(PIN_SESSION_KEY, String(Date.now()));
    clearLockState();
    setIsVerified(true);
    setLocked(false);
    setLockCountdown(0);
  }, []);

  /** 核心验证逻辑，全局唯一 */
  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    const pinHash = profileRef.current?.parent_pin_hash;
    if (!pinHash) return false;
    const valid = await bcrypt.compare(pin, pinHash);
    if (valid) {
      markVerified();
      setPinError(false);
      return true;
    }
    // 错误：持久化计数
    setPinError(true);
    const { lockRemaining } = persistError();
    if (lockRemaining > 0) {
      setLocked(true);
      setLockCountdown(lockRemaining);
    }
    setTimeout(() => setPinError(false), 600);
    return false;
  }, [markVerified]);

  const requirePin = useCallback((): Promise<boolean> => {
    if (!hasPin || isVerified) return Promise.resolve(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setModalOpen(true);
    });
  }, [hasPin, isVerified]);

  const handleModalVerify = useCallback(async (pin: string) => {
    const ok = await verifyPin(pin);
    if (ok) {
      setModalOpen(false);
      resolveRef.current?.(true);
      resolveRef.current = null;
    }
  }, [verifyPin]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, []);

  return (
    <PinGuardContext.Provider value={{ hasPin, isVerified, requirePin, markVerified, verifyPin, locked, lockCountdown, pinError }}>
      {children}
      <Dialog.Root open={modalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <Dialog.Portal>
          <Dialog.Overlay
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm"
            style={{ animation: 'fadeIn 150ms ease-out' }}
          />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 z-[70] w-[85vw] max-w-xs -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-xl focus:outline-none"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              animation: 'scaleIn 200ms ease-out forwards',
            }}
          >
            <div className="flex flex-col items-center gap-4">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--accent-1)', opacity: 0.15 }}
              >
                <Lock size={24} style={{ color: 'var(--accent-1)' }} />
              </div>
              <div className="text-center">
                <Dialog.Title className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  家长验证
                </Dialog.Title>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  此操作需要输入 PIN 码
                </p>
              </div>
              <PinInput onComplete={handleModalVerify} error={pinError} disabled={locked} />
              {locked && (
                <p className="text-xs" style={{ color: '#EF4444' }}>
                  输入错误次数过多，请 {lockCountdown} 秒后重试
                </p>
              )}
              <button
                onClick={handleClose}
                className="text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                取消
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </PinGuardContext.Provider>
  );
}
