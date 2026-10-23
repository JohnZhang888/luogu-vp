import type {
  ContestFormat,
  ContestProblem,
  JudgeResult,
  SubmissionState,
} from './types';

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface AuthUser {
  uid: number;
  name: string;
}

export interface AuthStatus {
  loggedIn: boolean;
  user: AuthUser | null;
  error: string | null;
}

export type LoginState = 'idle' | 'waiting' | 'success' | 'error' | 'cancelled';

export interface LoginStatus {
  state: LoginState;
  user: AuthUser | null;
  error: string | null;
}

export interface ContestDetail {
  id: number;
  name: string;
  format: ContestFormat;
  originalFormat: string;
  originalFormatName: string;
  startAt: number;
  endAt: number;
  durationMs: number;
  problems: ContestProblem[];
}

export interface StatementContent {
  background: string;
  description: string;
  formatI: string;
  formatO: string;
  hint: string;
}

export interface Sample {
  input: string;
  output: string;
}

export interface LanguageOption {
  id: number;
  name: string;
  canO2: boolean;
  order: number;
  family: string | null;
}

export interface ProblemDetail {
  pid: string;
  title: string;
  fullScore: number;
  timeLimitMs: number;
  memoryLimitKb: number;
  content: StatementContent;
  samples: Sample[];
  languages: LanguageOption[];
  lastLanguageId: number | null;
}

export interface ResolveProblemOk {
  ok: true;
  pid: string;
  title: string;
  fullScore: number;
}

export interface ResolveProblemError {
  ok: false;
  pid: string;
  error: string;
}

export type ResolveProblemResult = ResolveProblemOk | ResolveProblemError;

export interface ResolveProblemsResponse {
  results: ResolveProblemResult[];
}

export interface StartSubmissionRequest {
  clientId: string;
  pid: string;
  code: string;
  languageId: number;
  enableO2: boolean;
  format: ContestFormat;
}

export interface CaptchaChallenge {
  id: string;
  imageDataUrl: string;
}

export interface JobError {
  code: string;
  message: string;
}

export interface SubmissionJobView {
  clientId: string;
  state: SubmissionState;
  rid: number | null;
  captcha: CaptchaChallenge | null;
  judge: JudgeResult | null;
  error: JobError | null;
}

export interface BatchRecordsRequest {
  rids: number[];
  format: ContestFormat;
}

export interface BatchRecordItem {
  rid: number;
  judge: JudgeResult | null;
  error: JobError | null;
}

export interface BatchRecordsResponse {
  records: BatchRecordItem[];
}
