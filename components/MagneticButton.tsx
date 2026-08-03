"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
};

export default function MagneticButton({
  children,
  className = "",
  onClick,
  ariaLabel,
}: Props) {
  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={className}
    >
      {children}
    </motion.button>
  );
}
