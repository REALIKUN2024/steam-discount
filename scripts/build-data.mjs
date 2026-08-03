import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Steam 折扣数据构建脚本（断点续跑版）
 * 数据源：搜索接口 specials=1&category1=998（实测 14905 条打折游戏，全部带折扣）
 * 解析：折扣% / 现价 / 原价(=现价/(1-折扣)) / 好评率 / 平台 / 分类
 * 产出：public/data/discount.{i}.json 分块 + meta.json
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const CACHE_DIR = path.join(ROOT, "data", "cache");
const BASE = "https://store.steampowered.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const PAGE_SIZE = 100;
const CHUNK_SIZE = 2000;
const BACKOFF_MS = [6000, 15000, 30000];
const COOLDOWN_MS = 90000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);

let TAG_MAP = {};

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)));
}

function parseRows(html) {
  const rows = [];
  const parts = html.split('data-ds-appid="');
  for (let i = 1; i < parts.length; i++) {
    const c = parts[i];
    const id = c.match(/^(\d+)/)?.[1];
    if (!id) continue;
    const discText = c.match(/discount_pct[^>]*>([\s\S]*?)<\/div>/)?.[1]?.trim() || "";
    const discMatch = discText.match(/-(\d+)%/);
    if (!discMatch) continue;
    const discount = Number(discMatch[1]);
    if (!(discount > 0)) continue;
    const pfinal = c.match(/data-price-final="(\d+)"/)?.[1];
    const final = pfinal ? Number(pfinal) : null;
    if (final == null) continue;
    const original = Math.round(final / (1 - discount / 100));
    const name = decodeHtml(c.match(/<span class="title">([\s\S]*?)<\/span>/)?.[1]?.trim() || "");
    const image = c.match(/<img src="([^"]+)"\s*>/)?.[1] || "";
    const release = c.match(/class="search_released[^"]*">([\s\S]*?)<\/div>/)?.[1]?.trim() || "";
    const tooltip = c.match(/data-tooltip-html="([\s\S]*?)"/)?.[1] || "";
    const pct = tooltip.match(/(\d+(?:\.\d+)?)%/)?.[1];
    const tagRaw = c.match(/data-ds-tagids="\[([\d,\s]*)\]"/)?.[1] || "";
    const tagids = tagRaw.split(",").map((s) => s.trim()).filter(Boolean);
    rows.push({
      id: Number(id),
      name,
      image,
      release,
      rating: pct ? Number(pct) : null,
      win: /platform_img win/.test(c),
      mac: /platform_img mac/.test(c),
      linux: /platform_img linux/.test(c),
      discount,
      final,
      original,
      tagids,
    });
  }
  return rows;
}

async function buildTagMap() {
  const map = {};
  try {
    const res = await fetch(`${BASE}/search/?specials=1&cc=CN&l=schinese`, {
      headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
    });
    const html = await res.text();
    const re = /data-param="tags" data-value="(\d+)" data-loc="([^"]+)"/g;
    let m;
    while ((m = re.exec(html)) !== null) map[m[1]] = decodeHtml(m[2]);
    log(`标签映射：${Object.keys(map).length} 个`);
  } catch (e) {
    log(`标签映射获取失败：${e.message}`);
  }
  return map;
}

function attachGenres(items, tagMap) {
  for (const g of items) {
    const names = (g.tagids || []).map((id) => tagMap[String(id)]).filter(Boolean);
    g.genres = [...new Set(names)].slice(0, 4);
    delete g.tagids;
  }
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9" },
  });
  return res;
}

async function crawlFeed() {
  const startedAt = Date.now();
  const map = new Map();
  const pagesFile = path.join(CACHE_DIR, "discount.pages.json");
  const rowsFile = path.join(CACHE_DIR, "discount.rows.jsonl");

  const donePages = new Set(existsSync(pagesFile) ? JSON.parse(readFileSync(pagesFile, "utf8")) : []);
  if (existsSync(rowsFile)) {
    for (const line of readFileSync(rowsFile, "utf8").split("\n").filter(Boolean)) {
      try {
        const r = JSON.parse(line);
        map.set(r.id, r);
      } catch { /* skip */ }
    }
  }

  const firstRes = await fetchJson(
    `${BASE}/search/results/?query=&start=0&count=${PAGE_SIZE}&specials=1&category1=998&cc=CN&l=schinese&infinite=1`
  );
  if (!firstRes.ok) throw new Error(`首次请求 HTTP ${firstRes.status}`);
  const first = await firstRes.json();
  const total = Number(/"total_count":(\d+)/.exec(JSON.stringify(first))?.[1]) || 0;
  const maxPages = Number(process.env.MAX_PAGES);
  const pages = maxPages > 0 ? Math.min(Math.ceil(total / PAGE_SIZE), maxPages) : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const maxItems = Number(process.env.MAX_ITEMS);
  log(`目标 ${total} 条 / ${pages} 页，已完成 ${donePages.size} 页（${map.size} 条）`);

  function savePage(pageIdx, rows) {
    donePages.add(pageIdx);
    writeFileSync(pagesFile, JSON.stringify([...donePages]), "utf8");
    appendFileSync(rowsFile, rows.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
    for (const r of rows) map.set(r.id, r);
  }

  const firstRows = parseRows(first.results_html || "");
  if (!donePages.has(0)) savePage(0, firstRows);

  for (let p = 1; p < pages; p++) {
    if (donePages.has(p)) continue;
    if (maxItems > 0 && map.size >= maxItems) break;
    const start = p * PAGE_SIZE;
    const url = `${BASE}/search/results/?query=&start=${start}&count=${PAGE_SIZE}&specials=1&category1=998&cc=CN&l=schinese&infinite=1`;
    let rows = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetchJson(url);
        if (res.status === 429) throw Object.assign(new Error("429"), { code: 429 });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        rows = parseRows(j.results_html || "");
        break;
      } catch (e) {
        if (e.code === 429) {
          log(`页 ${p + 1}/${pages} 被限流(429)，第 ${attempt + 1} 次，等待 ${BACKOFF_MS[attempt]}ms`);
          await sleep(BACKOFF_MS[attempt]);
        } else {
          log(`页 ${p + 1}/${pages} 请求异常：${e.message}`);
          await sleep(3000);
        }
      }
    }
    if (rows === null) {
      log(`页 ${p + 1}/${pages} 连续限流，冷却 ${COOLDOWN_MS / 1000}s`);
      await sleep(COOLDOWN_MS);
      continue;
    }
    savePage(p, rows);
    log(`页 ${p + 1}/${pages} 完成，累计 ${map.size}`);
    await sleep(1400);
  }

  const items = [...map.values()].sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1));
  const finalItems = maxItems > 0 ? items.slice(0, maxItems) : items;
  attachGenres(finalItems, TAG_MAP);
  const updatedAt = new Date().toISOString();
  const chunkCount = Math.ceil(finalItems.length / CHUNK_SIZE);
  for (let i = 0; i < chunkCount; i++) {
    const chunk = finalItems.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    writeFileSync(
      path.join(DATA_DIR, `discount.${i}.json`),
      JSON.stringify({ updatedAt, count: chunk.length, games: chunk }),
      "utf8"
    );
  }
  const meta = { updatedAt, source: "steam", games: finalItems.length, chunks: chunkCount };
  writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta), "utf8");
  log(`完成：${finalItems.length} 条（${chunkCount} 块），耗时 ${Math.round((Date.now() - startedAt) / 1000)}s`);
  return { count: items.length, chunks: chunkCount };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(CACHE_DIR, { recursive: true });
  TAG_MAP = await buildTagMap();
  await crawlFeed();
  log("全部完成");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
