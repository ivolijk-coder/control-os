'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, transitionOut } from '@/lib/motion';

/** Entrada suave usada para escalonar (stagger) os blocos da Home. */
export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      transition={transitionOut(undefined, delay)}
      className={className}
    >
      {children}
    </motion.div>
  );
}
