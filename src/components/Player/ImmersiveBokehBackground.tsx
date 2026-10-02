import React, { useEffect, useRef } from 'react';

interface Props {
  isPlaying?: boolean;
  intensity?: number;
  className?: string;
}

class BokehParticle {
  size: number;
  baseSize: number;
  x: number;
  y: number;
  hue: number;
  saturation: number;
  lightness: number;
  angleX: number;
  angleY: number;
  speedMultiplier: number;

  constructor(width: number, height: number) {
    this.baseSize = Math.random() * 80 + 60;
    this.size = this.baseSize;
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    
    // Rich harmonic palette: Deep indigo, electric purple, azure, with occasional warm amber/rust accent
    const palettes = [230, 250, 270, 210, 195, 345];
    this.hue = palettes[Math.floor(Math.random() * palettes.length)];
    this.saturation = Math.floor(Math.random() * 35 + 65); // 65% - 100%
    this.lightness = Math.floor(Math.random() * 30 + 15);   // 15% - 45%
    
    this.angleX = Math.random() * Math.PI * 2;
    this.angleY = Math.random() * Math.PI * 2;
    this.speedMultiplier = Math.random() * 0.7 + 0.6;
  }

  update(width: number, height: number, isPlaying: boolean, intensity: number) {
    const speed = (isPlaying ? 1.6 : 0.9) * (1 + intensity * 0.4) * this.speedMultiplier;
    
    this.x += Math.cos(this.angleX) * speed;
    this.y += Math.sin(this.angleY) * speed;

    // Smooth boundary bouncing with margin
    const margin = this.size * 0.8;
    if (this.x < -margin) {
      this.x = -margin;
      this.angleX = Math.PI - this.angleX;
    } else if (this.x > width + margin) {
      this.x = width + margin;
      this.angleX = Math.PI - this.angleX;
    }

    if (this.y < -margin) {
      this.y = -margin;
      this.angleY = -this.angleY;
    } else if (this.y > height + margin) {
      this.y = height + margin;
      this.angleY = -this.angleY;
    }

    // Organic drift
    this.angleX += 0.003;
    this.angleY += 0.003;

    // Pulse size on playback
    const pulseFactor = isPlaying ? Math.sin(Date.now() * 0.003 + this.angleX) * 12 : 0;
    this.size = Math.max(20, this.baseSize + pulseFactor + intensity * 15);
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
    ctx.fillStyle = `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%)`;
    ctx.fill();
  }
}

export const ImmersiveBokehBackground: React.FC<Props> = ({ 
  isPlaying = false, 
  intensity = 0,
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: BokehParticle[] = [];
    const numOfBokehs = 18;

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // 1.5 is ideal for blurred canvas performance
      const displayWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      const displayHeight = canvas.parentElement?.clientHeight || window.innerHeight;

      canvas.width = Math.floor(displayWidth * dpr);
      canvas.height = Math.floor(displayHeight * dpr);
      canvas.style.width = `${displayWidth}px`;
      canvas.style.height = `${displayHeight}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      // Re-init particles to fit viewport
      particles = [];
      for (let i = 0; i < numOfBokehs; i++) {
        particles.push(new BokehParticle(displayWidth, displayHeight));
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    const animate = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      // Deep dark backdrop clearing
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.update(width, height, isPlaying, intensity);
        p.draw(ctx);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, intensity]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden select-none z-0 ${className}`}>
      {/* Heavy Gaussian Blur Filter Canvas as inspired by CodePen */}
      <canvas
        ref={canvasRef}
        style={{
          filter: 'blur(48px)',
          WebkitFilter: 'blur(48px)',
          transform: 'scale(1.12)', // Slightly overscaled to prevent hard edges during blur
        }}
        className="absolute inset-0 w-full h-full opacity-70 transition-opacity duration-700"
      />
      {/* Subtle vignette overlay for optical depth */}
      <div className="absolute inset-0 bg-radial from-transparent via-zinc-950/40 to-zinc-950/80 pointer-events-none" />
    </div>
  );
};

export default ImmersiveBokehBackground;
