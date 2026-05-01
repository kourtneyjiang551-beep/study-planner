'use client';

import { useState, useCallback } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface ChartExportButtonProps {
  targetSelector?: string;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  fileName?: string;
}

export default function ChartExportButton({ targetSelector, containerRef, fileName = 'chart' }: ChartExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    let target: HTMLElement | null = null;
    if (containerRef?.current) {
      target = containerRef.current;
    } else if (targetSelector) {
      target = document.querySelector(targetSelector);
    }
    if (!target) return;

    setExporting(true);
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: getComputedStyle(target).backgroundColor || '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('图表导出失败:', err);
    } finally {
      setExporting(false);
    }
  }, [targetSelector, containerRef, fileName]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
      title="导出为图片"
    >
      <Download size={12} />
      {exporting ? '导出中...' : '导出图片'}
    </button>
  );
}
