import { describe, expect, it } from 'vitest';
import {
  activeElapsedMs,
  createRuntime,
  finishContest,
  pauseContest,
  pausedMsAt,
  phaseAt,
  remainingMs,
  resumeContest,
} from './time';
import { RAKUTA_FACTOR_FLOOR, computeContestScore } from './scoring';
import type { ContestConfig, ContestProblem, Submission } from './types';

const BASE_START = 1_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function makeConfig(overrides: Partial<ContestConfig> = {}): ContestConfig {
  const problems: ContestProblem[] = [
    { pid: 'A', letter: 'A', title: 'A', fullScore: 100 },
  ];
  return {
    id: 'test',
    name: 'Test',
    source: { kind: 'custom' },
    format: 'icpc',
    icpcPenaltyCompileError: true,
    startAt: BASE_START,
    durationMs: 5 * HOUR,
    allowPause: true,
    problems,
    createdAt: BASE_START,
    ...overrides,
  };
}

function makeSubmission(
  pid: string,
  minutes: number,
  score: number,
  statusKey: string,
  config: ContestConfig,
): Submission {
  const at = config.startAt + minutes * MINUTE;
  return {
    clientId: `${pid}-${minutes}-${statusKey}`,
    rid: minutes,
    pid,
    languageId: 28,
    languageName: 'C++14 (GCC 9)',
    enableO2: true,
    createdAt: at,
    state: 'done',
    error: null,
    judge: {
      statusId: statusKey === 'AC' ? 12 : 6,
      statusKey,
      statusName: statusKey,
      statusShortName: statusKey,
      score,
      timeMs: 10,
      memoryKb: 1024,
      submittedAtMs: at,
      compileMessage: null,
      subtasks: [],
      testCases: [],
      pending: false,
    },
  };
}

describe('time engine', () => {
  it('computes scheduled, running and finished phases', () => {
    const config = makeConfig();
    const runtime = createRuntime();
    expect(phaseAt(config, runtime, BASE_START - 1)).toBe('scheduled');
    expect(remainingMs(config, runtime, BASE_START - 1)).toBe(5 * HOUR);
    expect(phaseAt(config, runtime, BASE_START + MINUTE)).toBe('running');
    expect(remainingMs(config, runtime, BASE_START + MINUTE)).toBe(5 * HOUR - MINUTE);
    expect(phaseAt(config, runtime, BASE_START + 5 * HOUR)).toBe('finished');
  });

  it('freezes remaining time while paused and extends the deadline', () => {
    const config = makeConfig();
    const paused = pauseContest(createRuntime(), BASE_START + 10 * MINUTE);
    expect(phaseAt(config, paused, BASE_START + 20 * MINUTE)).toBe('paused');
    expect(remainingMs(config, paused, BASE_START + 20 * MINUTE)).toBe(5 * HOUR - 10 * MINUTE);
    expect(pausedMsAt(paused, BASE_START + 20 * MINUTE)).toBe(10 * MINUTE);

    const resumed = resumeContest(paused, BASE_START + 40 * MINUTE);
    expect(pausedMsAt(resumed, BASE_START + 50 * MINUTE)).toBe(30 * MINUTE);
    expect(remainingMs(config, resumed, BASE_START + 50 * MINUTE)).toBe(5 * HOUR - 20 * MINUTE);
    expect(phaseAt(config, resumed, BASE_START + 5 * HOUR + 10 * MINUTE)).toBe('running');
    expect(phaseAt(config, resumed, BASE_START + 5 * HOUR + 30 * MINUTE)).toBe('finished');
  });

  it('excludes paused time from active elapsed time', () => {
    const config = makeConfig();
    const paused = pauseContest(createRuntime(), BASE_START + 10 * MINUTE);
    const resumed = resumeContest(paused, BASE_START + 30 * MINUTE);
    expect(activeElapsedMs(config, resumed, BASE_START + 30 * MINUTE)).toBe(10 * MINUTE);
    expect(activeElapsedMs(config, resumed, BASE_START + 40 * MINUTE)).toBe(20 * MINUTE);
  });

  it('finishes early and closes the open pause', () => {
    const config = makeConfig();
    const paused = pauseContest(createRuntime(), BASE_START + 10 * MINUTE);
    const finished = finishContest(paused, BASE_START + 20 * MINUTE);
    expect(finished.finishedAt).toBe(BASE_START + 20 * MINUTE);
    expect(finished.pauses.at(-1)?.end).toBe(BASE_START + 20 * MINUTE);
    expect(phaseAt(config, finished, BASE_START + 20 * MINUTE)).toBe('finished');
    expect(remainingMs(config, finished, BASE_START + 20 * MINUTE)).toBe(0);
  });
});

describe('scoring', () => {
  it('scores ICPC with CE penalized', () => {
    const config = makeConfig();
    const submissions = [
      makeSubmission('A', 10, 0, 'WA', config),
      makeSubmission('A', 20, 0, 'CE', config),
      makeSubmission('A', 30, 100, 'AC', config),
    ];
    const score = computeContestScore(config, createRuntime(), submissions);
    const problem = score.problems[0]!;
    expect(problem.solved).toBe(true);
    expect(problem.acAtMs).toBe(30 * MINUTE);
    expect(problem.penaltyMs).toBe(30 * MINUTE + 2 * 20 * MINUTE);
    expect(score.solvedCount).toBe(1);
    expect(score.penaltyMs).toBe(70 * MINUTE);
  });

  it('scores ICPC without CE penalization', () => {
    const config = makeConfig({ icpcPenaltyCompileError: false });
    const submissions = [
      makeSubmission('A', 10, 0, 'WA', config),
      makeSubmission('A', 20, 0, 'CE', config),
      makeSubmission('A', 30, 100, 'AC', config),
    ];
    const score = computeContestScore(config, createRuntime(), submissions);
    expect(score.problems[0]!.penaltyMs).toBe(30 * MINUTE + 20 * MINUTE);
  });

  it('ignores attempts after the first accepted submission', () => {
    const config = makeConfig();
    const submissions = [
      makeSubmission('A', 10, 100, 'AC', config),
      makeSubmission('A', 20, 0, 'WA', config),
    ];
    const score = computeContestScore(config, createRuntime(), submissions);
    expect(score.problems[0]!.penaltyMs).toBe(10 * MINUTE);
    expect(score.problems[0]!.failedAttempts).toBe(0);
  });

  it('uses the best score for IOI', () => {
    const config = makeConfig({ format: 'ioi' });
    const submissions = [
      makeSubmission('A', 10, 40, 'WA', config),
      makeSubmission('A', 20, 80, 'WA', config),
      makeSubmission('A', 30, 60, 'WA', config),
    ];
    const score = computeContestScore(config, createRuntime(), submissions);
    expect(score.problems[0]!.score).toBe(80);
    expect(score.problems[0]!.submissions.find((item) => item.counted)?.attemptNumber).toBe(2);
  });

  it('uses the last score for OI', () => {
    const config = makeConfig({ format: 'oi' });
    const submissions = [
      makeSubmission('A', 10, 40, 'WA', config),
      makeSubmission('A', 20, 80, 'WA', config),
      makeSubmission('A', 30, 60, 'WA', config),
    ];
    const score = computeContestScore(config, createRuntime(), submissions);
    expect(score.problems[0]!.score).toBe(60);
    expect(score.problems[0]!.submissions.find((item) => item.counted)?.attemptNumber).toBe(3);
  });

  it('applies the Rakuta submission discount and keeps the best result', () => {
    const config = makeConfig({ format: 'rakuta' });
    const submissions = [
      makeSubmission('A', 10, 60, 'WA', config),
      makeSubmission('A', 20, 100, 'AC', config),
      makeSubmission('A', 30, 100, 'AC', config),
    ];
    const score = computeContestScore(config, createRuntime(), submissions);
    const problem = score.problems[0]!;
    expect(problem.submissions.map((item) => item.score)).toEqual([
      60,
      Math.floor(100 * 0.95),
      Math.floor(100 * 0.95 ** 2),
    ]);
    expect(problem.score).toBe(95);
    expect(problem.submissions.find((item) => item.counted)?.attemptNumber).toBe(2);
    expect(RAKUTA_FACTOR_FLOOR).toBe(0.7);
  });

  it('never applies a Rakuta factor below the floor', () => {
    const config = makeConfig({ format: 'rakuta' });
    const submissions = Array.from({ length: 12 }, (_, index) =>
      makeSubmission('A', index + 1, 100, 'AC', config),
    );
    const score = computeContestScore(config, createRuntime(), submissions);
    const last = score.problems[0]!.submissions.at(-1)!;
    expect(last.score).toBe(70);
  });
});
