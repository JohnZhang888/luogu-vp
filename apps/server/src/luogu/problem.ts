import type {
  LanguageOption,
  ProblemDetail,
  ResolveProblemResult,
} from '@vp/core';
import { readCache, readStaleCache, writeCache } from '../cache/disk';
import { appConfig } from '../config';
import { AppError } from '../errors';
import { isMockPid, mockProblem } from '../mock/mock';
import {
  asArray,
  asNumber,
  asNumberOrNull,
  asRecord,
  asString,
} from '../util/guards';
import {
  getLanguage,
  getLuoguConfig,
  normalizeLimits,
  normalizeSamples,
  type LuoguConfig,
} from './config';
import { luoguJson } from './http';

const PROBLEM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function cacheKey(pid: string): string {
  return `problem-${pid}`;
}

function buildLanguages(
  config: LuoguConfig,
  value: unknown,
): LanguageOption[] {
  const seen = new Set<number>();
  const languages: LanguageOption[] = [];
  for (const rawId of asArray(value)) {
    const id = asNumber(rawId, 0);
    if (id <= 0 || id === 5 || seen.has(id)) continue;
    const language = getLanguage(config, id);
    if (language === null || language.disabled) continue;
    seen.add(id);
    languages.push({
      id: language.id,
      name: language.name,
      canO2: language.canO2,
      order: language.order,
      family: language.family,
    });
  }
  return languages.sort((left, right) => left.order - right.order);
}

function buildProblem(
  raw: Record<string, unknown>,
  data: Record<string, unknown>,
  config: LuoguConfig,
  pid: string,
): ProblemDetail {
  const translations = asRecord(data.translations);
  const rawContent = asRecord(raw.content);
  const fallbackContent =
    asRecord(translations['zh-CN'])?.['description'] !== undefined
      ? asRecord(translations['zh-CN'])
      : asRecord(translations['en']);
  const contentRecord =
    Object.keys(rawContent).length > 0 ? rawContent : fallbackContent;

  const limits = normalizeLimits(raw.limits);
  const languages = buildLanguages(config, raw.acceptLanguages);
  const lastLanguage = asNumberOrNull(raw.lastLanguage);
  const lastLanguageId =
    lastLanguage !== null && languages.some((item) => item.id === lastLanguage)
      ? lastLanguage
      : null;

  return {
    pid,
    title: asString(raw.name, pid),
    fullScore: asNumber(raw.fullScore, 100),
    timeLimitMs: limits.timeLimitMs,
    memoryLimitKb: limits.memoryLimitKb,
    content: {
      background: asString(contentRecord.background),
      description: asString(contentRecord.description),
      formatI: asString(contentRecord.formatI),
      formatO: asString(contentRecord.formatO),
      hint: asString(contentRecord.hint),
    },
    samples: normalizeSamples(raw.samples),
    languages,
    lastLanguageId,
  };
}

export class ProblemService {
  async get(pid: string): Promise<ProblemDetail> {
    if (isMockPid(pid)) {
      if (!appConfig.mockEnabled) {
        throw new AppError('PROBLEM_NOT_FOUND', '测试题目只在开发环境可用。', 404);
      }
      return mockProblem();
    }

    const cached = await readCache<ProblemDetail>(cacheKey(pid), PROBLEM_TTL_MS);
    if (cached !== null) return cached;

    try {
      const config = await getLuoguConfig();
      const json = await luoguJson<Record<string, unknown>>(
        `/problem/${encodeURIComponent(pid)}`,
      );
      const data = asRecord(json.data);
      const raw = asRecord(data.problem);
      if (Object.keys(raw).length === 0) {
        throw new AppError('PROBLEM_NOT_FOUND', '无法读取该题目。', 404);
      }
      const problem = buildProblem(raw, data, config, pid);
      await writeCache(cacheKey(pid), problem);
      return problem;
    } catch (error) {
      const stale = await readStaleCache<ProblemDetail>(cacheKey(pid));
      if (stale !== null) return stale;
      throw error;
    }
  }

  async resolveMany(pids: string[]): Promise<ResolveProblemResult[]> {
    const results: ResolveProblemResult[] = new Array(pids.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < pids.length) {
        const index = cursor;
        cursor += 1;
        const pid = pids[index];
        try {
          const problem = await this.get(pid);
          results[index] = {
            ok: true,
            pid,
            title: problem.title,
            fullScore: problem.fullScore,
          };
        } catch (error) {
          results[index] = {
            ok: false,
            pid,
            error:
              error instanceof AppError
                ? error.message
                : '读取题目失败，请检查题目 ID。',
          };
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(3, Math.max(1, pids.length)) },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }
}
