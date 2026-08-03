"use client";

import { memo } from "react";
import { motion, type Variants } from "framer-motion";
import type { DiscountGame } from "@/lib/types";

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 120, damping: 20 },
  },
};

type Props = {
  game: DiscountGame;
  fav: boolean;
  copied: boolean;
  onToggleFav: (id: number) => void;
  onCopy: (game: DiscountGame) => void;
};

function ratingColor(r: number | null) {
  if (r == null) return null;
  if (r >= 80) return "bg-good/10 text-good border-good/30";
  if (r >= 60) return "bg-warn/10 text-warn border-warn/30";
  return "bg-bad/10 text-bad border-bad/30";
}

const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

function GameCardBase({ game, fav, copied, onToggleFav, onCopy }: Props) {
  const storeUrl = `https://store.steampowered.com/app/${game.id}/`;

  return (
    <motion.article
      variants={itemVariants}
      className="group flex flex-col border border-edge bg-panel transition-colors duration-300 hover:bg-panel-2 hover:border-edge-2 focus-within:bg-panel-2"
    >
      <a
        href={storeUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="relative block aspect-[16/9] overflow-hidden border-b border-edge bg-panel-2"
        aria-label={`在 Steam 中打开 ${game.name}`}
      >
        {game.image ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={game.image}
            alt={game.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">
            无封面
          </div>
        )}
        <span className="absolute left-0 top-0 border-b border-r border-edge bg-black/70 px-2 py-1 text-[13px] font-bold tracking-wide text-warn">
          -{game.discount}%
        </span>
        {ratingColor(game.rating) && (
          <span
            className={`absolute right-0 top-0 border-b border-l border-edge px-2 py-1 font-mono text-[12px] font-semibold ${ratingColor(game.rating)}`}
          >
            {game.rating}%
          </span>
        )}
      </a>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 min-h-10 text-[15px] font-semibold tracking-tight text-ink">
          {game.name}
        </h3>

        <div className="flex items-baseline gap-2 pt-1">
          <span className="font-mono text-[16px] font-bold text-accent-strong">
            {yuan(game.final)}
          </span>
          <span className="font-mono text-[12px] text-ink-3 line-through">
            {yuan(game.original)}
          </span>
        </div>

        <div className="mt-auto flex items-center gap-2 pt-1">
          {game.release && (
            <span className="truncate font-mono text-[11px] text-ink-3">
              {game.release.replace(/\s+/g, "")}
            </span>
          )}
          <span className="ml-auto flex items-center gap-2 text-ink-3">
            {game.win && <span className="text-[10px]">Win</span>}
            {game.mac && <span className="text-[10px]">Mac</span>}
            {game.linux && <span className="text-[10px]">Linux</span>}
          </span>
        </div>

        <div className="flex items-stretch gap-2 pt-1">
          <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="flex flex-1 items-center justify-center gap-1.5 border border-accent/50 bg-accent/10 px-3 py-1.5 text-[13px] font-medium text-accent-strong transition-colors hover:bg-accent/20 active:translate-y-[1px]"
          >
            打开商店
          </a>
          <button
            type="button"
            onClick={() => onCopy(game)}
            aria-label="复制商店链接"
            title="复制商店链接"
            className="flex w-10 items-center justify-center border border-edge text-ink-2 transition-colors hover:text-accent-strong active:translate-y-[1px]"
          >
            {copied ? <span className="text-good">✓</span> : <span>复制</span>}
          </button>
          <button
            type="button"
            onClick={() => onToggleFav(game.id)}
            aria-label={fav ? "取消收藏" : "收藏"}
            title={fav ? "取消收藏" : "收藏"}
            className={`flex w-10 items-center justify-center border transition-colors active:translate-y-[1px] ${
              fav ? "border-accent/50 bg-accent/10 text-accent-strong" : "border-edge text-ink-2 hover:text-accent-strong"
            }`}
          >
            {fav ? "★" : "☆"}
          </button>
        </div>
      </div>
    </motion.article>
  );
}

const GameCard = memo(GameCardBase);
export default GameCard;
