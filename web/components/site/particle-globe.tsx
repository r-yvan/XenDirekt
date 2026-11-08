'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import { useTheme } from '@/lib/theme-context';

const KIGALI = { lat: -1.95, lon: 30.06 };
const ORIGINS = [
  { lat: 51.5, lon: -0.1 }, // London
  { lat: 50.85, lon: 4.35 }, // Brussels
  { lat: 45.5, lon: -73.6 }, // Montréal
  { lat: 40.7, lon: -74 }, // New York
  { lat: 52.5, lon: 13.4 }, // Berlin
  { lat: -1.29, lon: 36.82 }, // Nairobi
  { lat: 25.2, lon: 55.3 }, // Dubai
  { lat: 48.85, lon: 2.35 }, // Paris
  { lat: 59.3, lon: 18.1 }, // Stockholm
  { lat: -33.9, lon: 18.4 }, // Cape Town
];
const PARTICLES = 6200;

type Vec = [number, number, number];

function toVec(lat: number, lon: number): Vec {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;
  return [Math.cos(phi) * Math.sin(theta), Math.sin(phi), Math.cos(phi) * Math.cos(theta)];
}

function slerp(a: Vec, b: Vec, t: number, lift: number): Vec {
  const dot = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  const omega = Math.acos(dot);
  const s = Math.sin(omega) || 1;
  const wa = Math.sin((1 - t) * omega) / s;
  const wb = Math.sin(t * omega) / s;
  const h = 1 + lift * Math.sin(Math.PI * t);
  return [(a[0] * wa + b[0] * wb) * h, (a[1] * wa + b[1] * wb) * h, (a[2] * wa + b[2] * wb) * h];
}

/**
 * A slowly turning sphere of orange particles (Fibonacci distribution), each twinkling on its
 * own rhythm, with money flowing in arcs from around the world into Kigali. Canvas 2D, paused
 * off-screen, still when motion is reduced.
 */
export function ParticleGlobe({ className }: { className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bloom = useRef<HTMLCanvasElement>(null);
  const { resolved } = useTheme();

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext('2d');
    if (!context) return;
    // Bloom: a low-resolution copy of each frame, blurred by CSS beneath the crisp canvas.
    const bloomElement = bloom.current;
    const bloomContext = bloomElement?.getContext('2d') ?? null;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dark = resolved === 'dark';

    const points: Vec[] = [];
    const twinkle = new Float32Array(PARTICLES);
    for (let i = 0; i < PARTICLES; i += 1) {
      const y = 1 - (i / (PARTICLES - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      points.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
      twinkle[i] = Math.random() * Math.PI * 2;
    }
    const target = toVec(KIGALI.lat, KIGALI.lon);
    const arcs = ORIGINS.map((origin, index) => ({
      from: toVec(origin.lat, origin.lon),
      offset: index / ORIGINS.length,
    }));
    // Arcs and Kigali contrast with the orange field: white-hot on dark, ink on light.
    const trail = dark ? '255,238,226' : '17,17,19';

    let width = 0;
    let height = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = element.clientWidth;
      height = element.clientHeight;
      element.width = width * ratio;
      element.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (bloomElement) {
        bloomElement.width = Math.max(1, Math.round(width / 3));
        bloomElement.height = Math.max(1, Math.round(height / 3));
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(element);

    // Face Kigali towards the viewer, then turn gently around it.
    const baseYaw = -(KIGALI.lon * Math.PI) / 180;
    const tilt = 0.32;
    let raf = 0;
    const start = performance.now();

    const project = (v: Vec, yaw: number) => {
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const x = v[0] * cy + v[2] * sy;
      const z1 = -v[0] * sy + v[2] * cy;
      const ct = Math.cos(tilt);
      const st = Math.sin(tilt);
      const y = v[1] * ct - z1 * st;
      const z = v[1] * st + z1 * ct;
      const radius = Math.min(width, height) * 0.43;
      const perspective = 1 / (1 - z * 0.25);
      return {
        x: width / 2 + x * radius * perspective,
        y: height / 2 - y * radius * perspective,
        z,
      };
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible && !reduced) return;
      // The first frame's timestamp can predate `start`; a negative time would make the
      // pulse radius below negative (`%` keeps the sign) and arc() throws on it.
      const time = reduced ? 0 : Math.max(0, now - start) / 1000;
      const yaw = baseYaw + Math.sin(time * 0.12) * 0.55;
      context.clearRect(0, 0, width, height);

      // Particles: hotter (lighter orange) and larger towards the viewer; additive on dark.
      context.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      for (let i = 0; i < PARTICLES; i += 1) {
        const p = project(points[i]!, yaw);
        if (p.z < -0.25) continue;
        const depth = (p.z + 0.25) / 1.25;
        const flicker = reduced ? 1 : 0.7 + 0.3 * Math.sin(time * 1.7 + twinkle[i]!);
        const alpha = (dark ? 0.2 + 0.8 * depth : 0.3 + 0.7 * depth) * flicker;
        // Lit particles: hotter towards the viewer on dark; a deeper orange on light paper.
        const green = dark ? 96 + Math.round(78 * depth * depth) : 78 + Math.round(18 * depth);
        const blue = dark ? 10 + Math.round(52 * depth * depth) : 0;
        const red = dark ? 255 : 242;
        context.fillStyle = `rgba(${red},${green},${blue},${alpha.toFixed(3)})`;
        const size = 0.9 + 1.7 * depth;
        context.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }
      context.globalCompositeOperation = 'source-over';

      for (const arc of arcs) {
        const phase = (time * 0.18 + arc.offset) % 1;
        const head = Math.min(1, phase * 1.4);
        const tail = Math.max(0, head - 0.35);
        const fade = 1 - Math.max(0, phase - 0.7) / 0.3;
        context.beginPath();
        let started = false;
        let last: { x: number; y: number; z: number } | null = null;
        for (let s = 0; s <= 40; s += 1) {
          const t = tail + ((head - tail) * s) / 40;
          const p = project(slerp(arc.from, target, t, 0.22), yaw);
          if (p.z < -0.05) {
            started = false;
            continue;
          }
          if (!started) {
            context.moveTo(p.x, p.y);
            started = true;
          } else context.lineTo(p.x, p.y);
          last = p;
        }
        context.strokeStyle = `rgba(${trail},${(0.85 * fade).toFixed(3)})`;
        context.lineWidth = 1.6;
        context.stroke();
        if (last && head < 1) {
          context.beginPath();
          context.arc(last.x, last.y, 2.4, 0, Math.PI * 2);
          context.fillStyle = `rgba(${trail},${fade.toFixed(3)})`;
          context.fill();
        }
      }

      const k = project(target, yaw);
      const pulse = reduced ? 0.5 : (time * 0.8) % 1;
      context.beginPath();
      context.arc(k.x, k.y, 5 + pulse * 26, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255,100,10,${(0.7 * (1 - pulse)).toFixed(3)})`;
      context.lineWidth = 1.5;
      context.stroke();
      context.beginPath();
      context.arc(k.x, k.y, 5, 0, Math.PI * 2);
      context.fillStyle = `rgb(${trail})`;
      context.fill();
      context.beginPath();
      context.arc(k.x, k.y, 7.5, 0, Math.PI * 2);
      context.strokeStyle = '#FF640A';
      context.lineWidth = 2;
      context.stroke();

      if (bloomContext && bloomElement) {
        bloomContext.clearRect(0, 0, bloomElement.width, bloomElement.height);
        bloomContext.drawImage(element, 0, 0, bloomElement.width, bloomElement.height);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      io.disconnect();
    };
  }, [resolved]);

  // `className` must position the globe (e.g. absolute inset-0); both canvases fill it.
  return (
    <div className={clsx('isolate', className)} aria-hidden>
      <canvas
        ref={bloom}
        className="absolute inset-0 size-full scale-[1.03] opacity-70 blur-[18px] saturate-150 dark:opacity-100 dark:mix-blend-screen dark:brightness-150"
      />
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
