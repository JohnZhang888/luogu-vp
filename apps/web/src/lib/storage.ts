import type { ContestState } from '@vp/core';
import { CONTEST_FORMATS } from '@vp/core';

const CONTEST_KEY = 'vp.contest.v1';
const DRAFT_PREFIX = 'vp.draft.v1.';

export interface ContestLoadResult {
  state: ContestState | null;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArrayLike(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isContestState(value: unknown): value is ContestState {
  if (!isRecord(value) || value.schemaVersion !== 1) return false;
  const config = value.config;
  const runtime = value.runtime;
  if (!isRecord(config) || !isRecord(runtime)) return false;

  if (typeof config.id !== 'string' || typeof config.name !== 'string') return false;
  if (!CONTEST_FORMATS.includes(config.format as never)) return false;
  if (typeof config.startAt !== 'number' || typeof config.durationMs !== 'number') {
    return false;
  }
  if (typeof config.allowPause !== 'boolean') return false;
  if (typeof config.icpcPenaltyCompileError !== 'boolean') return false;
  if (!isStringArrayLike(config.problems)) return false;

  for (const problem of config.problems) {
    if (!isRecord(problem)) return false;
    if (
      typeof problem.pid !== 'string' ||
      typeof problem.letter !== 'string' ||
      typeof problem.title !== 'string' ||
      typeof problem.fullScore !== 'number'
    ) {
      return false;
    }
  }

  if (runtime.finishedAt !== null && typeof runtime.finishedAt !== 'number') {
    return false;
  }
  if (!isStringArrayLike(runtime.pauses)) return false;
  for (const pause of runtime.pauses) {
    if (!isRecord(pause) || typeof pause.start !== 'number') return false;
    if (pause.end !== null && typeof pause.end !== 'number') return false;
  }

  if (!isStringArrayLike(value.submissions)) return false;
  for (const submission of value.submissions) {
    if (!isRecord(submission) || typeof submission.clientId !== 'string') {
      return false;
    }
    if (typeof submission.pid !== 'string') return false;
  }

  return true;
}

export function loadContest(): ContestLoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(CONTEST_KEY);
  } catch {
    return { state: null, error: '无法访问浏览器本地存储。' };
  }
  if (raw === null) return { state: null, error: null };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isContestState(parsed)) {
      return { state: null, error: '本地比赛数据格式不正确。' };
    }
    return { state: parsed, error: null };
  } catch {
    return { state: null, error: '无法读取本地比赛数据。' };
  }
}

export function saveContest(state: ContestState): void {
  localStorage.setItem(CONTEST_KEY, JSON.stringify(state));
}

export function clearContest(): void {
  localStorage.removeItem(CONTEST_KEY);
}

export function draftKey(contestId: string, pid: string): string {
  return `${DRAFT_PREFIX}${contestId}.${pid}`;
}

export function readDraft(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function writeDraft(key: string, value: string): void {
  try {
    if (value === '') {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    // 忽略写入失败（例如存储空间不足）。
  }
}

export function removeDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // 忽略删除失败。
  }
}

export function clearDrafts(): void {
  try {
    const keys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key !== null && key.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    for (const key of keys) localStorage.removeItem(key);
  } catch {
    // 忽略清理失败。
  }
}
