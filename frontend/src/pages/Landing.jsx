import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import StatsCarousel from '../components/landing/StatsCarousel';
import headerImg from '../assets/header.png';
import mainVid from '../assets/main_vid.mp4';
import searchVid from '../assets/search_vid.mp4';
import viralVid from '../assets/viral_vid.mp4';
import oneClickVid from '../assets/one_click.mp4';

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL STYLES (injected via <style> in JSX)
───────────────────────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Anton&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

  /* Clash Display via CDN */
  @font-face {
    font-family: 'Clash Display';
    src: url('https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap');
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body {
    background: #080808;
    color: #F0F0F0;
    font-family: 'DM Sans', sans-serif;
    overflow-x: hidden;
    cursor: none;
  }

  .font-display { font-family: 'Clash Display', 'DM Sans', sans-serif; font-weight: 700; }

  /* ── Custom cursor ── */
  #vyrlo-cursor {
    width: 10px; height: 10px; border-radius: 50%;
    background: #FF3D6E;
    box-shadow: 0 0 16px 4px rgba(255,61,110,0.6);
    position: fixed; pointer-events: none; z-index: 99999;
    transition: transform 0.1s;
    transform: translate(-50%, -50%);
  }
  #vyrlo-cursor-ring {
    width: 34px; height: 34px; border-radius: 50%;
    border: 1.5px solid rgba(255,61,110,0.4);
    position: fixed; pointer-events: none; z-index: 99998;
    transition: left 0.09s, top 0.09s;
    transform: translate(-50%, -50%);
  }

  /* ── Nav underline hover ── */
  .vyrlo-nav-link { position: relative; text-decoration: none; }
  .vyrlo-nav-link::after {
    content: ''; display: block;
    height: 1px; width: 0;
    background: #FF3D6E;
    transition: width 0.3s ease;
    position: absolute; bottom: -3px; left: 0;
  }
  .vyrlo-nav-link:hover::after { width: 100%; }

  /* ── Background mesh gradient breathing ── */
  @keyframes meshBreathe {
    0%,100% { filter: hue-rotate(0deg) brightness(1); transform: scale(1); }
    33%     { filter: hue-rotate(-12deg) brightness(1.05); transform: scale(1.03); }
    66%     { filter: hue-rotate(10deg) brightness(0.97); transform: scale(1.015); }
  }

  /* ── Hero float-in cards ── */
  @keyframes floatInFromTopLeft    { from { opacity:0; transform:translate(-120px,-80px) rotate(-12deg) scale(0.6); } to { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); } }
  @keyframes floatInFromTopRight   { from { opacity:0; transform:translate(120px,-80px) rotate(10deg) scale(0.6); } to { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); } }
  @keyframes floatInFromBottomLeft { from { opacity:0; transform:translate(-100px,100px) rotate(8deg) scale(0.6); } to { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); } }
  @keyframes floatInFromRight      { from { opacity:0; transform:translate(140px,30px) rotate(-9deg) scale(0.6); } to { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); } }
  @keyframes floatInFromBottom     { from { opacity:0; transform:translate(0,120px) rotate(5deg) scale(0.6); } to { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); } }
  @keyframes floatInFromLeft       { from { opacity:0; transform:translate(-140px,20px) rotate(-6deg) scale(0.6); } to { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); } }

  /* ── Marquee ── */
  @keyframes marqueeScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  /* ── Pulse dot ── */
  @keyframes pulseDot { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(255,61,110,0.45); } 50% { opacity:0.6; box-shadow:0 0 0 6px rgba(255,61,110,0); } }

  /* ── Macbook Glow (per-laptop) ── */
  @keyframes macbookGlow { 0%,100% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.95); } 50% { opacity: 1; transform: translate(-50%, -50%) scale(1.02); } }

  /* ── Section Glow Orb (up-down breathe) ── */
  @keyframes sectionGlowUp   { 0%,100% { opacity: 0.18; transform: translateY(0px);   } 50% { opacity: 0.5;  transform: translateY(-60px); } }
  @keyframes sectionGlowDown { 0%,100% { opacity: 0.22; transform: translateY(0px);   } 50% { opacity: 0.6;  transform: translateY(60px);  } }

  /* ── Text Jitter ── */
  @keyframes textJitter {
    0%, 100% { transform: translate(0, 0) skew(0deg); }
    20% { transform: translate(-2px, 1px) skew(-1deg); text-shadow: 2px 0 0 rgba(255,61,110,0.5); }
    40% { transform: translate(1px, -2px) skew(1deg); text-shadow: -2px 0 0 rgba(0,245,255,0.5); }
    60% { transform: translate(-1px, 2px) skew(-2deg); text-shadow: 2px 0 0 rgba(0,245,255,0.5); }
    80% { transform: translate(2px, -1px) skew(2deg); text-shadow: -2px 0 0 rgba(255,61,110,0.5); }
  }
  
  .jitter-text {
    display: inline-block;
    animation: textJitter 0.2s infinite;
  }

  /* ── Shimmer on CTA button ── */
  .vyrlo-cta-btn { position: relative; overflow: hidden; }
  .vyrlo-cta-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(110deg, transparent 20%, rgba(255,61,110,0.18) 50%, transparent 80%);
    transform: translateX(-100%);
    transition: transform 0.55s;
  }
  .vyrlo-cta-btn:hover::before { transform: translateX(100%); }

  /* ── Feature card scanlines ── */
  .vyrlo-feature-card {
    background-image: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(255,255,255,0.012) 3px,
      rgba(255,255,255,0.012) 4px
    );
  }

  /* ── Scrollbar ── */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,61,110,0.25); border-radius: 9999px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,61,110,0.4); }

  /* ── Mobile hamburger menu ── */
  .vyrlo-mobile-menu {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(8,8,8,0.97);
    backdrop-filter: blur(30px);
    z-index: 9000;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 40px;
    transform: translateX(100%);
    transition: transform 0.4s cubic-bezier(0.16,1,0.3,1);
  }
  .vyrlo-mobile-menu.open { transform: translateX(0); }
`;

/* ─────────────────────────────────────────────────────────────────────────────
   HERO FLOATING CARD
───────────────────────────────────────────────────────────────────────────── */
function HeroFloatCard({ label, value, pillTag, accentColor, animation, delay, style }) {
  return (
    <div
      className="absolute rounded-2xl p-4 pointer-events-none"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        boxShadow: `0 0 24px ${accentColor}20`,
        animation: `${animation} 1s cubic-bezier(0.16,1,0.3,1) ${delay}s both`,
        minWidth: 150,
        ...style,
      }}
    >
      {/* Gradient image block */}
      <div
        className="w-full rounded-xl mb-3"
        style={{
          height: 72,
          background: `linear-gradient(135deg, ${accentColor}44 0%, ${accentColor}11 100%)`,
        }}
      />
      {pillTag && (
        <span
          className="inline-block text-xs px-2.5 py-1 rounded-full mb-2 font-medium"
          style={{
            background: `${accentColor}18`,
            color: accentColor,
            border: `1px solid ${accentColor}33`,
          }}
        >
          {pillTag}
        </span>
      )}
      <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold font-display" style={{ color: accentColor }}>
        {value}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   SCROLL-DRIVEN CONTENT CARD
───────────────────────────────────────────────────────────────────────────── */
function ScrollContentCard({ pill, pillColor, gradient, score, delay, pos, fromTransform, width }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="absolute rounded-2xl p-4"
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        width,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(0,0) rotate(0deg) scale(1)' : fromTransform,
        transition: `opacity 0.7s ease ${delay}, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}`,
        ...pos,
      }}
    >
      <div className="w-full rounded-xl mb-3" style={{ height: 80, background: gradient }} />
      <span
        className="inline-block text-xs px-2.5 py-1 rounded-full mb-2 font-medium"
        style={{
          background: `${pillColor}18`,
          color: pillColor,
          border: `1px solid ${pillColor}33`,
        }}
      >
        {pill}
      </span>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Viral Score</p>
        <p className="text-xl font-bold font-display" style={{ color: pillColor }}>{score}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURE CARD
───────────────────────────────────────────────────────────────────────────── */
function FeatureCard({ emoji, title, desc, accent, delay }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVis(true); },
      { threshold: 0.2 }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="vyrlo-feature-card rounded-3xl p-8 transition-all duration-700"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateY(0)' : 'translateY(50px)',
        transitionDelay: delay,
        boxShadow: hovered ? `0 0 40px ${accent}30, inset 0 0 0 1px ${accent}40` : 'none',
        cursor: 'none',
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-3xl"
        style={{ background: `${accent}18`, border: `1px solid ${accent}25` }}
      >
        {emoji}
      </div>
      <h3 className="text-xl font-bold text-white font-display mb-3">{title}</h3>
      <p className="text-sm leading-relaxed" style={{ color: '#888' }}>{desc}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   HOW IT WORKS STEP
───────────────────────────────────────────────────────────────────────────── */
function HowStep({ num, title, desc, side }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVis(true); },
      { threshold: 0.2 }
    );
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const fromX = side === 'left' ? '-70px' : '70px';

  return (
    <div
      ref={ref}
      className={`flex gap-10 items-start py-14 border-b ${side === 'right' ? 'flex-row-reverse text-right' : ''}`}
      style={{
        borderColor: 'rgba(255,255,255,0.05)',
        opacity: vis ? 1 : 0,
        transform: vis ? 'translateX(0)' : `translateX(${fromX})`,
        transition: 'opacity 0.8s ease, transform 0.8s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Ghost number */}
      <div
        className="font-display shrink-0 select-none leading-none"
        style={{
          fontSize: 120,
          color: 'rgba(255,255,255,0.04)',
          minWidth: 150,
          textAlign: 'center',
          lineHeight: 0.9,
        }}
      >
        {num}
      </div>
      <div className="pt-2">
        <h3 className="text-2xl font-bold text-white font-display mb-3">{title}</h3>
        <p className="text-base leading-relaxed max-w-md" style={{ color: '#888' }}>{desc}</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   PARTICLE CANVAS
───────────────────────────────────────────────────────────────────────────── */
function Particles() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const W = () => canvas.width;
    const H = () => canvas.height;

    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 3.5 + 2,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, W(), H());
      dots.forEach(d => {
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < 0 || d.x > W()) d.vx *= -1;
        if (d.y < 0 || d.y > H()) d.vy *= -1;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,61,110,0.55)';
        ctx.fill();
      });
      for (let i = 0; i < dots.length; i++) {
        for (let j = i + 1; j < dots.length; j++) {
          const dx = dots[i].x - dots[j].x;
          const dy = dots[i].y - dots[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.moveTo(dots[i].x, dots[i].y);
            ctx.lineTo(dots[j].x, dots[j].y);
            ctx.strokeStyle = `rgba(255,61,110,${0.1 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN LANDING COMPONENT
───────────────────────────────────────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const cursorRef = useRef(null);
  const ringRef = useRef(null);
  const headerImgRef = useRef(null);
  const videoRef = useRef(null);
  const videoContainerRef = useRef(null);

  /* Custom cursor */
  useEffect(() => {
    const onMove = e => {
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + 'px';
        cursorRef.current.style.top = e.clientY + 'px';
      }
      if (ringRef.current) {
        ringRef.current.style.left = e.clientX + 'px';
        ringRef.current.style.top = e.clientY + 'px';
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  /*
   * SCROLL-DRIVEN IMAGE ANIMATION — bidirectional, no scroll-lock.
   * Uses scrollY position directly so it works perfectly in BOTH directions:
   *
   *  scrollY 0 → vh        : rotation 0° → 90°   (opacity stays 1)
   *  scrollY vh → 1.8×vh   : rotation stays 90°,  opacity 1 → 0
   *  Scrolling back up reverses everything automatically.
   */
  useEffect(() => {
    let currentScroll = window.scrollY;
    let targetScroll = window.scrollY;
    let rafId;

    const onScroll = () => {
      targetScroll = window.scrollY;
    };

    const update = () => {
      // Lerp (smooth interpolation)
      // The 0.08 factor determines how loose/smooth the physical spring is
      currentScroll += (targetScroll - currentScroll) * 0.08;

      if (headerImgRef.current) {
        const vh = window.innerHeight;
        const ROTATE_END = vh;
        const FADE_END = vh * 1.8;

        if (currentScroll <= ROTATE_END) {
          const t = Math.max(0, currentScroll / ROTATE_END);
          const deg = t * 90;
          const scl = 1 + t * 1.5;
          headerImgRef.current.style.transform = `rotate(${deg}deg) scale(${scl})`;
          headerImgRef.current.style.opacity = '1';
        } else if (currentScroll <= FADE_END) {
          const t = (currentScroll - ROTATE_END) / (FADE_END - ROTATE_END);
          const opc = Math.max(0, 1 - t);
          headerImgRef.current.style.transform = 'rotate(90deg) scale(2.5)';
          headerImgRef.current.style.opacity = opc;
        } else {
          headerImgRef.current.style.opacity = '0';
        }
      }

      rafId = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    rafId = requestAnimationFrame(update);

    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  /* ─────────────────────────────────────────────────────────────────────────────
     VIDEO AUTOPLAY VIA INTERSECTION OBSERVER
     Plays the video automatically when the section enters the viewport.
     When the section leaves the viewport, it pauses and resets to 0.
  ───────────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!videoRef.current) return;
        if (entry.isIntersecting) {
          videoRef.current.play().catch(e => console.log('Autoplay prevented:', e));
        } else {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      });
    }, { threshold: 0.1 });

    if (videoContainerRef.current) {
      observer.observe(videoContainerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  /* ── Data ── */
  const TICKER_TEXT = [
    '2.4M Posts Analyzed', '·', '99.8% Accuracy', '·',
    '180+ Trend Categories', '·', 'Real-time Data', '·',
    '50K+ Active Users', '·', 'AI-Powered Engine', '·',
    '2.4M Posts Analyzed', '·', '99.8% Accuracy', '·',
    '180+ Trend Categories', '·', 'Real-time Data', '·',
    '50K+ Active Users', '·', 'AI-Powered Engine', '·',
  ];

  const SCROLL_CARDS = [
    { pill: '🔥 Trending', pillColor: '#FF3D6E', gradient: 'linear-gradient(135deg,#FF3D6E55,#8B5CF633)', score: '9.6', width: 165, delay: '0s', fromTransform: 'translate(-130px,70px) rotate(-10deg) scale(0.65)', pos: { top: '3%', left: '0%' } },
    { pill: '📈 Rising', pillColor: '#00F5FF', gradient: 'linear-gradient(135deg,#00F5FF44,#8B5CF644)', score: '8.9', width: 175, delay: '0.1s', fromTransform: 'translate(0,-120px) rotate(7deg) scale(0.65)', pos: { top: '1%', left: '24%' } },
    { pill: '💎 Viral', pillColor: '#8B5CF6', gradient: 'linear-gradient(135deg,#8B5CF655,#FF3D6E33)', score: '9.2', width: 160, delay: '0.18s', fromTransform: 'translate(120px,-60px) rotate(-8deg) scale(0.65)', pos: { top: '3%', right: '2%' } },
    { pill: '🚀 Exploding', pillColor: '#FF3D6E', gradient: 'linear-gradient(135deg,#FF3D6E33,#00F5FF44)', score: '9.8', width: 170, delay: '0.28s', fromTransform: 'translate(-120px,30px) rotate(9deg) scale(0.65)', pos: { top: '40%', left: '0%' } },
    { pill: '💀 Dying', pillColor: '#888', gradient: 'linear-gradient(135deg,#33333355,#22222233)', score: '2.1', width: 158, delay: '0.12s', fromTransform: 'translate(0,90px) rotate(-6deg) scale(0.65)', pos: { top: '42%', left: '28%' } },
    { pill: '📊 Stable', pillColor: '#8B5CF6', gradient: 'linear-gradient(135deg,#8B5CF633,#00F5FF33)', score: '7.5', width: 162, delay: '0.22s', fromTransform: 'translate(120px,40px) rotate(7deg) scale(0.65)', pos: { top: '40%', right: '2%' } },
    { pill: '🔥 Trending', pillColor: '#00F5FF', gradient: 'linear-gradient(135deg,#00F5FF33,#FF3D6E44)', score: '9.1', width: 168, delay: '0.35s', fromTransform: 'translate(-80px,100px) rotate(-7deg) scale(0.65)', pos: { bottom: '4%', left: '12%' } },
    { pill: '🎯 Niche', pillColor: '#8B5CF6', gradient: 'linear-gradient(135deg,#8B5CF644,#FF3D6E22)', score: '8.3', width: 158, delay: '0.42s', fromTransform: 'translate(80px,100px) rotate(6deg) scale(0.65)', pos: { bottom: '4%', right: '12%' } },
  ];

  /* ─────────────────────────────────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────────────────────────────────── */
  return (
    <div style={{ background: '#080808', color: '#F0F0F0', fontFamily: "'DM Sans', sans-serif", cursor: 'none', minHeight: '100vh', width: '100%' }}>

      {/* Inject global CSS */}
      <style>{GLOBAL_CSS}</style>

      {/* ── Custom Cursor ── */}
      <div id="vyrlo-cursor" ref={cursorRef} />
      <div id="vyrlo-cursor-ring" ref={ringRef} />

      {/* ── Extracted Navbar ── */}
      <Navbar />

      {/* ══════════════════════════════════════════════════════════════════════
          HERO SECTION
          Wrapped in a 180vh sentinel so scrollY drives the sticky animation.
          scrollY 0→100vh  : image rotates 0→90°
          scrollY 100→180vh: image fades out at 90°. 
          At 180vh, it hands off perfectly to the video section below.
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ height: '180vh', position: 'relative' }}>
        <header
          style={{
            position: 'sticky', top: 0,
            height: '100vh',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            textAlign: 'center',
            padding: '0 24px',
            overflow: 'hidden',
          }}
        >
          {/* ─ Full-width Header Image (scroll-rotates in place) ─ */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 0,
              // perspective gives depth to the rotation
              perspective: '1200px',
            }}
          >
            <img
              ref={headerImgRef}
              src={headerImg}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
                opacity: 1,
                transform: 'rotate(0deg) scale(1)',
                transformOrigin: 'center center',
                /* Remove CSS transitions because our Javascript RequestAnimationFrame lerp engine assumes direct real-time control */
                transition: 'none',
                filter: 'brightness(0.82) saturate(1.45) contrast(1.08)',
                willChange: 'transform, opacity',
              }}
            />
            {/* Gradient vignette — keeps text readable over bright image */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(to bottom, rgba(8,8,8,0.68) 0%, rgba(8,8,8,0.18) 30%, rgba(8,8,8,0.18) 65%, rgba(8,8,8,0.80) 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
          {/* Animated mesh background */}
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              animation: 'meshBreathe 10s ease-in-out infinite',
            }}
          >
            <div style={{
              position: 'absolute', top: '30%', left: '15%',
              width: 500, height: 500,
              background: 'radial-gradient(circle,rgba(139,92,246,0.18) 0%,transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(40px)',
            }} />
            <div style={{
              position: 'absolute', top: '35%', right: '12%',
              width: 420, height: 420,
              background: 'radial-gradient(circle,rgba(255,61,110,0.14) 0%,transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(36px)',
            }} />
            <div style={{
              position: 'absolute', bottom: '25%', left: '40%',
              width: 300, height: 300,
              background: 'radial-gradient(circle,rgba(0,245,255,0.08) 0%,transparent 70%)',
              borderRadius: '50%',
              filter: 'blur(30px)',
            }} />
          </div>

          {/* Subtle grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.018) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.018) 1px,transparent 1px)',
            backgroundSize: '64px 64px',
          }} />


          {/* ─ Hero headline + CTA ─ */}
          <div style={{ position: 'relative', zIndex: 10, maxWidth: 860, marginTop: 80 }}>

            {/* Main headline — pure white, maximum contrast over any background */}
            <h1
              className="font-display"
              style={{
                fontSize: 'clamp(48px,7vw,88px)',
                lineHeight: 1.0,
                letterSpacing: '-1px',
                marginBottom: 10,
                color: '#ffffff',
                textShadow:
                  '0 0 80px rgba(0,206,209,0.5), 0 0 40px rgba(0,206,209,0.3), 0 4px 32px rgba(0,0,0,0.9)',
              }}
            >
              Decode What<br />
              <span style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.8)' }}>Goes</span>{' '}
              <span className="jitter-text" style={{ fontStyle: 'italic', color: '#FF3D6E', textShadow: '0 0 40px rgba(255,61,110,0.5)' }}>Viral.</span>
            </h1>

            {/* Subheading */}
            <p style={{
              fontSize: 'clamp(15px,1.4vw,18px)',
              color: 'rgba(255,255,255,0.65)',
              maxWidth: 480,
              margin: '0 auto 48px',
              lineHeight: 1.7,
              fontWeight: 400,
              textShadow: '0 2px 24px rgba(0,0,0,0.9)',
              letterSpacing: '0.008em',
            }}>
              Turn raw posts into viral intelligence — know what
              explodes before the algorithm even notices.
            </p>

            {/* CTA buttons row */}
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/dashboard')}
                className="vyrlo-cta-btn"
                style={{
                  borderRadius: 999,
                  padding: '16px 44px',
                  border: '1.5px solid #FF3D6E',
                  background: 'rgba(255,61,110,0.12)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 700,
                  fontFamily: "'Clash Display','DM Sans',sans-serif",
                  letterSpacing: '0.02em',
                  cursor: 'none',
                  transition: 'box-shadow 0.3s, background 0.3s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = '0 0 48px rgba(255,61,110,0.5)';
                  e.currentTarget.style.background = 'rgba(255,61,110,0.22)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = 'rgba(255,61,110,0.12)';
                }}
              >
                Start Analyzing Now →
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  borderRadius: 999,
                  padding: '16px 36px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  color: 'rgba(255,255,255,0.65)',
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: "'DM Sans',sans-serif",
                  cursor: 'none',
                  transition: 'background 0.25s, color 0.25s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                }}
              >
                See How It Works
              </button>
            </div>
          </div>
        </header>
      </div>{/* end hero 180vh sentinel */}

      {/* ══════════════════════════════════════════════════════════════════════
          VIDEO AUTOPLAY SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section ref={videoContainerRef} style={{ height: '100vh', width: '100vw', position: 'relative', background: '#080808', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <video
          ref={videoRef}
          src={mainVid}
          muted
          loop
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'fill',
          }}
        />
      </section>
      <div style={{ height: "2cm" }}></div>


      {/* ══════════════════════════════════════════════════════════════════════
          STATS MARQUEE
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        padding: '15px 0',
      }}>
        <div style={{
          display: 'flex',
          animation: 'marqueeScroll 25s linear infinite',
          whiteSpace: 'nowrap',
          width: 'max-content',
        }}>
          {TICKER_TEXT.map((text, i) => (
            <span
              key={i}
              className={text !== '·' ? 'font-display' : ''}
              style={{
                fontSize: 40,
                padding: '0 28px',
                color: text === '·' ? '#FF3D6E' : 'rgba(255,255,255,0.18)',
                textShadow: text === '·' ? '0 0 20px rgba(255,61,110,0.5)' : '0 0 18px rgba(0,245,255,0.08)',
                fontWeight: text !== '·' ? 700 : 400,
                letterSpacing: text !== '·' ? '-0.5px' : 0,
              }}
            >{text}</span>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MACBOOK SASSY SHOWCASE SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', padding: '160px 24px', background: '#080808', overflow: 'hidden' }}>

        {/* Neon connector between Macbook sections */}
        <svg
          viewBox="0 0 1200 900"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <defs>
            <linearGradient id="neonWire" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FF3D6E" stopOpacity="0.2" />
              <stop offset="45%" stopColor="#FF3D6E" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#00F5FF" stopOpacity="0.9" />
            </linearGradient>
            <filter id="wireGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <path
            d="M 780 130 C 940 160 980 320 760 350 C 520 380 460 470 340 480"
            stroke="url(#neonWire)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            filter="url(#wireGlow)"
            opacity="0.65"
          />
          <path
            d="M 780 130 C 940 160 980 320 760 350 C 520 380 460 470 340 480"
            stroke="#FFFFFF"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.6"
          />
          <path
            d="M 340 540 C 200 600 420 700 720 710 C 930 720 1000 770 920 800"
            stroke="url(#neonWire)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            filter="url(#wireGlow)"
            opacity="0.6"
          />
          <path
            d="M 340 540 C 200 600 420 700 720 710 C 930 720 1000 770 920 800"
            stroke="#FFFFFF"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            opacity="0.55"
          />
        </svg>

        {/* ── Section-wide Breathing Glow Orbs ── */}
        <div style={{
          position: 'absolute', top: '20%', left: '5%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,61,110,0.22) 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
          animation: 'sectionGlowUp 6s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '15%', right: '5%',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,245,255,0.18) 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
          animation: 'sectionGlowDown 6s ease-in-out infinite 3s',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '200px' }}>

          {/* Block 1: Search Analysis */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '60px', flexWrap: 'wrap' }}>

            {/* Left: Sassy Typography */}
            <div style={{ flex: '1 1 400px' }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 80px)', lineHeight: 0.95, letterSpacing: '-2px', color: '#fff', marginBottom: '24px' }}>
                Stop <span style={{ fontStyle: 'italic', color: '#FF3D6E' }}>guessing.</span><br />
                Start <span style={{ textDecoration: 'underline', textDecorationColor: '#FF3D6E' }}>knowing.</span>
              </h2>
              <p style={{ fontSize: '18px', color: '#888', lineHeight: 1.6, maxWidth: '400px' }}>
                The algorithm isn't magic. It's math. We dissect every pixel, pacing cut, and emotional hook so you can engineer virality on demand.
              </p>
            </div>

            {/* Right: Macbook Frame */}
            <div style={{ flex: '1 1 500px', position: 'relative' }}>
              {/* Core Vibrant Backglow */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150%', height: '150%', background: 'radial-gradient(circle, rgba(255,61,110,0.45) 0%, rgba(255,61,110,0.1) 40%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'macbookGlow 4s ease-in-out infinite' }} />

              {/* The Macbook Structure */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: '62.5%', background: '#1c1c1e', borderRadius: '16px 16px 4px 4px', border: '2px solid #5a3a4c', boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 60px rgba(255,61,110,0.35), inset 0 0 20px rgba(255,61,110,0.1)', overflow: 'hidden' }}>
                {/* Top Notch / Nav Bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '24px', background: '#2c2c2e', borderBottom: '1px solid #3a3a3c', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px', zIndex: 10 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                </div>
                {/* The Video Display */}
                <video
                  src={searchVid}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ position: 'absolute', top: '24px', left: 0, width: '100%', height: 'calc(100% - 24px)', objectFit: 'cover', transform: 'scale(1.15)' }}
                />
              </div>
              {/* Macbook Bottom Lip */}
              <div style={{ width: '115%', height: '16px', background: 'linear-gradient(to bottom, #cfd0d4, #8b8c90)', marginLeft: '-7.5%', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), 0 10px 20px rgba(0,0,0,0.6)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '15%', height: '4px', background: '#b0b1b5', borderRadius: '0 0 4px 4px' }} />
              </div>
            </div>

          </div>

          {/* Block 2: Viral Video */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '60px', flexWrap: 'wrap', flexDirection: 'row-reverse' }}>

            {/* Right: Sassy Typography */}
            <div style={{ flex: '1 1 400px' }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 80px)', lineHeight: 0.95, letterSpacing: '-2px', color: '#fff', marginBottom: '24px' }}>
                Viral is a <br />
                <span style={{ color: '#00F5FF', textShadow: '0 0 30px rgba(0,245,255,0.4)' }}>formula.</span>
              </h2>
              <p style={{ fontSize: '18px', color: '#888', lineHeight: 1.6, maxWidth: '400px' }}>
                Stop praying to the algorithm gods. Watch patterns migrate across our surveillance matrix and jump on trends before they peak.
              </p>
            </div>

            {/* Left: Macbook Frame */}
            <div style={{ flex: '1 1 500px', position: 'relative' }}>
              {/* Core Vibrant Backglow */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150%', height: '150%', background: 'radial-gradient(circle, rgba(0,245,255,0.45) 0%, rgba(0,245,255,0.1) 40%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'macbookGlow 4s ease-in-out infinite 2s' }} />

              {/* The Macbook Structure */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: '62.5%', background: '#1c1c1e', borderRadius: '16px 16px 4px 4px', border: '2px solid #3a5a5c', boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 60px rgba(0,245,255,0.35), inset 0 0 20px rgba(0,245,255,0.1)', overflow: 'hidden' }}>
                {/* Top Notch / Nav Bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '24px', background: '#2c2c2e', borderBottom: '1px solid #3a3a3c', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px', zIndex: 10 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                </div>
                {/* The Video Display */}
                <video
                  src={viralVid}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ position: 'absolute', top: '24px', left: 0, width: '100%', height: 'calc(100% - 24px)', objectFit: 'cover', transform: 'scale(1.15)' }}
                />
              </div>
              {/* Macbook Bottom Lip */}
              <div style={{ width: '115%', height: '16px', background: 'linear-gradient(to bottom, #cfd0d4, #8b8c90)', marginLeft: '-7.5%', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), 0 10px 20px rgba(0,0,0,0.6)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '15%', height: '4px', background: '#b0b1b5', borderRadius: '0 0 4px 4px' }} />
              </div>
            </div>

          </div>

          {/* Block 3: Engagement Loop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '60px', flexWrap: 'wrap' }}>

            {/* Left: Sassy Typography */}
            <div style={{ flex: '1 1 400px' }}>
              <h2 className="font-display" style={{ fontSize: 'clamp(48px, 6vw, 80px)', lineHeight: 0.95, letterSpacing: '-2px', color: '#fff', marginBottom: '24px' }}>
                One click, <br />
                <span style={{ color: '#FF3D6E', textShadow: '0 0 30px rgba(255,61,110,0.4)' }}>go live.</span>
              </h2>
              <p style={{ fontSize: '18px', color: '#888', lineHeight: 1.6, maxWidth: '400px' }}>
                Auto-generate the post and publish it directly to your connected social platforms in one tap.
              </p>
            </div>

            {/* Right: Macbook Frame */}
            <div style={{ flex: '1 1 500px', position: 'relative' }}>
              {/* Core Vibrant Backglow */}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '150%', height: '150%', background: 'radial-gradient(circle, rgba(255,61,110,0.35) 0%, rgba(255,61,110,0.08) 40%, transparent 70%)', filter: 'blur(50px)', pointerEvents: 'none', animation: 'macbookGlow 4s ease-in-out infinite 1s' }} />

              {/* The Macbook Structure */}
              <div style={{ position: 'relative', width: '100%', paddingBottom: '62.5%', background: '#1c1c1e', borderRadius: '16px 16px 4px 4px', border: '2px solid #5a3a4c', boxShadow: '0 25px 50px rgba(0,0,0,0.8), 0 0 60px rgba(255,61,110,0.35), inset 0 0 20px rgba(255,61,110,0.1)', overflow: 'hidden' }}>
                {/* Top Notch / Nav Bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '24px', background: '#2c2c2e', borderBottom: '1px solid #3a3a3c', display: 'flex', alignItems: 'center', padding: '0 12px', gap: '6px', zIndex: 10 }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ff5f56' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ffbd2e' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#27c93f' }} />
                </div>
                {/* The Video Display */}
                <video
                  src={oneClickVid}
                  autoPlay
                  muted
                  loop
                  playsInline
                  style={{ position: 'absolute', top: '24px', left: 0, width: '100%', height: 'calc(100% - 24px)', objectFit: 'cover', transform: 'scale(1.15)' }}
                />
              </div>
              {/* Macbook Bottom Lip */}
              <div style={{ width: '115%', height: '16px', background: 'linear-gradient(to bottom, #cfd0d4, #8b8c90)', marginLeft: '-7.5%', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.4), 0 10px 20px rgba(0,0,0,0.6)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '15%', height: '4px', background: '#b0b1b5', borderRadius: '0 0 4px 4px' }} />
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          STATS CAROUSEL SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <StatsCarousel />

      {/* ══════════════════════════════════════════════════════════════════════
          CTA / BOTTOM SECTION
      ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        padding: '160px 24px',
        textAlign: 'center',
        overflow: 'hidden',
        background: '#080808',
      }}>
        {/* Radial bloom background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 65% 60% at 50% 50%, rgba(255,61,110,0.14) 0%, rgba(139,92,246,0.08) 45%, transparent 70%)',
        }} />

        {/* Particle canvas */}
        <Particles />

        <div style={{ position: 'relative', zIndex: 10 }}>

          <h2
            className="font-display"
            style={{
              fontSize: 'clamp(56px, 9vw, 110px)',
              lineHeight: 0.9,
              letterSpacing: '-3px',
              marginBottom: '24px',
              color: '#F0F0F0',
            }}
          >
            Ready to <span style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.6)' }}>break</span><br />
            the <i style={{ color: '#FF3D6E', fontStyle: 'italic', paddingRight: '12px' }}>internet?</i>
          </h2>

          <p style={{ fontSize: '18px', color: '#888', maxWidth: '420px', margin: '0 auto 56px', lineHeight: 1.6 }}>
            Join the 50,000+ creators who stopped guessing and started engineering viral success on demand.
          </p>

          {/* Sassy Email capture */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            maxWidth: 520,
            margin: '0 auto',
            flexWrap: 'wrap',
          }}>
            <input
              type="email"
              placeholder="Drop your email..."
              style={{
                flex: '1 1 240px',
                borderRadius: '99px',
                padding: '20px 28px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(20px)',
                color: '#fff',
                fontSize: '16px',
                fontFamily: "'DM Sans',sans-serif",
                outline: 'none',
                cursor: 'none',
                transition: 'all 0.4s cubic-bezier(0.16,1,0.3,1)',
              }}
              onFocus={e => {
                e.target.style.borderColor = '#00F5FF';
                e.target.style.boxShadow = '0 0 30px rgba(0,245,255,0.2)';
                e.target.style.background = 'rgba(0,245,255,0.05)';
              }}
              onBlur={e => {
                e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                e.target.style.boxShadow = 'none';
                e.target.style.background = 'rgba(0,0,0,0.4)';
              }}
            />
            <button
              onClick={() => navigate('/dashboard')}
              style={{
                flexShrink: 0,
                borderRadius: '99px',
                padding: '20px 36px',
                background: 'linear-gradient(135deg, #FF3D6E, #8B5CF6)',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 700,
                fontFamily: "'Clash Display','DM Sans',sans-serif",
                cursor: 'none',
                transition: 'all 0.4s ease',
                boxShadow: '0 10px 30px rgba(255,61,110,0.3)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(255,61,110,0.5)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 10px 30px rgba(255,61,110,0.3)';
              }}
            >
              Analyze My Content →
            </button>
          </div>
        </div>
      </section>

      {/* ── Extracted Footer ── */}
      <Footer />

      {/* Responsive helpers */}
      <style>{`
        @media (max-width: 768px) {
          .hidden-mobile { display: none !important; }
          .show-mobile   { display: flex !important; }
        }
        @media (min-width: 769px) {
          .show-mobile   { display: none !important; }
        }
      `}</style>
    </div>
  );
}