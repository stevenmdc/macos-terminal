"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function AnimatedBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[var(--page-bg)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.72),transparent_40%),radial-gradient(circle_at_80%_15%,rgba(162,200,246,0.25),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.2),rgba(255,255,255,0))]" />

      <motion.div
        className="absolute -left-28 -top-24 h-[30rem] w-[30rem] rounded-full bg-[var(--blob-a)]/55 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [-18, 24, -10], y: [-14, 18, -10], scale: [1, 1.08, 0.98] }
        }
        transition={{ duration: 28, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute -right-20 top-1/3 h-[24rem] w-[24rem] rounded-full bg-[var(--blob-b)]/50 blur-3xl"
        animate={
          reduceMotion
            ? undefined
            : { x: [20, -28, 10], y: [10, -18, 10], scale: [1, 0.96, 1.05] }
        }
        transition={{ duration: 32, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />
      <motion.div
        className="absolute bottom-[-9rem] left-1/2 h-[22rem] w-[32rem] -translate-x-1/2 rounded-full bg-[var(--blob-c)]/40 blur-3xl"
        animate={reduceMotion ? undefined : { scale: [0.96, 1.06, 0.96], y: [0, -18, 0] }}
        transition={{ duration: 36, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      />

      <div className="absolute inset-0 opacity-[0.42] [background-image:radial-gradient(var(--grid-dot)_0.8px,transparent_0.9px)] [background-size:24px_24px]" />
      <div className="absolute inset-0 opacity-[0.08] [background:linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:100%_3px]" />
    </div>
  );
}
