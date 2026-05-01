'use client';

import {
  Clock,
  Dumbbell,
  ListChecks,
  Target,
  BarChart3,
  Medal,
  TrendingUp,
  Gem,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { useKPI } from '@/lib/hooks/useKPI';
import { formatHours } from '@/lib/utils/date';
import { useActiveChild } from '@/lib/hooks/useActiveChild';
import LevelPanel from '@/components/levels/LevelPanel';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accentColor: string;
  href?: string;
  /** 0-100 进度环 */
  progress?: number;
}

function KPICard({ icon, label, value, sub, accentColor, href, progress }: KPICardProps) {
  const Wrapper = href ? 'a' : 'div';
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      aria-label={href ? `${label}: ${value} - 点击查看` : undefined}
      className={`
        flex-shrink-0 flex items-center gap-2 rounded-xl px-3 py-2
        bg-[var(--bg-card)] border border-[var(--border)]
        min-w-[130px] w-[130px]
        sm:min-w-[160px] sm:w-[160px] sm:px-4 sm:py-3 sm:gap-3
        ${href ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''}
        transition-transform
      `}
    >
      <div
        className="flex items-center justify-center w-8 h-8 rounded-lg sm:w-10 sm:h-10"
        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] truncate">{label}</p>
        {progress !== undefined ? (
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full"
              style={{
                background: `conic-gradient(${accentColor} ${progress * 3.6}deg, var(--border) 0deg)`,
              }}
            >
              <div
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full m-0.5 flex items-center justify-center text-[8px] sm:text-[9px] font-bold"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: accentColor,
                }}
              >
                {value}
              </div>
            </div>
          </div>
        ) : (
          <>
            <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)] leading-tight">
              {value}
            </p>
            {sub && (
              <p className="text-[9px] sm:text-[10px] text-[var(--text-secondary)] truncate">{sub}</p>
            )}
          </>
        )}
      </div>
    </Wrapper>
  );
}

export default function KPIPanel() {
  const { theme, t } = useTheme();
  const { activeChildId } = useActiveChild();
  const { accent1, accent2, accent3, accent4, accent5 } = theme.colors;
  const kpi = useKPI(activeChildId);

  const kpiItems: KPICardProps[] = [
    {
      icon: <Clock size={18} />,
      label: `今日${t('study')}`,
      value: `${formatHours(kpi.studySeconds)}h`,
      accentColor: accent3,
    },
    {
      icon: <Dumbbell size={18} />,
      label: '运动/户外',
      value: `${formatHours(kpi.sportSeconds)}h`,
      accentColor: accent2,
    },
    {
      icon: <ListChecks size={18} />,
      label: `今日${t('task')}`,
      value: `${kpi.completedCount}/${kpi.totalCount}`,
      sub: '已完成/总数',
      accentColor: accent1,
    },
    {
      icon: <Target size={18} />,
      label: '完成进度',
      value: `${kpi.progressPercent}%`,
      progress: kpi.progressPercent,
      accentColor: accent4,
    },
    {
      icon: <BarChart3 size={18} />,
      label: t('stats'),
      value: '查看',
      accentColor: accent3,
      href: '/dashboard/stats',
    },
    {
      icon: <Medal size={18} />,
      label: t('medal'),
      value: kpi.medalCount > 0 ? `${kpi.medalCount}枚` : '--',
      accentColor: accent1,
      href: '/dashboard/medals',
    },
    {
      icon: <TrendingUp size={18} />,
      label: '成绩追踪',
      value: '查看',
      accentColor: accent5,
      href: '/dashboard/grades',
    },
    {
      icon: <Gem size={18} />,
      label: `${t('points')}余额`,
      value: `${kpi.currentPoints}`,
      sub: '可兑换',
      accentColor: accent2,
      href: '/dashboard/rewards',
    },
  ];

  return (
    <div
      className="w-full overflow-x-auto scrollbar-hide py-2"
      style={{ WebkitOverflowScrolling: 'touch', msOverflowStyle: 'none' }}
    >
      <div className="flex gap-2 sm:gap-3 px-1 min-w-max">
        <LevelPanel />
        {kpiItems.map((item) => (
          <KPICard key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}
