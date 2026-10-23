import type {
  BatchRecordItem,
  JudgeResult,
  JudgeSubtask,
  JudgeTestCase,
} from '@vp/core';
import { AuthRequiredError, AppError } from '../errors';
import { asArray, asNumber, asNumberOrNull, asRecord, asString, pickString } from '../util/guards';
import { getLuoguConfig, getStatusInfo, type LuoguConfig } from './config';
import { luoguJson } from './http';
import type { SessionStore } from '../session/store';

const RECORD_CACHE_MS = 2000;

function statusFromValue(
  config: LuoguConfig,
  value: unknown,
): { id: number; key: string; name: string; shortName: string } {
  let id = 0;
  if (typeof value === 'number') id = value;
  else if (isRecordValue(value)) id = asNumber(value.id, 0);
  const info = getStatusInfo(config, id);
  return {
    id,
    key: info.key,
    name: info.status.name,
    shortName: info.status.shortName,
  };
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTestCase(
  config: LuoguConfig,
  value: unknown,
  index: number,
): JudgeTestCase {
  const raw = asRecord(value);
  const status = statusFromValue(config, raw.status);
  const rawId = raw.id;
  const id =
    typeof rawId === 'number'
      ? String(rawId + 1)
      : asString(rawId, String(index + 1));
  return {
    id,
    statusKey: status.key,
    statusName: status.name,
    score: asNumber(raw.score, 0),
    timeMs: asNumberOrNull(raw.time),
    memoryKb: asNumberOrNull(raw.memory),
  };
}

function normalizeSubtask(
  config: LuoguConfig,
  value: unknown,
  index: number,
): JudgeSubtask {
  const raw = asRecord(value);
  const status = statusFromValue(config, raw.status);
  const cases = asArray(
    raw.testCases ?? raw.testcases ?? raw.cases ?? raw.tests,
  );
  return {
    id: asString(raw.id, String(index + 1)),
    score: asNumber(raw.score, 0),
    statusKey: status.key,
    statusName: status.name,
    testCases: cases.map((item, caseIndex) =>
      normalizeTestCase(config, item, caseIndex),
    ),
  };
}

function normalizeDetails(
  config: LuoguConfig,
  rawDetails: unknown,
): { subtasks: JudgeSubtask[]; testCases: JudgeTestCase[] } {
  if (Array.isArray(rawDetails)) {
    return {
      subtasks: [],
      testCases: rawDetails.map((item, index) =>
        normalizeTestCase(config, item, index),
      ),
    };
  }
  const details = asRecord(rawDetails);
  const judgeResult = asRecord(details.judgeResult);
  const subtasks = asArray(
    judgeResult.subtasks ?? details.subtasks ?? details.subTasks ?? details.groups,
  ).map((item, index) => normalizeSubtask(config, item, index));
  const testCases = asArray(
    judgeResult.testCases ?? details.testCases ?? details.testcases ?? details.tests,
  ).map((item, index) => normalizeTestCase(config, item, index));
  return { subtasks, testCases };
}

export function normalizeRecord(
  raw: Record<string, unknown>,
  config: LuoguConfig,
): JudgeResult {
  const status = statusFromValue(config, raw.status);
  const pending = status.id === 0 || status.id === 1;
  const details = normalizeDetails(
    config,
    raw.details ?? raw.detail ?? raw.judgeResult ?? raw.result,
  );

  const detail = asRecord(raw.detail);
  const compileResult = asRecord(detail.compileResult);
  const compileMessage =
    pickString(compileResult, ['message']) ??
    pickString(raw, ['compileError', 'compileMessage', 'compile_error']) ??
    pickString(detail, ['compileError', 'compileMessage']) ??
    null;

  const submitTime = asNumberOrNull(raw.submitTime);
  const submittedAtMs =
    submitTime === null
      ? null
      : submitTime > 1_000_000_000_000
        ? submitTime
        : submitTime * 1000;

  return {
    statusId: status.id,
    statusKey: status.key,
    statusName: status.name,
    statusShortName: status.shortName,
    score: asNumber(raw.score, 0),
    timeMs: asNumberOrNull(raw.time),
    memoryKb: asNumberOrNull(raw.memory),
    submittedAtMs,
    compileMessage,
    subtasks: details.subtasks,
    testCases: details.testCases,
    pending,
  };
}

export class RecordService {
  private readonly cache = new Map<number, { judge: JudgeResult; at: number }>();

  constructor(private readonly session: SessionStore) {}

  async fetchRecord(rid: number): Promise<JudgeResult> {
    const cached = this.cache.get(rid);
    if (cached !== undefined && Date.now() - cached.at < RECORD_CACHE_MS) {
      return cached.judge;
    }

    const cookies = await this.session.cookieHeader();
    if (cookies === null) throw new AuthRequiredError();

    const json = await luoguJson<Record<string, unknown>>(`/record/${rid}`, {
      cookies,
    });
    const data = asRecord(json.data);
    const raw = asRecord(data.record ?? data);
    if (Object.keys(raw).length === 0) {
      throw new AppError('RECORD_NOT_FOUND', '无法读取评测记录。', 404);
    }

    const config = await getLuoguConfig();
    const judge = normalizeRecord(raw, config);
    this.cache.set(rid, { judge, at: Date.now() });
    return judge;
  }

  async fetchMany(rids: number[]): Promise<BatchRecordItem[]> {
    const unique = [...new Set(rids)].filter((rid) => Number.isInteger(rid) && rid > 0);
    const results: BatchRecordItem[] = new Array(unique.length);
    let cursor = 0;

    const worker = async (): Promise<void> => {
      while (cursor < unique.length) {
        const index = cursor;
        cursor += 1;
        const rid = unique[index];
        try {
          const judge = await this.fetchRecord(rid);
          results[index] = { rid, judge, error: null };
        } catch (error) {
          results[index] = {
            rid,
            judge: null,
            error:
              error instanceof AppError
                ? { code: error.code, message: error.message }
                : { code: 'RECORD_FAILED', message: '读取评测记录失败。' },
          };
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(4, Math.max(1, unique.length)) },
      () => worker(),
    );
    await Promise.all(workers);
    return results;
  }
}
