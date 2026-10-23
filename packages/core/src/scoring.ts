import type {
  ContestFormat,
  ContestProblem,
  JudgeResult,
  Submission,
} from './types';
import type { ContestConfig, ContestRuntime } from './types';
import { activeElapsedMs } from './time';

const ICPC_PENALTY_MS = 20 * 60 * 1000;
export const RAKUTA_FACTOR_FLOOR = 0.7;

export interface ScoredSubmission {
  submission: Submission;
  judge: JudgeResult;
  /** 洛谷原始得分。 */
  rawScore: number;
  /** 计入本题的得分（乐多赛制会打折）。 */
  score: number;
  /** 同题内按时间排序的提交序号，从 1 开始。 */
  attemptNumber: number;
  counted: boolean;
  accepted: boolean;
  activeElapsedMs: number;
  penaltyMs: number;
}

export interface ProblemScore {
  problem: ContestProblem;
  submissions: ScoredSubmission[];
  score: number;
  fullScore: number;
  solved: boolean;
  attempts: number;
  failedAttempts: number;
  acAtMs: number | null;
  penaltyMs: number;
}

export interface ContestScore {
  format: ContestFormat;
  problems: ProblemScore[];
  totalScore: number;
  maxScore: number;
  solvedCount: number;
  penaltyMs: number;
}

function submissionTime(submission: Submission): number {
  return submission.judge?.submittedAtMs ?? submission.createdAt;
}

function isUsable(submission: Submission): submission is Submission & {
  judge: JudgeResult;
} {
  return submission.judge !== null && !submission.judge.pending;
}

function emptyProblemScore(problem: ContestProblem): ProblemScore {
  return {
    problem,
    submissions: [],
    score: 0,
    fullScore: problem.fullScore,
    solved: false,
    attempts: 0,
    failedAttempts: 0,
    acAtMs: null,
    penaltyMs: 0,
  };
}

function buildScored(
  submission: Submission & { judge: JudgeResult },
  attemptNumber: number,
  runtime: ContestRuntime,
  config: ContestConfig,
): ScoredSubmission {
  const time = submissionTime(submission);
  return {
    submission,
    judge: submission.judge,
    rawScore: submission.judge.score,
    score: submission.judge.score,
    attemptNumber,
    counted: false,
    accepted: submission.judge.statusKey === 'AC',
    activeElapsedMs: activeElapsedMs(config, runtime, time),
    penaltyMs: 0,
  };
}

function scoreIcpc(
  problem: ContestProblem,
  submissions: Submission[],
  config: ContestConfig,
  runtime: ContestRuntime,
): ProblemScore {
  const scored = submissions.map((submission, index) =>
    buildScored(submission as Submission & { judge: JudgeResult }, index + 1, runtime, config),
  );

  let firstAcIndex = -1;
  for (let index = 0; index < scored.length; index += 1) {
    if (scored[index].accepted) {
      firstAcIndex = index;
      break;
    }
  }

  let penalizedFailures = 0;
  if (firstAcIndex >= 0) {
    for (let index = 0; index < firstAcIndex; index += 1) {
      const key = scored[index].judge.statusKey;
      if (!config.icpcPenaltyCompileError && key === 'CE') continue;
      penalizedFailures += 1;
      scored[index].penaltyMs = ICPC_PENALTY_MS;
    }
    scored[firstAcIndex].counted = true;
    scored[firstAcIndex].penaltyMs = scored[firstAcIndex].activeElapsedMs;
  }

  const solved = firstAcIndex >= 0;
  const acAtMs = solved ? scored[firstAcIndex].activeElapsedMs : null;
  const penaltyMs = solved
    ? (acAtMs ?? 0) + penalizedFailures * ICPC_PENALTY_MS
    : 0;

  return {
    problem,
    submissions: scored,
    score: solved ? problem.fullScore : 0,
    fullScore: problem.fullScore,
    solved,
    attempts: scored.length,
    failedAttempts: solved ? firstAcIndex : scored.length,
    acAtMs,
    penaltyMs,
  };
}

function scoreIoi(
  problem: ContestProblem,
  submissions: Submission[],
  config: ContestConfig,
  runtime: ContestRuntime,
): ProblemScore {
  const scored = submissions.map((submission, index) =>
    buildScored(submission as Submission & { judge: JudgeResult }, index + 1, runtime, config),
  );

  let best: ScoredSubmission | null = null;
  for (const item of scored) {
    if (best === null || item.rawScore > best.rawScore) best = item;
  }
  if (best !== null) best.counted = true;

  const score = best?.rawScore ?? 0;
  return {
    problem,
    submissions: scored,
    score,
    fullScore: problem.fullScore,
    solved: score >= problem.fullScore,
    attempts: scored.length,
    failedAttempts: scored.filter((item) => !item.accepted).length,
    acAtMs: null,
    penaltyMs: 0,
  };
}

function scoreOi(
  problem: ContestProblem,
  submissions: Submission[],
  config: ContestConfig,
  runtime: ContestRuntime,
): ProblemScore {
  const scored = submissions.map((submission, index) =>
    buildScored(submission as Submission & { judge: JudgeResult }, index + 1, runtime, config),
  );

  const last = scored[scored.length - 1] ?? null;
  if (last !== null) last.counted = true;
  const score = last?.rawScore ?? 0;

  return {
    problem,
    submissions: scored,
    score,
    fullScore: problem.fullScore,
    solved: score >= problem.fullScore,
    attempts: scored.length,
    failedAttempts: scored.filter((item) => !item.accepted).length,
    acAtMs: null,
    penaltyMs: 0,
  };
}

function scoreRakuta(
  problem: ContestProblem,
  submissions: Submission[],
  config: ContestConfig,
  runtime: ContestRuntime,
): ProblemScore {
  const scored = submissions.map((submission, index) => {
    const item = buildScored(
      submission as Submission & { judge: JudgeResult },
      index + 1,
      runtime,
      config,
    );
    const factor = Math.max(RAKUTA_FACTOR_FLOOR, 0.95 ** index);
    item.score = Math.floor(item.rawScore * factor + 1e-9);
    return item;
  });

  let best: ScoredSubmission | null = null;
  for (const item of scored) {
    if (best === null || item.score > best.score) best = item;
  }
  if (best !== null) best.counted = true;

  const score = best?.score ?? 0;
  return {
    problem,
    submissions: scored,
    score,
    fullScore: problem.fullScore,
    solved: score >= problem.fullScore,
    attempts: scored.length,
    failedAttempts: scored.filter((item) => !item.accepted).length,
    acAtMs: null,
    penaltyMs: 0,
  };
}

/**
 * 计算整场比赛的成绩。
 * 传入的提交应当只包含已经结束评测的提交；仍在等待/评测中的提交由调用方负责等待。
 */
export function computeContestScore(
  config: ContestConfig,
  runtime: ContestRuntime,
  submissions: Submission[],
): ContestScore {
  const byProblem = new Map<string, Submission[]>();
  for (const problem of config.problems) byProblem.set(problem.pid, []);

  for (const submission of submissions) {
    if (!isUsable(submission)) continue;
    const list = byProblem.get(submission.pid);
    if (list === undefined) continue;
    list.push(submission);
  }

  const problems: ProblemScore[] = config.problems.map((problem) => {
    const list = (byProblem.get(problem.pid) ?? []).sort(
      (left, right) => submissionTime(left) - submissionTime(right),
    );
    if (list.length === 0) return emptyProblemScore(problem);

    switch (config.format) {
      case 'icpc':
        return scoreIcpc(problem, list, config, runtime);
      case 'ioi':
        return scoreIoi(problem, list, config, runtime);
      case 'oi':
        return scoreOi(problem, list, config, runtime);
      case 'rakuta':
        return scoreRakuta(problem, list, config, runtime);
      default:
        return emptyProblemScore(problem);
    }
  });

  const totalScore = problems.reduce((sum, problem) => sum + problem.score, 0);
  const maxScore = problems.reduce((sum, problem) => sum + problem.fullScore, 0);
  const solvedCount = problems.filter((problem) => problem.solved).length;
  const penaltyMs = problems.reduce((sum, problem) => sum + problem.penaltyMs, 0);

  return {
    format: config.format,
    problems,
    totalScore,
    maxScore,
    solvedCount,
    penaltyMs,
  };
}
