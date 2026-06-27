import React from 'react';

export default function Footer() {
  return (
    <footer style={{
      display: 'flex', flexDirection: 'column', gap: 32,
      padding: '48px 48px 32px 48px',
      background: '#020202', // Slightly darker than the main background for contrast
      borderTop: '1px solid rgba(255,255,255,0.03)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32
      }}>
        {/* Branding & Tagline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 300 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 22, height: 22,
              border: '2px solid rgba(255,255,255,0.8)',
              borderRightColor: '#FF3D6E',
              borderBottomColor: '#FF3D6E',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'rotate(-45deg)'
            }}>
              <div style={{ width: 5, height: 5, backgroundColor: '#F0F0F0', borderRadius: '50%' }} />
            </div>
            <span className="font-display" style={{ fontSize: 20, letterSpacing: '-0.3px', color: '#F0F0F0', display: 'flex', alignItems: 'baseline' }}>
              Vincent<span style={{ fontSize: 14, color: '#FF3D6E', fontWeight: 600 }}>.ai</span>
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
            Advanced viral analytics and engagement prediction engine. Stop guessing algorithms.
          </p>
        </div>

        {/* Footer Links Matrix */}
        <div style={{ display: 'flex', gap: 64, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>Platform</span>
            {['Engine', 'Features', 'Pricing', 'API'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', cursor: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >{l}</a>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '1px' }}>Legal</span>
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(l => (
              <a key={l} href="#" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textDecoration: 'none', cursor: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >{l}</a>
            ))}
          </div>
        </div>
      </div>

      <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.05)' }} />

      {/* Copyright */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
          © {new Date().getFullYear()} Vincent.ai. All rights reserved.
        </p>
        <div style={{ display: 'flex', gap: 16 }}>
           {['𝕏', 'in', 'gh'].map(social => (
              <a key={social} href="#" style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', cursor: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#FF3D6E'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
              >{social}</a>
           ))}
        </div>
      </div>
    </footer>
  );
}
