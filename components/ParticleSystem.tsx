
import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Particle } from '../types';
import { COLORS } from '../constants';

export interface ParticleSystemRef {
  explode: (x: number, y: number, amount?: number) => void;
  emitAt: (x: number, y: number) => void;
}

const ParticleSystem = forwardRef<ParticleSystemRef, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    explode: (x, y, amount = 100) => {
      for (let i = 0; i < amount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 8 + 2;
        particles.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1.0,
          size: Math.random() * 4 + 2,
          alpha: 1.0
        });
      }
    },
    emitAt: (x, y) => {
      for (let i = 0; i < 3; i++) {
        particles.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          life: 0.8,
          size: Math.random() * 3 + 1,
          alpha: 1.0
        });
      }
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const update = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.current = particles.current.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // gravity
        p.life -= 0.015;
        p.alpha = Math.max(0, p.life);
        
        if (p.life <= 0) return false;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${p.alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = COLORS.GOLD;
        ctx.fill();
        return true;
      });

      animationFrame = requestAnimationFrame(update);
    };

    update();
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
});

export default ParticleSystem;
