'use client';

import { useState } from 'react';
import { Sparkles, Swords, Flower2, Waves, ChevronRight, Check } from 'lucide-react';
import { db } from '@/lib/db/database';
import { createChild } from '@/lib/db/hooks';
import { seedPresetsForChild, seedTemplatesForChild, seedSubjectsForChild } from '@/lib/db/seed';
import { useTheme } from '@/components/ThemeProvider';
import { themes } from '@/lib/themes';
import { generateId, now } from '@/lib/utils/id';
import PinInput from '@/components/ui/PinInput';
import bcrypt from 'bcryptjs';
import type { ThemeId } from '@/types';

const AVATARS = ['👦', '👧', '🧒', '👶', '🦁', '🐱', '🐶', '🐰', '🦊', '🐼', '🐨', '🦄'];
const GRADES = [
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '初一', '初二', '初三', '高一', '高二', '高三',
];
const THEME_OPTIONS: { id: ThemeId; icon: typeof Swords; desc: string }[] = [
  { id: 'dojo', icon: Swords, desc: '习武修行，功成名就' },
  { id: 'magic', icon: Sparkles, desc: '修炼咒语，解锁魔法成就' },
  { id: 'garden', icon: Flower2, desc: '浇灌知识，收获成长果实' },
  { id: 'ocean', icon: Waves, desc: '扬帆远航，探索智慧深海' },
];

type Step = 'welcome' | 'child' | 'theme' | 'pin' | 'done';
const STEPS: Step[] = ['welcome', 'child', 'theme', 'pin', 'done'];

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const { setTheme } = useTheme();

  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('三年级');
  const [avatar, setAvatar] = useState('👦');
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>('dojo');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');
  const [pendingPin, setPendingPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [saving, setSaving] = useState(false);

  const stepIndex = STEPS.indexOf(step);
  const next = () => setStep(STEPS[stepIndex + 1]);

  const handleFinish = async (pinHash?: string) => {
    setSaving(true);

    // 1. Ensure profile exists
    let profile = await db.profiles.toArray().then(p => p[0]);
    const timestamp = now();
    if (!profile) {
      const profileId = generateId();
      profile = {
        id: profileId,
        display_name: '默认用户',
        avatar: '',
        current_theme: selectedTheme,
        parent_pin_hash: pinHash,
        last_active_child_id: '',
        created_at: timestamp,
        updated_at: timestamp,
      };
      await db.profiles.add(profile);
    } else {
      await db.profiles.update(profile.id, {
        current_theme: selectedTheme,
        parent_pin_hash: pinHash ?? profile.parent_pin_hash,
        updated_at: timestamp,
      });
    }

    // 2. Create child
    const childId = await createChild(profile.id, { name, grade });
    await db.children.update(childId, { avatar });

    // 3. Update profile last_active_child_id
    await db.profiles.update(profile.id, { last_active_child_id: childId, updated_at: now() });

    // 4. Seed default subjects, medals & templates
    await seedSubjectsForChild(childId);
    await seedPresetsForChild(childId);
    await seedTemplatesForChild(childId);

    // 6. Set theme
    setTheme(selectedTheme);

    // 7. Mark PIN session if set
    if (pinHash) {
      sessionStorage.setItem('study-planner-pin-verified', '1');
    }

    setSaving(false);
    setStep('done');
  };

  const handlePin = async (pin: string) => {
    if (pinStep === 'enter') {
      setPendingPin(pin);
      setPinStep('confirm');
      return;
    }
    if (pin !== pendingPin) {
      setPinError(true);
      setPinStep('enter');
      setPendingPin('');
      setTimeout(() => setPinError(false), 600);
      return;
    }
    const hash = await bcrypt.hash(pin, 10);
    await handleFinish(hash);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md">
        {/* Progress dots */}
        {step !== 'welcome' && step !== 'done' && (
          <div className="flex justify-center gap-2 mb-8">
            {STEPS.slice(1, -1).map((s, i) => (
              <div
                key={s}
                className="w-2 h-2 rounded-full transition-colors"
                style={{
                  backgroundColor: i <= stepIndex - 1 ? 'var(--accent-1)' : 'var(--border)',
                }}
              />
            ))}
          </div>
        )}

        {/* Welcome */}
        {step === 'welcome' && (
          <div className="text-center space-y-6">
            <div className="text-6xl">📚</div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                欢迎使用好学伴
              </h1>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                学习计划管理与打卡统计助手
              </p>
            </div>
            <button
              onClick={next}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              开始设置 <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* Child info */}
        {step === 'child' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>孩子信息</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>告诉我们宝贝的基本信息</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {AVATARS.map(a => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  className="w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-transform hover:scale-110"
                  style={{ backgroundColor: a === avatar ? 'var(--accent-1)' : 'var(--bg-secondary)', opacity: a === avatar ? 1 : 0.6 }}
                >
                  {a}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="请输入孩子姓名"
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              {GRADES.map(g => (
                <button
                  key={g}
                  onClick={() => setGrade(g)}
                  className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                  style={{ backgroundColor: g === grade ? 'var(--accent-1)' : 'var(--bg-secondary)', color: g === grade ? 'white' : 'var(--text-secondary)' }}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              onClick={next}
              disabled={!name.trim()}
              className="w-full rounded-xl py-3 text-sm font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              下一步
            </button>
          </div>
        )}

        {/* Theme selection */}
        {step === 'theme' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>选择主题</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>每个主题都有独特的视觉风格</p>
            </div>
            <div className="space-y-3">
              {THEME_OPTIONS.map(({ id, icon: Icon, desc }) => {
                const t = themes[id];
                const active = id === selectedTheme;
                return (
                  <button
                    key={id}
                    onClick={() => { setSelectedTheme(id); setTheme(id); }}
                    className="w-full flex items-center gap-4 rounded-xl p-4 transition-transform hover:scale-[1.01]"
                    style={{ backgroundColor: t.colors.bgCard, border: active ? `2px solid ${t.colors.accent1}` : '2px solid transparent' }}
                  >
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${t.colors.accent1}20` }}>
                      <Icon size={24} style={{ color: t.colors.accent1 }} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold" style={{ color: t.colors.textPrimary }}>{t.name}</p>
                      <p className="text-xs" style={{ color: t.colors.textSecondary }}>{desc}</p>
                    </div>
                    {active && <Check size={16} style={{ color: t.colors.accent1 }} className="ml-auto" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={next}
              className="w-full rounded-xl py-3 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              下一步
            </button>
          </div>
        )}

        {/* PIN setup */}
        {step === 'pin' && (
          <div className="space-y-6 text-center">
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>设置家长 PIN</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {pinStep === 'enter' ? '设置 4 位数字 PIN 保护设置页面' : '请再次输入确认'}
              </p>
            </div>
            <PinInput key={pinStep} onComplete={handlePin} error={pinError} />
            <button
              onClick={() => handleFinish()}
              disabled={saving}
              className="text-xs"
              style={{ color: 'var(--text-secondary)' }}
            >
              {saving ? '保存中...' : '以后再设'}
            </button>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>设置完成！</h2>
              <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
                {name}的学习之旅即将开始
              </p>
            </div>
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-medium text-white"
              style={{ backgroundColor: 'var(--accent-1)' }}
            >
              进入学习 <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
