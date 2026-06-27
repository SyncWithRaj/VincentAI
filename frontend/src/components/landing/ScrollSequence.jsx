import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const images = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop", // Abstract dark
  "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?q=80&w=2670&auto=format&fit=crop", // 3d neon
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2670&auto=format&fit=crop", // Retro tech
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=2574&auto=format&fit=crop", // Glowing shapes
  "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2670&auto=format&fit=crop", // Cyberpunk
];

export default function ScrollSequence() {
  const containerRef = useRef(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  // Center Main Image (scales up and fades slightly)
  const scaleCenter = useTransform(scrollYProgress, [0, 0.5, 1], [1, 2.5, 4]);
  const opacityCenter = useTransform(scrollYProgress, [0, 0.8, 1], [1, 1, 0]);

  // Left Image 1
  const xLeft1 = useTransform(scrollYProgress, [0, 0.5, 1], [0, -300, -800]);
  const yLeft1 = useTransform(scrollYProgress, [0, 0.5, 1], [0, -100, -300]);
  const scaleLeft1 = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1.2, 1.5]);
  const rotateLeft1 = useTransform(scrollYProgress, [0, 1], [0, -15]);

  // Right Image 1
  const xRight1 = useTransform(scrollYProgress, [0, 0.5, 1], [0, 300, 800]);
  const yRight1 = useTransform(scrollYProgress, [0, 0.5, 1], [0, 100, 300]);
  const scaleRight1 = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1.2, 1.5]);
  const rotateRight1 = useTransform(scrollYProgress, [0, 1], [0, 15]);

  // Left Image 2
  const xLeft2 = useTransform(scrollYProgress, [0, 0.6, 1], [0, -500, -1200]);
  const yLeft2 = useTransform(scrollYProgress, [0, 0.6, 1], [0, 200, 500]);
  const scaleLeft2 = useTransform(scrollYProgress, [0, 0.6, 1], [0.3, 1, 1.3]);
  const rotateLeft2 = useTransform(scrollYProgress, [0, 1], [0, -25]);

  // Right Image 2
  const xRight2 = useTransform(scrollYProgress, [0, 0.6, 1], [0, 500, 1200]);
  const yRight2 = useTransform(scrollYProgress, [0, 0.6, 1], [0, -200, -500]);
  const scaleRight2 = useTransform(scrollYProgress, [0, 0.6, 1], [0.3, 1, 1.3]);
  const rotateRight2 = useTransform(scrollYProgress, [0, 1], [0, 25]);

  // Text Fade in/out
  const textOpacity = useTransform(scrollYProgress, [0, 0.2, 0.4], [1, 0, 0]);
  const endTextOpacity = useTransform(scrollYProgress, [0.7, 0.9, 1], [0, 1, 1]);
  const endTextScale = useTransform(scrollYProgress, [0.7, 1], [0.8, 1]);

  return (
    <div ref={containerRef} className="h-[400vh] relative bg-slate-950 w-full">
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
        
        {/* Background ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(244,63,94,0.15),transparent_60%)]"></div>

        {/* Spread Images */}
        <div className="relative w-full max-w-4xl aspect-[16/9] flex items-center justify-center pointer-events-none z-10">
          
          {/* Left 2 */}
          <motion.div
            className="absolute w-64 h-80 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ x: xLeft2, y: yLeft2, scale: scaleLeft2, rotate: rotateLeft2 }}
          >
            <img src={images[4]} className="w-full h-full object-cover" alt="Gen AI 4" />
          </motion.div>

          {/* Right 2 */}
          <motion.div
            className="absolute w-64 h-80 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ x: xRight2, y: yRight2, scale: scaleRight2, rotate: rotateRight2 }}
          >
            <img src={images[3]} className="w-full h-full object-cover" alt="Gen AI 3" />
          </motion.div>

          {/* Left 1 */}
          <motion.div
            className="absolute w-72 h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ x: xLeft1, y: yLeft1, scale: scaleLeft1, rotate: rotateLeft1 }}
          >
            <img src={images[1]} className="w-full h-full object-cover" alt="Gen AI 1" />
          </motion.div>

          {/* Right 1 */}
          <motion.div
            className="absolute w-72 h-96 rounded-2xl overflow-hidden shadow-2xl border border-white/10"
            style={{ x: xRight1, y: yRight1, scale: scaleRight1, rotate: rotateRight1 }}
          >
            <img src={images[2]} className="w-full h-full object-cover" alt="Gen AI 2" />
          </motion.div>

          {/* Center Image */}
          <motion.div
            className="absolute w-96 h-[30rem] rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(244,63,94,0.3)] border border-white/20 z-20"
            style={{ scale: scaleCenter, opacity: opacityCenter }}
          >
            <img src={images[0]} className="w-full h-full object-cover" alt="Gen AI Center" />
          </motion.div>
        
        </div>

        {/* Foreground Content Initial */}
        <motion.div 
          className="absolute z-30 flex flex-col items-center pointer-events-none"
          style={{ opacity: textOpacity }}
        >
          <div className="bg-black/40 backdrop-blur-md px-8 py-4 rounded-full border border-white/10 mb-6">
            <span className="text-white/80 font-medium tracking-wide">SCROLL TO EXPLORE</span>
          </div>
        </motion.div>

        {/* Foreground Content Final */}
        <motion.div 
          className="absolute z-40 flex flex-col items-center justify-center w-full h-full pointer-events-none"
          style={{ opacity: endTextOpacity, scale: endTextScale }}
        >
          <h2 className="text-6xl md:text-8xl font-bold text-white tracking-tighter mb-6 text-center drop-shadow-2xl mix-blend-plus-lighter">
            Limitless <br/> Imagination
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full mb-8 shadow-[0_0_20px_rgba(244,63,94,0.6)]"></div>
          <p className="text-xl md:text-2xl text-white/80 max-w-2xl text-center backdrop-blur-sm bg-black/20 p-4 rounded-2xl border border-white/10">
            Unleash the power of AI to create stunning visuals in seconds. Every pixel, perfected by neural networks.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
