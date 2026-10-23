export const CONTEST_FORMATS = ['icpc', 'ioi', 'oi', 'rakuta'] as const;

export type ContestFormat = (typeof CONTEST_FORMATS)[number];

export const CONTEST_FORMAT_LABELS: Record<ContestFormat, string> = {
  icpc: 'ICPC',
  ioi: 'IOI',
  oi: 'OI',
  rakuta: '乐多',
};

export type ContestPhase = 'scheduled' | 'running' | 'paused' | 'finished';

export type ContestSource =
  | { kind: 'luogu'; contestId: number }
  | { kind: 'custom' };

export interface ContestProblem {
  pid: string;
  letter: string;
  title: string;
  fullScore: number;
}

export interface ContestConfig {
  id: string;
  name: string;
  source: ContestSource;
  format: ContestFormat;
  /** ICPC 专用：编译错误是否计入罚时。 */
  icpcPenaltyCompileError: boolean;
  startAt: number;
  durationMs: number;
  allowPause: boolean;
  problems: ContestProblem[];
  createdAt: number;
}

export interface PauseInterval {
  start: number;
  end: number | null;
}

export interface ContestRuntime {
  finishedAt: number | null;
  pauses: PauseInterval[];
}

export type SubmissionState =
  | 'submitting'
  | 'queued'
  | 'preparing'
  | 'awaiting-captcha'
  | 'submitted'
  | 'judging'
  | 'done'
  | 'failed';

export interface JudgeTestCase {
  id: string;
  statusKey: string;
  statusName: string;
  score: number;
  timeMs: number | null;
  memoryKb: number | null;
}

export interface JudgeSubtask {
  id: string;
  score: number;
  statusKey: string;
  statusName: string;
  testCases: JudgeTestCase[];
}

export interface JudgeResult {
  statusId: number;
  statusKey: string;
  statusName: string;
  statusShortName: string;
  score: number;
  timeMs: number | null;
  memoryKb: number | null;
  /** 洛谷服务器记录的提交时间，毫秒时间戳；拿不到时为 null。 */
  submittedAtMs: number | null;
  compileMessage: string | null;
  subtasks: JudgeSubtask[];
  testCases: JudgeTestCase[];
  pending: boolean;
}

export interface Submission {
  clientId: string;
  rid: number | null;
  pid: string;
  languageId: number;
  languageName: string;
  enableO2: boolean;
  createdAt: number;
  state: SubmissionState;
  error: string | null;
  judge: JudgeResult | null;
}

export interface ContestState {
  schemaVersion: 1;
  config: ContestConfig;
  runtime: ContestRuntime;
  submissions: Submission[];
  /** 比赛结束后是否已经批量拉取过记录。 */
  resultsFetchedAt: number | null;
}
