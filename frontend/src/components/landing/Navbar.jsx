import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  /* Close menu on resize */
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <>
      {/* ── Mobile Menu ── */}
      <div className={`vyrlo-mobile-menu ${menuOpen ? 'open' : ''}`}>
        <button
          onClick={() => setMenuOpen(false)}
          style={{ position: 'absolute', top: 28, right: 28, background: 'none', border: 'none', color: '#888', fontSize: 28, cursor: 'none' }}
        >
          ✕
        </button>
        {['Features', 'Engine', 'Pricing', 'Docs'].map(l => (
          <a
            key={l}
            href="#"
            onClick={() => setMenuOpen(false)}
            className="font-display"
            style={{ fontSize: 32, color: '#F0F0F0', textDecoration: 'none', cursor: 'none' }}
          >
            {l}
          </a>
        ))}
        <button
          onClick={() => { setMenuOpen(false); navigate('/dashboard'); }}
          className="rounded-sm px-8 py-3 font-semibold text-sm"
          style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#fff', background: 'rgba(255,255,255,0.05)', cursor: 'none' }}
        >
          Get Started
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 8000,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 48px', height: 72,
          /* Mature, sleek glassmorphism */
          backdropFilter: 'blur(16px) saturate(180%) brightness(0.9)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%) brightness(0.9)',
          background: 'rgba(5, 5, 5, 0.4)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.03)',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Abstract geometric logo */}
          <div style={{
            width: 24, height: 24,
            border: '2px solid rgba(255,255,255,0.8)',
            borderRightColor: '#FF3D6E',
            borderBottomColor: '#FF3D6E',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transform: 'rotate(-45deg)'
          }}>
            <div style={{ width: 6, height: 6, backgroundColor: '#F0F0F0', borderRadius: '50%' }} />
          </div>
          <span className="font-display" style={{ fontSize: 22, letterSpacing: '-0.3px', color: '#F0F0F0', display: 'flex', alignItems: 'baseline' }}>
            Vincent<span style={{ fontSize: 16, color: '#FF3D6E', fontWeight: 600 }}>.ai</span>
          </span>
        </div>

        {/* Desktop Nav links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }} className="hidden-mobile">
          {['Features', 'Engine', 'Pricing', 'Docs'].map(l => (
            <a
              key={l}
              href="#"
              className="vyrlo-nav-link"
              style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', cursor: 'none', letterSpacing: '0.3px' }}
            >
              {l}
            </a>
          ))}
        </div>

        {/* Right CTA + hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button
            onClick={() => navigate('/dashboard')}
            className="vyrlo-cta-btn hidden-mobile"
            style={{
              borderRadius: '4px', // Harder angles feel more professional/mature than fully rounded pill
              padding: '10px 24px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.03)',
              color: '#fff',
              fontSize: 13, fontWeight: 500,
              fontFamily: "'DM Sans',sans-serif",
              letterSpacing: '0.5px',
              cursor: 'none',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            Get Started
          </button>

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMenuOpen(true)}
            className="show-mobile"
            style={{ background: 'none', border: 'none', color: '#F0F0F0', fontSize: 24, cursor: 'none' }}
          >
            ☰
          </button>
        </div>
      </nav>
    </>
  );
}
