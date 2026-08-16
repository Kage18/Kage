// Who taught the repo each thing — resolved in ONE git pass.
//
// The naive version asked git for the author of every packet file individually. On a
// repo with 299 packets that is 299 process spawns and took 12.4 seconds, which made
// the whole console feel broken. One `git log --name-only` walk answers the same
// question in a single spawn.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { packetsDir } from "../kernel.js";
import { git } from "./git.js";

export interface PacketProvenance {
  /** packet id → last git author of the file that holds it. */
  authorById: Map<string, string>;
  /** packet id → absolute file path. */
  pathById: Map<string, string>;
}

interface CacheEntry {
  at: number;
  newestMtimeMs: number;
  fileCount: number;
  value: PacketProvenance;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000;

function packetFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(dir, name));
}

// Newest packet mtime + count is a cheap fingerprint: it changes whenever a packet is
// written, ratified, or removed, so the cache refreshes exactly when it should.
function storeFingerprint(files: string[]): { newestMtimeMs: number; fileCount: number } {
  let newest = 0;
  for (const file of files) {
    try {
      const mtime = statSync(file).mtimeMs;
      if (mtime > newest) newest = mtime;
    } catch {
      // Vanished mid-scan; the count check still catches it.
    }
  }
  return { newestMtimeMs: newest, fileCount: files.length };
}

function authorsByPath(projectDir: string, dir: string): Map<string, string> {
  const out = new Map<string, string>();
  // One walk, newest commit first: the first time a path appears is its last author.
  const log = git(projectDir, ["log", "--format=%x01%an", "--name-only", "--", dir]);
  if (!log.ok || !log.stdout) return out;
  let author = "";
  for (const line of log.stdout.split("\n")) {
    if (line.startsWith("")) {
      author = line.slice(1).trim();
      continue;
    }
    const path = line.trim();
    if (!path || !author || out.has(path)) continue;
    out.set(path, author);
  }
  return out;
}

export function packetProvenance(projectDir: string): PacketProvenance {
  const dir = packetsDir(projectDir);
  const files = packetFiles(dir);
  const fingerprint = storeFingerprint(files);
  const cached = cache.get(projectDir);
  if (
    cached &&
    Date.now() - cached.at < CACHE_TTL_MS &&
    cached.newestMtimeMs === fingerprint.newestMtimeMs &&
    cached.fileCount === fingerprint.fileCount
  ) {
    return cached.value;
  }

  const relativeAuthors = authorsByPath(projectDir, dir);
  const authorById = new Map<string, string>();
  const pathById = new Map<string, string>();
  for (const file of files) {
    let id: string | undefined;
    try {
      // The id lives in the frontmatter; a partial read is enough and keeps 300-packet
      // stores off the slow path.
      id = readFileSync(file, "utf8").slice(0, 2048).match(/^x-kage-id:\s*"([^"]+)"/m)?.[1];
    } catch {
      continue;
    }
    if (!id) continue;
    pathById.set(id, file);
    const relative = file.startsWith(`${projectDir}/`) ? file.slice(projectDir.length + 1) : file;
    const author = relativeAuthors.get(relative);
    if (author) authorById.set(id, author);
  }

  const value: PacketProvenance = { authorById, pathById };
  cache.set(projectDir, { at: Date.now(), ...fingerprint, value });
  return value;
}
