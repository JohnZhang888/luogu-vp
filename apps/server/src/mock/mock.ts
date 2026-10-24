import type {
  JudgeResult,
  JudgeSubtask,
  ProblemDetail,
} from '@vp/core';
import {
  MOCK_PROBLEM_FULL_SCORE,
  MOCK_PROBLEM_PID,
  MOCK_PROBLEM_TITLE,
} from '@vp/core';

/**
 * 虚构测试比赛的本地数据源：题目、评测结果、记录 rid 都在这里生成，
 * 不发起任何洛谷请求，也不需要登录会话。
 */

/** mock rid 从 9e9 起编号；真实洛谷 rid 目前远小于该值。 */
const MOCK_RID_BASE = 9_000_000_000;

const MOCK_TIME_LIMIT_MS = 1000;
const MOCK_MEMORY_LIMIT_KB = 512 * 1024;

/** 模拟评测停留的时长，让前端能观察到「评测中」状态。 */
export const MOCK_JUDGE_DELAY_MS = 2500;

let ridCursor = 0;

export function isMockPid(pid: string): boolean {
  return pid === MOCK_PROBLEM_PID;
}

export function isMockRid(rid: number): boolean {
  return rid >= MOCK_RID_BASE;
}

export function nextMockRid(): number {
  ridCursor += 1;
  return MOCK_RID_BASE + ridCursor;
}

export function mockProblem(): ProblemDetail {
  return {
    pid: MOCK_PROBLEM_PID,
    title: MOCK_PROBLEM_TITLE,
    fullScore: MOCK_PROBLEM_FULL_SCORE,
    timeLimitMs: MOCK_TIME_LIMIT_MS,
    memoryLimitKb: MOCK_MEMORY_LIMIT_KB,
    content: {
      background: '这是一道不存在的虚构题目，仅用于测试提交流程与结果展示。',
      description:
        '给定两个整数 $a, b$，输出 $a + b$。\n\n' +
        '本题不会真正评测：无论提交什么代码，都会返回一份覆盖 AC / WA / TLE / MLE / RE / OLE / UKE 七种状态的虚构评测结果。',
      formatI: '一行两个整数 $a, b$。',
      formatO: '一行一个整数，表示 $a + b$。',
      hint: '虚构测试题，评测结果由本地生成，不会访问洛谷。',
    },
    samples: [{ input: '1 2', output: '3' }],
    languages: [
      { id: 28, name: 'C++14 (GCC 9)', canO2: true, order: 1, family: 'c' },
    ],
    lastLanguageId: 28,
  };
}

interface MockCaseSpec {
  statusId: number;
  statusKey: string;
  statusName: string;
  statusShortName: string;
  /** 该子任务得分；只有 AC 的子任务得分。 */
  score: number;
  timeMs: number | null;
  memoryKb: number | null;
}

/** 七个测试点各覆盖一种状态，按 AC 在前、失败按 WA/TLE/MLE/RE/OLE/UKE 排列。 */
const CASE_SPECS: MockCaseSpec[] = [
  { statusId: 12, statusKey: 'AC', statusName: 'Accepted', statusShortName: 'AC', score: 10, timeMs: 8, memoryKb: 660 },
  { statusId: 6, statusKey: 'WA', statusName: 'Wrong Answer', statusShortName: 'WA', score: 0, timeMs: 12, memoryKb: 664 },
  { statusId: 5, statusKey: 'TLE', statusName: 'Time Limit Exceeded', statusShortName: 'TLE', score: 0, timeMs: MOCK_TIME_LIMIT_MS, memoryKb: 660 },
  { statusId: 4, statusKey: 'MLE', statusName: 'Memory Limit Exceeded', statusShortName: 'MLE', score: 0, timeMs: 87, memoryKb: MOCK_MEMORY_LIMIT_KB },
  { statusId: 7, statusKey: 'RE', statusName: 'Runtime Error', statusShortName: 'RE', score: 0, timeMs: 132, memoryKb: 664 },
  { statusId: 3, statusKey: 'OLE', statusName: 'Output Limit Exceeded', statusShortName: 'OLE', score: 0, timeMs: 96, memoryKb: 660 },
  { statusId: 11, statusKey: 'UKE', statusName: 'Unknown Error', statusShortName: 'UKE', score: 0, timeMs: null, memoryKb: null },
];

export function mockJudge(): JudgeResult {
  const subtasks: JudgeSubtask[] = CASE_SPECS.map((spec, index) => ({
    id: String(index + 1),
    score: spec.score,
    statusKey: spec.statusKey,
    statusName: spec.statusName,
    testCases: [
      {
        id: String(index + 1),
        statusKey: spec.statusKey,
        statusName: spec.statusName,
        score: spec.score,
        timeMs: spec.timeMs,
        memoryKb: spec.memoryKb,
      },
    ],
  }));

  const times = CASE_SPECS.map((spec) => spec.timeMs).filter(
    (value): value is number => value !== null,
  );
  const memories = CASE_SPECS.map((spec) => spec.memoryKb).filter(
    (value): value is number => value !== null,
  );
  const firstFailed = CASE_SPECS.find((spec) => spec.statusKey !== 'AC');

  return {
    statusId: firstFailed?.statusId ?? 12,
    statusKey: firstFailed?.statusKey ?? 'AC',
    statusName: firstFailed?.statusName ?? 'Accepted',
    statusShortName: firstFailed?.statusShortName ?? 'AC',
    score: CASE_SPECS.reduce((sum, spec) => sum + spec.score, 0),
    timeMs: times.length > 0 ? Math.max(...times) : null,
    memoryKb: memories.length > 0 ? Math.max(...memories) : null,
    submittedAtMs: null,
    compileMessage: null,
    subtasks,
    testCases: [],
    pending: false,
  };
}
