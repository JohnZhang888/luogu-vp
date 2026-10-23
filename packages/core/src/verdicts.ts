export interface StatusInfo {
  key: string;
  name: string;
  shortName: string;
}

/** 洛谷 RecordStatus 的 type 字段到内部状态键的映射。 */
const STATUS_KEY_BY_TYPE: Record<string, string> = {
  Unshown: 'UNSHOWN',
  Waiting: 'WAITING',
  Judging: 'JUDGING',
  CompileError: 'CE',
  OutputLimitExceeded: 'OLE',
  MemoryLimitExceeded: 'MLE',
  TimeLimitExceeded: 'TLE',
  WrongAnswer: 'WA',
  RuntimeError: 'RE',
  Invalid: 'UKE',
  Accepted: 'AC',
  OverallUnaccepted: 'NAC',
  HackSuccess: 'HACK_SUCCESS',
  HackFailure: 'HACK_FAILURE',
  HackSkipped: 'HACK_SKIPPED',
};

export const FALLBACK_STATUSES: Record<number, StatusInfo> = {
  [-1]: { key: 'UNSHOWN', name: 'Unshown', shortName: 'N/A' },
  0: { key: 'WAITING', name: 'Waiting', shortName: 'Waiting' },
  1: { key: 'JUDGING', name: 'Judging', shortName: 'Judging' },
  2: { key: 'CE', name: 'Compile Error', shortName: 'CE' },
  3: { key: 'OLE', name: 'Output Limit Exceeded', shortName: 'OLE' },
  4: { key: 'MLE', name: 'Memory Limit Exceeded', shortName: 'MLE' },
  5: { key: 'TLE', name: 'Time Limit Exceeded', shortName: 'TLE' },
  6: { key: 'WA', name: 'Wrong Answer', shortName: 'WA' },
  7: { key: 'RE', name: 'Runtime Error', shortName: 'RE' },
  11: { key: 'UKE', name: 'Unknown Error', shortName: 'UKE' },
  12: { key: 'AC', name: 'Accepted', shortName: 'AC' },
  14: { key: 'NAC', name: 'Unaccepted', shortName: 'NAC' },
  21: { key: 'HACK_SUCCESS', name: 'Hack Success', shortName: 'Hack Success' },
  22: { key: 'HACK_FAILURE', name: 'Hack Failure', shortName: 'Hack Failure' },
  23: { key: 'HACK_SKIPPED', name: 'Hack Skipped', shortName: 'Hack Skipped' },
};

export function statusKeyFromType(type: string | undefined | null): string {
  if (!type) return 'UKE';
  return STATUS_KEY_BY_TYPE[type] ?? 'UKE';
}

export const VERDICT_LABELS: Record<string, string> = {
  UNSHOWN: '不展示',
  WAITING: '等待评测',
  JUDGING: '评测中',
  CE: '编译错误',
  OLE: '输出超限',
  MLE: '超出内存限制',
  TLE: '超出时间限制',
  WA: '答案错误',
  RE: '运行错误',
  UKE: '未知错误',
  AC: '通过',
  NAC: '未通过',
  HACK_SUCCESS: 'Hack 成功',
  HACK_FAILURE: 'Hack 失败',
  HACK_SKIPPED: '跳过 Hack',
};

export function isAcceptedStatus(key: string): boolean {
  return key === 'AC';
}

export function isPendingStatusId(id: number): boolean {
  return id === 0 || id === 1;
}
