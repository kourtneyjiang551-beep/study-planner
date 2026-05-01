'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef, type ReactNode } from 'react';

interface CelebrationPoint { x: number; y: number }

const CelebrationContext = createContext<{
  celebrate: (point?: CelebrationPoint) => void;
}>({ celebrate: () => {} });

export function useCelebration() {
  return useContext(CelebrationContext);
}

let cid = 0;

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [bursts, setBursts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const celebrate = useCallback((point?: CelebrationPoint) => {
    const x = point?.x ?? window.innerWidth / 2;
    const y = point?.y ?? window.innerHeight * 0.4;
    const id = ++cid;
    setBursts(prev => [...prev, { id, x, y }]);
    setTimeout(() => setBursts(prev => prev.filter(b => b.id !== id)), 3500);
  }, []);

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {bursts.map(b => (
        <PopperCanvas key={b.id} x={b.x} y={b.y} />
      ))}
    </CelebrationContext.Provider>
  );
}

function sr(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

const COLORS = [
  '#FF4757', '#FECA57', '#48DBFB', '#FF6B81', '#A29BFE',
  '#55E6C1', '#F8A5C2', '#F7D794', '#78E08F', '#E77F67',
];

interface Piece {
  x: number; y: number;
  vx: number; vy: number;
  w: number; h: number;
  color: string;
  rotation: number;
  rotSpeed: number;
  gravity: number;
  drag: number;
  wobbleAmp: number;
  wobbleFreq: number;
  opacity: number;
}

/** 礼花筒 — 使用 Canvas 绘制，不依赖 CSS keyframes */
function PopperCanvas({ x, y }: { x: number; y: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 生成 60 片纸屑
    const pieces: Piece[] = [];
    for (let i = 0; i < 60; i++) {
      const angle = (-Math.PI / 2) + (sr(i * 13 + 1) - 0.5) * Math.PI * 0.9;
      const speed = 400 + sr(i * 13 + 2) * 600;
      const size = 6 + sr(i * 13 + 3) * 6;
      pieces.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w: size,
        h: sr(i * 13 + 4) > 0.4 ? size * 0.5 : size,
        color: COLORS[Math.floor(sr(i * 13 + 5) * COLORS.length)],
        rotation: sr(i * 13 + 6) * Math.PI * 2,
        rotSpeed: (sr(i * 13 + 7) - 0.5) * 12,
        gravity: 600 + sr(i * 13 + 8) * 400,
        drag: 0.96 + sr(i * 13 + 9) * 0.03,
        wobbleAmp: (sr(i * 13 + 10) - 0.5) * 100,
        wobbleFreq: 2 + sr(i * 13 + 11) * 3,
        opacity: 1,
      });
    }

    let startTime: number | null = null;
    let animId: number;

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const dt = 1 / 60;

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      let alive = false;
      for (const p of pieces) {
        if (p.opacity <= 0) continue;
        alive = true;

        // 物理更新
        p.vy += p.gravity * dt;
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.x += Math.sin(elapsed * p.wobbleFreq) * p.wobbleAmp * dt;
        p.rotation += p.rotSpeed * dt;

        // 1.5 秒后开始淡出
        if (elapsed > 1.5) {
          p.opacity = Math.max(0, p.opacity - dt * 0.8);
        }

        // 绘制
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.globalAlpha = p.opacity;
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      }

      if (alive && elapsed < 3.2) {
        animId = requestAnimationFrame(animate);
      }
    }

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [x, y]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 300 }}
    />
  );
}
