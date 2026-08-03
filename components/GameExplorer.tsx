"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bookmark,
  CaretDown,
  MagnifyingGlass,
  Trophy,
  GameController,
  ArrowsDownUp,
  X,
  Warning,
  Tag,
  Percent,
} from "@phosphor-icons/react";
import type { DiscountGame, DiscountListPayload, MetaPayload } from "@/lib/types";
import GameGrid from "./GameGrid";
import SkeletonGrid from "./SkeletonGrid";
import MagneticButton from "./MagneticButton";

const FAV_KEY = "steam-discount-favs";
const PAGE_SIZE = 24;
const FREE_SITE_URL = "https://realikun2024.github.io/steam-free-games/";

type Filter = "all" | "fav";
type Sort = "default" | "rating" | "discount" | "price";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "fav", label: "我的收藏" },
];

const SORTS: { key: Sort; label: string }[] = [
  { key: "default", label: "默认（折扣×好评）" },
  { key: "rating", label: "好评优先" },
  { key: "discount", label: "折扣优先" },
  { key: "price", label: "折后价最低" },
];

function formatUpdated(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min((t - start) / 900, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className="font-mono tabular-nums">
      {n.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function GameExplorer() {
  const [meta, setMeta] = useState<MetaPayload | null>(null);
  const [games, setGames] = useState<DiscountGame[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [genre, setGenre] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [sort, setSort] = useState<Sort>("default");
  const [favs, setFavs] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const listKey = `${filter}:${sort}:${submittedQuery}:${genre ?? ""}`;
  const [prevListKey, setPrevListKey] = useState(listKey);
  if (prevListKey !== listKey) {
    setPrevListKey(listKey);
    setVisible(PAGE_SIZE);
  }

  const submitSearch = useCallback((value: string) => {
    setSubmittedQuery(value.trim());
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = (await fetch("data/meta.json").then((r) => {
          if (!r.ok) throw new Error(`meta HTTP ${r.status}`);
          return r.json();
        })) as MetaPayload;
        if (!alive) return;
        setMeta(m);
        setTotal(m.chunks);
        const all: DiscountGame[] = [];
        for (let i = 0; i < m.chunks; i++) {
          try {
            const res = await fetch(`data/discount.${i}.json`);
            if (!res.ok) continue;
            const d = (await res.json()) as DiscountListPayload;
            if (!alive) return;
            all.push(...d.games);
            setGames([...all]);
            setLoaded(i + 1);
          } catch {
            /* skip */
          }
        }
      } catch (e) {
        if (alive) setError((e as Error).message || "数据加载失败");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const raw = localStorage.getItem(FAV_KEY);
        if (raw) setFavs(new Set(JSON.parse(raw) as number[]));
      } catch {
        /* ignore */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const toggleFav = useCallback((id: number) => {
    setFavs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const copyLink = useCallback((game: DiscountGame) => {
    const url = `https://store.steampowered.com/app/${game.id}/`;
    navigator.clipboard?.writeText(url).catch(() => undefined);
    setCopiedId(game.id);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 1600);
  }, []);

  const stats = useMemo(() => {
    const maxDisc = games.length > 0 ? Math.max(...games.map((g) => g.discount)) : 0;
    const avgDisc =
      games.length > 0 ? Math.round(games.reduce((s, g) => s + g.discount, 0) / games.length) : 0;
    return { games: meta?.games ?? games.length, maxDisc, avgDisc };
  }, [games, meta]);

  const loading = loaded === 0;
  const loadPct = total > 0 ? Math.round((loaded / total) * 100) : 0;
  const loadingProgress = loaded > 0 && loaded < total;
  const notFullyLoaded = loaded < total;

  const filtered = useMemo(() => {
    let list = games;
    const q = submittedQuery.toLowerCase();
    if (q) list = list.filter((g) => (g.name ?? "").toLowerCase().includes(q));
    if (genre) list = list.filter((g) => (g.genres ?? []).includes(genre));
    if (filter === "fav") list = list.filter((g) => favs.has(g.id));

    const arr = [...list];
    switch (sort) {
      case "default":
        arr.sort((a, b) => {
          const sa = a.discount * ((a.rating ?? 60) / 100);
          const sb = b.discount * ((b.rating ?? 60) / 100);
          return sb - sa;
        });
        break;
      case "rating":
        arr.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
        break;
      case "discount":
        arr.sort((a, b) => b.discount - a.discount);
        break;
      case "price":
        arr.sort((a, b) => a.final - b.final);
        break;
    }
    return arr;
  }, [games, submittedQuery, filter, sort, favs, genre]);

  const genreCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of games) for (const ge of g.genres ?? []) m.set(ge, (m.get(ge) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14);
  }, [games]);

  const shown = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  return (
    <div className="min-h-[100dvh]">
      {/* ===== NavBar ===== */}
      <header className="sticky top-0 z-40 border-b border-edge bg-base/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 md:px-6">
          <a href="#top" className="flex shrink-0 items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="steam.png" alt="Steam 折扣专区" className="h-6 w-6 object-contain" />
            <span className="hidden text-[15px] font-semibold tracking-tight sm:block">
              Steam 折扣专区
            </span>
          </a>

          {notFullyLoaded && meta && (
            <div className="flex shrink-0 flex-col gap-1 border-l border-edge pl-3">
              <span className="hidden whitespace-nowrap text-[11px] text-ink-2 sm:block">
                仍在加载中，请等待，可先看看已加载的游戏
              </span>
              <div className="flex items-center gap-2">
                <div className="h-1 w-20 border border-edge bg-panel-2 sm:w-40 md:w-52">
                  <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${loadPct}%` }} />
                </div>
                <span className="font-mono text-[10px] text-ink-3">{loadPct}%</span>
              </div>
            </div>
          )}

          <div className="relative ml-auto max-w-[560px] flex-1">
            <MagnifyingGlass
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch(query);
              }}
              placeholder="搜索打折游戏名称…（回车搜索）"
              aria-label="搜索"
              className="w-full border border-edge bg-panel py-2 pl-9 pr-9 text-sm text-ink placeholder:text-ink-3 outline-none transition-colors focus:border-accent/60 focus:bg-panel-2"
            />
            {query ? (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => {
                  setQuery("");
                  setSubmittedQuery("");
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-ink"
              >
                <X size={14} />
              </button>
            ) : (
              <button
                type="button"
                aria-label="搜索"
                onClick={() => submitSearch(query)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-ink-3 hover:text-accent-strong"
              >
                <MagnifyingGlass size={15} weight="bold" />
              </button>
            )}
          </div>

          <div className="hidden shrink-0 items-center gap-2 font-mono text-[12px] text-ink-3 lg:flex">
            <span className="h-1.5 w-1.5 animate-pulse-dot bg-good" />
            数据更新于 {meta ? formatUpdated(meta.updatedAt) : "…"}
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section id="top" className="border-b border-edge">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-8 px-4 py-10 md:grid-cols-12 md:px-6 md:py-14">
          <div className="md:col-span-7">
            <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.2em] text-accent">
              Steam Discounts
            </p>
            <h1 className="max-w-[14ch] text-balance text-4xl font-bold tracking-tighter leading-[1.05] md:text-6xl">
              Steam 折扣好游，一网打尽
            </h1>
            <p className="mt-5 max-w-[60ch] text-base leading-relaxed text-ink-2">
              实时聚合 Steam 当前所有打折游戏，按折扣力度与好评率智能排序，支持搜索、筛选与收藏，不错过每一款划算的好游戏。
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <MagneticButton
                onClick={() => document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" })}
                className="border border-accent/60 bg-accent/15 px-5 py-2.5 text-sm font-medium text-accent-strong transition-colors hover:bg-accent/25"
              >
                开抢
              </MagneticButton>
              <a
                href={FREE_SITE_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-2 border border-good/50 bg-good/10 px-6 py-3 text-sm font-semibold text-good transition-colors hover:bg-good/20"
              >
                免费专区
              </a>
              <MagneticButton
                onClick={() => setFilter("fav")}
                className="flex items-center gap-2 border border-edge px-5 py-2.5 text-sm text-ink-2 transition-colors hover:border-edge-2 hover:text-ink"
              >
                <Bookmark size={15} weight="fill" />
                我的收藏{" "}
                <span suppressHydrationWarning>{favs.size > 0 ? `(${favs.size})` : ""}</span>
              </MagneticButton>
            </div>
          </div>

          <div className="md:col-span-5">
            <div className="grid grid-cols-2 gap-px border border-edge bg-edge">
              {[
                { label: "在售折扣游戏", value: stats.games, icon: GameController },
                { label: "最高折扣", value: stats.maxDisc, icon: Percent, suffix: "%" },
                { label: "平均折扣", value: stats.avgDisc, icon: Tag, suffix: "%" },
                { label: "我的收藏", value: favs.size, icon: Trophy },
              ].map((s) => (
                <div key={s.label} className="bg-base p-5">
                  <s.icon size={18} className="mb-3 text-ink-3" />
                  <div className="text-3xl font-bold tracking-tighter">
                    <CountUp value={s.value} suffix={s.suffix ?? ""} />
                  </div>
                  <div className="mt-1 text-[12px] text-ink-3">{s.label}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-[11px] leading-relaxed text-ink-3">
              {meta ? `SOURCE STEAM · ${new Date(meta.updatedAt).toLocaleString("zh-CN")} 同步` : "SOURCE STEAM · 同步中…"}
            </p>
          </div>
        </div>
      </section>

      {/* ===== Browse / Filter Bar ===== */}
      <section id="browse" className="mx-auto max-w-[1400px] px-4 pt-8 md:px-6">
        <div className="flex flex-col gap-4 border-b border-edge pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 text-[13px] font-medium transition-colors active:translate-y-[1px] ${
                  filter === f.key ? "border border-accent/60 bg-accent/15 text-accent-strong" : "border border-edge text-ink-2 hover:border-edge-2 hover:text-ink"
                }`}
              >
                {f.label}
                <span suppressHydrationWarning>{f.key === "fav" && favs.size > 0 ? ` ${favs.size}` : ""}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!loading && (
              <span className="font-mono text-[12px] text-ink-3">
                {loadingProgress ? (
                  <>已加载 {loaded}/{total} 块 · 已见 {filtered.length.toLocaleString()} 款</>
                ) : (
                  <>共 {filtered.length.toLocaleString()} 款</>
                )}
              </span>
            )}
            <label className="flex items-center gap-2">
              <ArrowsDownUp size={15} className="text-ink-3" />
              <span className="sr-only">排序方式</span>
              <div className="relative">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as Sort)}
                  className="appearance-none border border-edge bg-panel py-1.5 pl-3 pr-9 text-[13px] text-ink outline-none transition-colors focus:border-accent/60"
                >
                  {SORTS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <CaretDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
              </div>
            </label>
          </div>
        </div>

        {genreCounts.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto border-b border-edge py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.15em] text-ink-3">分类</span>
            <button
              type="button"
              onClick={() => setGenre(null)}
              className={`shrink-0 px-2.5 py-1 text-[12px] transition-colors active:translate-y-[1px] ${
                genre === null ? "border border-accent/60 bg-accent/15 text-accent-strong" : "border border-edge text-ink-2 hover:text-ink"
              }`}
            >
              全部
            </button>
            {genreCounts.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => setGenre(genre === name ? null : name)}
                className={`shrink-0 px-2.5 py-1 text-[12px] transition-colors active:translate-y-[1px] ${
                  genre === name ? "border border-accent/60 bg-accent/15 text-accent-strong" : "border border-edge text-ink-2 hover:border-edge-2 hover:text-ink"
                }`}
              >
                {name}
                <span className="ml-1 font-mono text-[10px] text-ink-3">{count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}

        {/* ===== Content states ===== */}
        <div className="py-8">
          {loading && <SkeletonGrid />}

          {error && !loading && (
            <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-4 border border-bad/40 bg-bad/5 p-10 text-center">
              <Warning size={36} className="text-bad" />
              <p className="text-lg font-semibold text-ink">数据加载失败</p>
              <p className="max-w-[45ch] font-mono text-[13px] text-ink-2">{error}</p>
              <button
                type="button"
                onClick={() => location.reload()}
                className="mt-2 border border-accent/50 bg-accent/10 px-5 py-2 text-sm text-accent-strong hover:bg-accent/20"
              >
                重新加载
              </button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 border border-edge bg-panel p-10 text-center">
              <GameController size={40} className="text-ink-3" />
              <p className="text-lg font-semibold text-ink">{filter === "fav" ? "还没有收藏任何内容" : "没有找到匹配的内容"}</p>
              <p className="text-sm text-ink-2">
                {filter === "fav"
                  ? "点击任意卡片上的收藏图标即可收藏"
                  : submittedQuery
                    ? `没有找到「${submittedQuery}」，换个关键词再试试`
                    : "试试切换筛选条件"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setSubmittedQuery("");
                  setFilter("all");
                }}
                className="mt-2 border border-edge px-4 py-1.5 text-[13px] text-ink-2 hover:border-edge-2 hover:text-ink"
              >
                清除筛选
              </button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <>
              <GameGrid
                gridKey={listKey}
                games={shown}
                favs={favs}
                copiedId={copiedId}
                onToggleFav={toggleFav}
                onCopy={copyLink}
              />
              {hasMore && (
                <div className="mt-10 flex justify-center">
                  <MagneticButton
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="border border-edge px-8 py-3 text-sm text-ink-2 transition-colors hover:border-accent/50 hover:text-accent-strong"
                  >
                    加载更多（还剩 {filtered.length - visible} 款）
                  </MagneticButton>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-edge">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-4 py-8 text-[12px] text-ink-3 md:flex-row md:items-center md:justify-between md:px-6">
          <p>
            Steam 折扣专区 · 数据来源 Steam 官方商店接口，非官方站点。想白嫖？{" "}
            <a href={FREE_SITE_URL} className="text-accent-strong hover:underline">
              去免费专区
            </a>
          </p>
          <p className="font-mono">
            {meta ? `最后同步 ${meta.updatedAt.slice(0, 16).replace("T", " ")} UTC · ${meta.games} 款` : "同步中…"}
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {copiedId != null && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-good/40 bg-panel px-4 py-2 font-mono text-[12px] text-good shadow-[0_10px_30px_-10px_rgba(52,211,153,0.25)]"
          >
            链接已复制到剪贴板
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
