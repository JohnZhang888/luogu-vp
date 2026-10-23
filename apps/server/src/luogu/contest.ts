import type { ContestDetail, ContestProblem } from '@vp/core';
import { readCache, writeCache } from '../cache/disk';
import { AppError } from '../errors';
import { asArray, asNumber, asRecord, asString } from '../util/guards';
import {
  getLuoguConfig,
  mapMethodToFormat,
  type RawContestMethod,
} from './config';
import { luoguJson } from './http';

const CONTEST_TTL_MS = 5 * 60 * 1000;

function letterFor(index: number): string {
  if (index < 26) return String.fromCharCode(65 + index);
  return `#${index + 1}`;
}

export class ContestService {
  async get(id: number): Promise<ContestDetail> {
    const cached = await readCache<ContestDetail>(`contest-${id}`, CONTEST_TTL_MS);
    if (cached !== null) return cached;

    const config = await getLuoguConfig();
    const json = await luoguJson<Record<string, unknown>>(`/contest/${id}`);
    const data = asRecord(json.data);
    const rawContest = asRecord(data.contest);
    if (Object.keys(rawContest).length === 0) {
      throw new AppError('CONTEST_NOT_FOUND', '无法读取该比赛。', 404);
    }

    const endAt = asNumber(rawContest.endTime, 0) * 1000;
    const startAt = asNumber(rawContest.startTime, 0) * 1000;
    if (endAt > Date.now()) {
      throw new AppError(
        'CONTEST_NOT_ENDED',
        '该比赛尚未结束，暂时无法导入题目。',
        400,
      );
    }

    const methodId = asNumber(rawContest.method, 0);
    const method: RawContestMethod | undefined =
      config.ContestMethod[String(methodId)];
    const format = mapMethodToFormat(method);
    if (format === null) {
      throw new AppError(
        'CONTEST_UNSUPPORTED',
        `暂不支持该比赛的赛制（${method?.name ?? '未知'}）。`,
        400,
      );
    }

    const rawProblems = asArray(data.contestProblems);
    if (rawProblems.length === 0) {
      throw new AppError(
        'CONTEST_PROBLEMS_HIDDEN',
        '该比赛的题目列表不可见。',
        400,
      );
    }

    const problems: ContestProblem[] = rawProblems.map((item, index) => {
      const record = asRecord(item);
      const problem = asRecord(record.problem);
      const pid = asString(problem.pid, asString(record.pid));
      const letter = asString(record.no, letterFor(index)) || letterFor(index);
      return {
        pid,
        letter,
        title: asString(problem.name, pid),
        fullScore: asNumber(record.score, asNumber(problem.fullScore, 100)) || 100,
      };
    }).filter((problem) => problem.pid !== '');

    if (problems.length === 0) {
      throw new AppError(
        'CONTEST_PROBLEMS_HIDDEN',
        '该比赛没有可用的题目。',
        400,
      );
    }

    const detail: ContestDetail = {
      id,
      name: asString(rawContest.name, `比赛 ${id}`),
      format,
      originalFormat: method?.type ?? 'Unknown',
      originalFormatName: method?.name ?? '未知',
      startAt,
      endAt,
      durationMs: Math.max(0, endAt - startAt),
      problems,
    };

    await writeCache(`contest-${id}`, detail);
    return detail;
  }
}
