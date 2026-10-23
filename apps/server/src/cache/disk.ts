import path from 'node:path';
import { appConfig } from '../config';
import { ensureDir, readJsonFile, writeJsonFile } from '../util/fs';

interface CacheEntry<T> {
  at: number;
  data: T;
}

const cacheDir = path.join(appConfig.dataDir, 'cache');

function cachePath(name: string): string {
  const safe = name.replace(/[^A-Za-z0-9_.-]/g, '_');
  return path.join(cacheDir, `${safe}.json`);
}

export async function readCache<T>(
  name: string,
  maxAgeMs: number,
): Promise<T | null> {
  const entry = await readJsonFile<CacheEntry<T>>(cachePath(name));
  if (entry === null || typeof entry.at !== 'number') return null;
  if (Date.now() - entry.at > maxAgeMs) return null;
  return entry.data;
}

export async function readStaleCache<T>(name: string): Promise<T | null> {
  const entry = await readJsonFile<CacheEntry<T>>(cachePath(name));
  return entry?.data ?? null;
}

export async function writeCache<T>(name: string, data: T): Promise<void> {
  try {
    await ensureDir(cacheDir);
    await writeJsonFile(cachePath(name), { at: Date.now(), data });
  } catch {
    // 缓存写入失败不影响主流程。
  }
}
