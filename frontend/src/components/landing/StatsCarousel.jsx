import React, { useEffect, useRef, useState } from 'react';

const STATS = [
  { val: '4B+', desc: 'MEDIA ASSETS\nGENERATED', color: '#5BC8F5' },
  { val: '16', desc: 'INDUSTRIES\nEMPOWERED', color: '#F5C842' },
  { val: '235', desc: 'COUNTRIES AND\nTERRITORIES', color: '#7FE87F' },
  { val: '120M', desc: 'ENGAGEMENTS\nTRACKED', color: '#FF3D6E' },
  { val: '0.2s', desc: 'PREDICTION\nLATENCY', color: '#B37FF6' },
  { val: '99%', desc: 'UPTIME\nRELIABILITY', color: '#FFFFFF' },
];

export default function StatsCarousel() {
  const containerRef = useRef(null);
  const cursorRef = useRef(null);
  const slidesRef = useRef([]);

  const [activeIndex, setActiveIndex] = useState(0);

  // Virtual index and physics state
  const physics = useRef({
    vIndex: 0,
    target: 0,
    drift: 0,
    cooldown: false,
    dragStartV: null,
    dragStartX: null,
  });

  useEffect(() => {
    let cancel = false;
    const loop = () => {
      if (cancel) return;
      
      const p = physics.current;
      
      // Target is activeIndex + mouse drift
      p.target = activeIndex + p.drift;

      // Lerp vIndex towards target. 0.05 matches the requested physics.
      p.vIndex += (p.target - p.vIndex) * 0.05;

      // Update slide positions natively
      slidesRef.current.forEach((slide, i) => {
        if (!slide) return;
        
        const N = STATS.length;
        // Circular distance math for N items
        let dist = (i - p.vIndex) % N;
        // JS modulo fix for negatives
        dist = ((dist % N) + N) % N;
        // Wrap distance so it's between -N/2 and N/2
        if (dist > N / 2) dist -= N;
        
        // 3D Concave Cylinder Math - Creating the "curved inside" perspective
        // Tightened spacing requested to bring the stat cards closer together
        const xOffset = dist * 22; // vw
        // Pull the side elements FORWARD out of the screen to exaggerate the concave curve
        const zOffset = Math.abs(dist) * 280; // px
        // Rotate them sharply inward to face the center
        const rotateY = dist * -50;  
        
        // Scale: slightly scaled down on sides
        const scale = 1 - Math.abs(dist) * 0.1;
        
        // Visibility cutoff: strongly hide anything beyond the immediate left/right (dist > 1.2)
        const isVisible = Math.abs(dist) < 1.8 ? 1 : 0;
        const opacity = Math.max(0, 1 - Math.abs(dist) * 0.4) * isVisible;
        
        // Apply 3D Transform
        slide.style.transform = `translateX(-50%) translateY(-50%) perspective(1200px) translateX(${xOffset}vw) translateZ(${zOffset}px) rotateY(${rotateY}deg) scale(${scale})`;
        slide.style.opacity = opacity;
        // Extremely important: elements fading into back must have lower z-index
        slide.style.zIndex = Math.round(10 - Math.abs(dist) * 5);
        // Turn off pointer events for hidden slides so they don't block interactions
        slide.style.pointerEvents = Math.abs(dist) < 0.5 ? 'auto' : 'none';
      });

      requestAnimationFrame(loop);
    };
    
    const raf = requestAnimationFrame(loop);
    return () => { cancel = true; cancelAnimationFrame(raf); };
  }, [activeIndex]);

  const handleWheel = (e) => {
    // Only react heavily to horizontal trackpad scrolling
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const p = physics.current;
      p.drift += (e.deltaX / window.innerWidth) * 2.5; 
      
      if (p.drift > 0.3) {
        setActiveIndex(prev => prev + 1);
        p.drift = 0;
      } else if (p.drift < -0.3) {
        setActiveIndex(prev => prev - 1);
        p.drift = 0;
      }
    }
  };

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;

    // Update custom cursor position
    if (cursorRef.current) {
      cursorRef.current.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }

    // Auto-drift removed to require explicit scrolling/dragging like requested
  };

  const handleMouseLeave = () => {
    physics.current.drift = 0;
    physics.current.cooldown = false;
    if (cursorRef.current) {
        cursorRef.current.style.opacity = '0';
    }
  };
  
  const handleMouseEnter = () => {
      if (cursorRef.current) {
          cursorRef.current.style.opacity = '1';
      }
  }

  // --- Touch & Drag Swipe Support ---
  const onDragStart = (e) => {
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const p = physics.current;
    p.dragStartX = x;
    p.dragStartV = activeIndex;
    p.drift = 0;
  };

  const onDragMove = (e) => {
    const p = physics.current;
    if (p.dragStartX === null) return;
    const x = e.clientX || (e.touches && e.touches[0].clientX);
    const deltaX = p.dragStartX - x;
    const vw = window.innerWidth;
    p.drift = (deltaX / vw) * 1.5; // Swipe sensitivity
  };

  const onDragEnd = () => {
    const p = physics.current;
    if (p.dragStartX === null) return;
    if (p.drift > 0.2) {
      setActiveIndex(prev => prev + 1);
    } else if (p.drift < -0.2) {
      setActiveIndex(prev => prev - 1);
    }
    p.dragStartX = null;
    p.dragStartV = null;
    p.drift = 0;
  };

  return (
    <section 
      ref={containerRef}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
      onTouchStart={onDragStart}
      onTouchMove={onDragMove}
      onTouchEnd={onDragEnd}
      onMouseDown={onDragStart}
      onMouseUp={onDragEnd}
      style={{
        position: 'relative',
        width: '100vw',
        height: '60vh',
        background: '#000000',
        overflow: 'hidden',
        cursor: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none'
      }}
    >
      {/* Custom Pointer Cursor */}
      <div 
        ref={cursorRef}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: 20, height: 20,
          borderRadius: '50%',
          background: 'rgba(255,255,255,1)',
          mixBlendMode: 'difference',
          pointerEvents: 'none',
          zIndex: 9999,
          transition: 'opacity 0.2s',
          opacity: 0,
          marginTop: '-10px',
          marginLeft: '-10px',
        }}
      />

      {/* Slides Container */}
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {STATS.map((stat, i) => {
          // Subtle 3D layering effect for depth text
          const textShadow = `0px 8px 0px ${stat.color}44, 0px 16px 20px rgba(0,0,0,0.9)`;
          
          return (
            <div 
              key={i}
              ref={el => slidesRef.current[i] = el}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                willChange: 'transform, opacity',
              }}
            >
              <h3 style={{
                fontFamily: '"Anton", "Black Han Sans", impact, sans-serif',
                fontSize: 'clamp(100px, 15vw, 240px)',
                fontWeight: 900,
                color: stat.color,
                margin: 0,
                lineHeight: 0.85,
                textShadow: textShadow,
              }}>
                {stat.val}
              </h3>
              
              <div style={{
                marginTop: '16px',
                transform: 'perspective(400px) rotateX(10deg)',
                transformOrigin: 'top center',
              }}>
                <p style={{
                  fontFamily: '"Anton", "Clash Display", sans-serif',
                  fontSize: 'clamp(20px, 2.5vw, 40px)',
                  fontWeight: 800,
                  color: stat.color,
                  margin: 0,
                  lineHeight: 1.1,
                  textTransform: 'uppercase',
                  whiteSpace: 'pre-line',
                  letterSpacing: '1px',
                }}>
                  {stat.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dot Indicators */}
      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        zIndex: 50
      }}>
        {STATS.map((stat, i) => {
          const N = STATS.length;
          // Convert infinite activeIndex back to array bounds continuously
          const mappedIndex = ((activeIndex % N) + N) % N;
          const isActive = mappedIndex === i;
          
          return (
            <div 
              key={i}
              style={{
                width: isActive ? 12 : 8,
                height: isActive ? 12 : 8,
                borderRadius: '50%',
                background: stat.color,
                opacity: isActive ? 1 : 0.25,
                transition: 'all 0.4s ease'
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
