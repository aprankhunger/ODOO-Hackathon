import { useEffect, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

// Gooey metaball trail cursor.
// A chain of blobs follows the pointer, each one lagging slightly more than
// the last. An SVG "goo" filter (blur + alpha contrast) makes nearby blobs
// melt and fuse into each other like living slime. Fast movement stretches
// the chain into a liquid streak; stopping makes it collapse back into one
// blob. Clicking makes the goo swell and splat.

const TRAIL = [
  // size (px), spring stiffness, damping
  { size: 30, stiffness: 1000, damping: 60 },
  { size: 24, stiffness: 550, damping: 45 },
  { size: 19, stiffness: 380, damping: 38 },
  { size: 15, stiffness: 260, damping: 32 },
  { size: 11, stiffness: 180, damping: 28 },
  { size: 8, stiffness: 130, damping: 24 },
];

function useGooChain(mouseX, mouseY) {
  // Each blob springs toward the previous blob's position, forming a chain.
  // Hooks are called in a fixed order since TRAIL is a module constant.
  const xs = [];
  const ys = [];
  let prevX = mouseX;
  let prevY = mouseY;
  for (const { stiffness, damping } of TRAIL) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const x = useSpring(prevX, { stiffness, damping, mass: 0.5 });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const y = useSpring(prevY, { stiffness, damping, mass: 0.5 });
    xs.push(x);
    ys.push(y);
    prevX = x;
    prevY = y;
  }
  return { xs, ys };
}

export default function JigglyCursor() {
  const [enabled, setEnabled] = useState(false);
  const [pressed, setPressed] = useState(false);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const { xs, ys } = useGooChain(mouseX, mouseY);

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
      {/* SVG goo filter: blur the blobs, then crush the alpha channel so
          overlapping blurs merge into a single continuous blob outline */}
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <defs>
          <filter id="goo-cursor">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -11"
              result="goo"
            />
            <feComposite in="SourceGraphic" in2="goo" operator="atop" />
          </filter>
        </defs>
      </svg>

      {/* Goo layer: all blobs live inside one filtered container */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[9998]"
        style={{ filter: 'url(#goo-cursor)' }}
      >
        {TRAIL.map((blob, i) => (
          <motion.div
            key={i}
            className="absolute top-0 left-0 rounded-full bg-accentYellow"
            style={{
              width: blob.size,
              height: blob.size,
              x: xs[i],
              y: ys[i],
              translateX: '-50%',
              translateY: '-50%',
            }}
            animate={{ scale: pressed ? 1.5 : 1 }}
            transition={{
              type: 'spring',
              stiffness: 350,
              damping: 22,
              delay: i * 0.02,
            }}
          />
        ))}
      </div>

      {/* Small ink dot pinned exactly to the pointer for precision */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[9999] h-1.5 w-1.5 rounded-full bg-ink"
        style={{ x: mouseX, y: mouseY, translateX: '-50%', translateY: '-50%' }}
      />
    </>
  );
}
