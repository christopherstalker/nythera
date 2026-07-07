"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  phase: number;
  twinkle: number;
  hue: number;
};

function createStars(width: number, height: number, count: number): Star[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: 0.45 + Math.random() * 1.6,
    alpha: 0.22 + Math.random() * 0.62,
    phase: Math.random() * Math.PI * 2,
    twinkle: 0.35 + Math.random() * 0.95,
    hue: Math.random() > 0.74 ? 194 + Math.random() * 66 : 270 + Math.random() * 48
  }));
}

export function SpaceBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let stars: Star[] = [];
    let width = 0;
    let height = 0;
    let dpr = 1;

    const draw = (time: number) => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";

      for (const star of stars) {
        const pulse = prefersReducedMotion ? 0.55 : 0.55 + Math.sin(time * 0.001 * star.twinkle + star.phase) * 0.45;
        const alpha = Math.max(0.08, Math.min(0.92, star.alpha * pulse));
        const radius = star.radius * (prefersReducedMotion ? 1 : 0.88 + pulse * 0.26);

        context.beginPath();
        context.fillStyle = `hsla(${star.hue}, 94%, 82%, ${alpha})`;
        context.arc(star.x, star.y, radius, 0, Math.PI * 2);
        context.fill();

        if (star.radius > 1.45 && alpha > 0.42) {
          context.strokeStyle = `hsla(${star.hue}, 94%, 82%, ${alpha * 0.28})`;
          context.lineWidth = Math.max(0.5, 0.75 * dpr);
          context.beginPath();
          context.moveTo(star.x - radius * 2.2, star.y);
          context.lineTo(star.x + radius * 2.2, star.y);
          context.stroke();
        }
      }

      context.globalCompositeOperation = "source-over";

      if (!prefersReducedMotion) {
        frame = requestAnimationFrame(draw);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.width = width;
      canvas.height = height;

      const starCount = window.innerWidth < 768 ? 72 : window.innerWidth <= 1024 ? 104 : 156;
      stars = createStars(width, height, starCount);
      draw(0);
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    if (!prefersReducedMotion) {
      frame = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      data-nythera-space-fallback="true"
      className="nythera-cosmic-backdrop pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        data-nythera-space-canvas="true"
        className="absolute inset-0 h-full w-full opacity-80"
        style={{ mixBlendMode: "screen" }}
      />
      <div className="nythera-cosmic-starfield absolute inset-0" />
      <div className="nythera-cosmic-veil absolute inset-0" />
    </div>
  );
}
