import path from 'node:path';
import { rm } from 'node:fs/promises';
import type { AuthUser } from '@vp/core';
import { AuthRequiredError } from '../errors';
import { luoguJson } from '../luogu/http';
import { asRecord, asString } from '../util/guards';
import { ensureDir, readJsonFile, writeJsonFile } from '../util/fs';

export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface StorageState {
  cookies: StoredCookie[];
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

export interface SessionMeta {
  user: AuthUser | null;
  savedAt: number;
}

const USER_CACHE_MS = 30 * 1000;

export class SessionStore {
  readonly statePath: string;
  readonly metaPath: string;
  private userCache: { user: AuthUser | null; at: number } | null = null;

  constructor(dataDir: string) {
    this.statePath = path.join(dataDir, 'session.json');
    this.metaPath = path.join(dataDir, 'session-meta.json');
  }

  async loadState(): Promise<StorageState | null> {
    const raw = await readJsonFile<StorageState>(this.statePath);
    if (raw === null || !Array.isArray(raw.cookies)) return null;
    return {
      cookies: raw.cookies,
      origins: Array.isArray(raw.origins) ? raw.origins : [],
    };
  }

  async saveStorageState(state: StorageState): Promise<void> {
    await ensureDir(path.dirname(this.statePath));
    await writeJsonFile(this.statePath, state);
    this.userCache = null;
  }

  async cookieHeader(): Promise<string | null> {
    const state = await this.loadState();
    if (state === null) return null;
    const now = Date.now() / 1000;
    const cookies = state.cookies.filter((cookie) => {
      const domain = cookie.domain.replace(/^\./, '');
      const matchesDomain = domain === 'luogu.com.cn' || domain.endsWith('.luogu.com.cn');
      const alive = cookie.expires === -1 || cookie.expires > now;
      return matchesDomain && alive && cookie.name !== '';
    });
    if (cookies.length === 0) return null;
    return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  }

  /** 用保存的 Cookie 轻量检查登录状态；不启动浏览器。 */
  async currentUser(force = false): Promise<AuthUser | null> {
    if (!force && this.userCache !== null && Date.now() - this.userCache.at < USER_CACHE_MS) {
      return this.userCache.user;
    }

    const cookies = await this.cookieHeader();
    if (cookies === null) {
      this.userCache = { user: null, at: Date.now() };
      return null;
    }

    try {
      const json = await luoguJson<Record<string, unknown>>('/problem/P1001', {
        cookies,
        retries: 1,
      });
      const user = asRecord(json.user ?? asRecord(json.data).user);
      const uid = Number(user.uid);
      if (!Number.isFinite(uid) || uid <= 0) {
        this.userCache = { user: null, at: Date.now() };
        return null;
      }
      const normalized: AuthUser = {
        uid,
        name: asString(user.name, String(uid)),
      };
      this.userCache = { user: normalized, at: Date.now() };
      return normalized;
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        this.userCache = { user: null, at: Date.now() };
        return null;
      }
      throw error;
    }
  }

  rememberUser(user: AuthUser | null): void {
    this.userCache = { user, at: Date.now() };
  }

  async readMeta(): Promise<SessionMeta | null> {
    return readJsonFile<SessionMeta>(this.metaPath);
  }

  async writeMeta(user: AuthUser | null): Promise<void> {
    await ensureDir(path.dirname(this.metaPath));
    await writeJsonFile(this.metaPath, { user, savedAt: Date.now() });
  }

  async clear(): Promise<void> {
    this.userCache = null;
    await Promise.all([
      rm(this.statePath, { force: true }),
      rm(this.metaPath, { force: true }),
    ]);
  }
}
