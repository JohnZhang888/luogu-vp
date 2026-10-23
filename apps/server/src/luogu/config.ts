import { AppError } from '../errors';
import { readCache, readStaleCache, writeCache } from '../cache/disk';
import { asArray, asNumber, asRecord, asString, isRecord } from '../util/guards';
import { luoguJson } from './http';
import { statusKeyFromType, type StatusInfo } from '@vp/core';
import type { ContestFormat } from '@vp/core';

export interface RawCodeLanguage {
  type: string;
  id: number;
  name: string;
  order: number;
  family: string | null;
  disabled: boolean;
  canO2: boolean;
  hljs: string;
}

export interface RawRecordStatus {
  type: string;
  id: number;
  name: string;
  shortName: string;
  color: string;
}

export interface RawContestMethod {
  type: string;
  id: number;
  name: string;
  color: string;
}

export interface LuoguConfig {
  CodeLanguage: Record<string, RawCodeLanguage>;
  RecordStatus: Record<string, RawRecordStatus>;
  ContestMethod: Record<string, RawContestMethod>;
}

const CONFIG_TTL_MS = 60 * 60 * 1000;
let memoryConfig: { data: LuoguConfig; at: number } | null = null;

function normalizeLanguage(value: unknown): RawCodeLanguage | null {
  const raw = asRecord(value);
  const id = asNumber(raw.id, 0);
  const name = asString(raw.name);
  if (id <= 0 || name === '') return null;
  return {
    type: asString(raw.type, 'Unknown'),
    id,
    name,
    order: asNumber(raw.order, 999),
    family: typeof raw.family === 'string' ? raw.family : null,
    disabled: raw.disabled === true,
    canO2: raw.canO2 === true,
    hljs: asString(raw.hljs, 'text'),
  };
}

function normalizeConfig(raw: Record<string, unknown>): LuoguConfig {
  const languagesRaw = asRecord(raw.CodeLanguage);
  const statusesRaw = asRecord(raw.RecordStatus);
  const methodsRaw = asRecord(raw.ContestMethod);

  const CodeLanguage: Record<string, RawCodeLanguage> = {};
  for (const [key, value] of Object.entries(languagesRaw)) {
    const language = normalizeLanguage(value);
    if (language !== null) CodeLanguage[key] = language;
  }

  const RecordStatus: Record<string, RawRecordStatus> = {};
  for (const [key, value] of Object.entries(statusesRaw)) {
    const status = asRecord(value);
    RecordStatus[key] = {
      type: asString(status.type, 'Invalid'),
      id: asNumber(status.id, Number(key)),
      name: asString(status.name, key),
      shortName: asString(status.shortName, key),
      color: asString(status.color, 'grey-5'),
    };
  }

  const ContestMethod: Record<string, RawContestMethod> = {};
  for (const [key, value] of Object.entries(methodsRaw)) {
    const method = asRecord(value);
    ContestMethod[key] = {
      type: asString(method.type, 'Unknown'),
      id: asNumber(method.id, Number(key)),
      name: asString(method.name, key),
      color: asString(method.color, 'grey-5'),
    };
  }

  if (Object.keys(CodeLanguage).length === 0) {
    throw new AppError('LUOGU_CONFIG_UNAVAILABLE', '读取洛谷语言配置失败。', 502);
  }

  return { CodeLanguage, RecordStatus, ContestMethod };
}

export async function getLuoguConfig(force = false): Promise<LuoguConfig> {
  if (!force && memoryConfig !== null && Date.now() - memoryConfig.at < CONFIG_TTL_MS) {
    return memoryConfig.data;
  }

  const cached = await readCache<LuoguConfig>('luogu-config', CONFIG_TTL_MS);
  if (!force && cached !== null) {
    memoryConfig = { data: cached, at: Date.now() };
    return cached;
  }

  try {
    const raw = await luoguJson<Record<string, unknown>>('/_lfe/config', {
      retries: 1,
    });
    const config = normalizeConfig(raw);
    memoryConfig = { data: config, at: Date.now() };
    await writeCache('luogu-config', config);
    return config;
  } catch (error) {
    const stale = await readStaleCache<LuoguConfig>('luogu-config');
    if (stale !== null) {
      memoryConfig = { data: stale, at: Date.now() };
      return stale;
    }
    throw error;
  }
}

export function getLanguage(
  config: LuoguConfig,
  id: number,
): RawCodeLanguage | null {
  return config.CodeLanguage[String(id)] ?? null;
}

export function getStatusInfo(
  config: LuoguConfig,
  id: number,
): { status: RawRecordStatus; key: string } {
  const status = config.RecordStatus[String(id)] ?? {
    type: 'Invalid',
    id,
    name: `Status ${id}`,
    shortName: `S${id}`,
    color: 'grey-5',
  };
  return { status, key: statusKeyFromType(status.type) };
}

export function getStatusInfoForType(
  config: LuoguConfig,
  type: string,
): StatusInfo {
  for (const status of Object.values(config.RecordStatus)) {
    if (status.type === type) {
      return {
        key: statusKeyFromType(status.type),
        name: status.name,
        shortName: status.shortName,
      };
    }
  }
  return { key: 'UKE', name: type, shortName: 'UKE' };
}

export function mapMethodToFormat(
  method: RawContestMethod | undefined | null,
): ContestFormat | null {
  if (!method) return null;
  switch (method.type) {
    case 'Oi':
      return 'oi';
    case 'Icpc':
      return 'icpc';
    case 'Ioi':
      return 'ioi';
    case 'Rakuta':
      return 'rakuta';
    default:
      return null;
  }
}

export function normalizeSamples(value: unknown): Array<{ input: string; output: string }> {
  const samples: Array<{ input: string; output: string }> = [];
  for (const item of asArray(value)) {
    if (Array.isArray(item) && item.length >= 2) {
      samples.push({ input: asString(item[0]), output: asString(item[1]) });
      continue;
    }
    const record = asRecord(item);
    if (record.input !== undefined || record.output !== undefined) {
      samples.push({
        input: asString(record.input),
        output: asString(record.output),
      });
    }
  }
  return samples;
}

export function normalizeLimits(value: unknown): {
  timeLimitMs: number;
  memoryLimitKb: number;
} {
  const limits = asRecord(value);
  const time = limits.time;
  const memory = limits.memory;
  const timeLimitMs = Array.isArray(time)
    ? asNumber(time[0], 1000)
    : asNumber(time, 1000);
  const memoryLimitKb = Array.isArray(memory)
    ? asNumber(memory[0], 262144)
    : asNumber(memory, 262144);
  return {
    timeLimitMs: timeLimitMs > 0 ? timeLimitMs : 1000,
    memoryLimitKb: memoryLimitKb > 0 ? memoryLimitKb : 262144,
  };
}

export function isRecordLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}
