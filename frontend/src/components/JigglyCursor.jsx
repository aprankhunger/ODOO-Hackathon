import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

// Animated jiggly circle cursor.
// A wobbly spring-follower circle that squishes and stretches based on
// how fast the mouse moves, and squeezes down on click.
export default function JigglyCursor() {
  const [enabled, setEnabled] = useState(false);
  const [pressed, setPressed] = useState(false);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  // Tight, critically-damped spring: keeps up with fast movement,
  // trailing only a tiny bit before catching up — no bounce, no lag.
  const springX = useSpring(mouseX, { stiffness: 1200, damping: 70, mass: 0.4 });
  const springY = useSpring(mouseY, { stiffness: 1200, damping: 70, mass: 0.4 });

  // Liquid deformation driven by the (small) lag distance. Since the circle
  // stays close now, the divisor is small so quick flicks still produce a
  // visible fluid stretch, smoothed through its own spring.
  const dx = useTransform(() => mouseX.get() - springX.get());
  const dy = useTransform(() => mouseY.get() - springY.get());
  const rawStretch = useTransform(() => {
    const dist = Math.min(Math.hypot(dx.get(), dy.get()), 24);
    return dist / 24; // 0..1
  });
  const stretch = useSpring(rawStretch, { stiffness: 300, damping: 30, mass: 0.4 });
  const scaleX = useTransform(stretch, (s) => 1 + s * 0.35);
  const scaleY = useTransform(stretch, (s) => 1 - s * 0.2);
  const rotate = useTransform(() => (Math.atan2(dy.get(), dx.get()) * 180) / Math.PI);

  useEffect(() => {
    // Enable for mouse users; skip touch-primary devices (phones/tablets)
    const hasFinePointer =
      window.matchMedia('(pointer: fine)').matches ||
      window.matchMedia('(any-pointer: fine)').matches;
    const isTouchPrimary = window.matchMedia('(pointer: coarse)').matches;
    if (!hasFinePointer && isTouchPrimary) return;
    setEnabled(true);

    const move = (e) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);

    window.addEventListener('mousemove', move);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    document.documentElement.classList.add('jiggly-cursor-active');

    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      document.documentElement.classList.remove('jiggly-cursor-active');
    };
  }, [mouseX, mouseY]);

  if (!enabled) return null;

  return (
    <>
      {/* Small dot pinned exactly to the pointer for precision */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-1.5 w-1.5 rounded-full bg-ink"
        style={{ x: mouseX, y: mouseY, translateX: '-50%', translateY: '-50%' }}
      />
      {/* The jiggly circle chasing the pointer */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9998] h-8 w-8 rounded-full border-2 border-ink bg-accentYellow/60"
        style={{
          x: springX,
          y: springY,
          translateX: '-50%',
          translateY: '-50%',
          scaleX,
          scaleY,
          rotate,
        }}
        animate={{ scale: pressed ? 0.75 : 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      />
    </>
  );
}
