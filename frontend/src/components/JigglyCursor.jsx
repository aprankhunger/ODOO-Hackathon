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

  // Loose, bouncy spring = the jiggle
  const springX = useSpring(mouseX, { stiffness: 350, damping: 18, mass: 0.7 });
  const springY = useSpring(mouseY, { stiffness: 350, damping: 18, mass: 0.7 });

  // Squish based on how far the circle is lagging behind the real cursor
  const dx = useTransform(() => mouseX.get() - springX.get());
  const dy = useTransform(() => mouseY.get() - springY.get());
  const stretch = useTransform(() => {
    const dist = Math.min(Math.hypot(dx.get(), dy.get()), 60);
    return dist / 60; // 0..1
  });
  const scaleX = useTransform(stretch, (s) => 1 + s * 0.6);
  const scaleY = useTransform(stretch, (s) => 1 - s * 0.35);
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
        animate={{ scale: pressed ? 0.55 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 15 }}
      />
    </>
  );
}
