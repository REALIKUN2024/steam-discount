"use client";

import { motion, type Variants } from "framer-motion";
import type { DiscountGame } from "@/lib/types";
import GameCard from "./GameCard";

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.03 } },
};

type Props = {
  gridKey: string;
  games: DiscountGame[];
  favs: Set<number>;
  copiedId: number | null;
  onToggleFav: (id: number) => void;
  onCopy: (game: DiscountGame) => void;
};

export default function GameGrid({
  gridKey,
  games,
  favs,
  copiedId,
  onToggleFav,
  onCopy,
}: Props) {
  return (
    <motion.div
      key={gridKey}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
    >
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          fav={favs.has(game.id)}
          copied={copiedId === game.id}
          onToggleFav={onToggleFav}
          onCopy={onCopy}
        />
      ))}
    </motion.div>
  );
}
