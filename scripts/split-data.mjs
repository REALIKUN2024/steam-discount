import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 将大 JSON 拆分为小分块（约 2000 条/块），供渐进加载。
 * 读取 public/data/{games,demos}.json，产出 games.{i}.json / demos.{i}.json 并更新 meta.json。
 */
const ROOT = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.join(ROOT, "public", "data");
const CHUNK_SIZE = 2000;

function split(sourceFile, baseName, updatedAt) {
  const data = JSON.parse(readFileSync(path.join(DATA_DIR, sourceFile), "utf8"));
  const games = data.games;
  const count = Math.ceil(games.length / CHUNK_SIZE);
  for (let i = 0; i < count; i++) {
    const chunk = games.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
    writeFileSync(
      path.join(DATA_DIR, `${baseName}.${i}.json`),
      JSON.stringify({ updatedAt, count: chunk.length, games: chunk }),
      "utf8"
    );
  }
  rmSync(path.join(DATA_DIR, sourceFile), { force: true });
  console.log(`${sourceFile} -> ${count} 块 (${games.length} 条)`);
  return count;
}

const gamesData = JSON.parse(readFileSync(path.join(DATA_DIR, "games.json"), "utf8"));
const demosData = JSON.parse(readFileSync(path.join(DATA_DIR, "demos.json"), "utf8"));
const updatedAt = new Date().toISOString();

const gameChunks = split("games.json", "games", updatedAt);
const demoChunks = split("demos.json", "demos", updatedAt);

const meta = {
  updatedAt,
  source: "steam",
  games: gamesData.count,
  demos: demosData.count,
  gameChunks,
  demoChunks,
};
writeFileSync(path.join(DATA_DIR, "meta.json"), JSON.stringify(meta), "utf8");
console.log(`meta: ${JSON.stringify(meta)}`);
