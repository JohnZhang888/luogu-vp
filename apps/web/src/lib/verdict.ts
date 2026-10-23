/**
 * 评测状态到颜色的映射，与洛谷官方评测结果的观感保持一致：
 * AC 绿、WA/RE 红、TLE/MLE/OLE/CE 琥珀，其余中性色。
 * StatusBadge 与测试点卡片共用，保证同一状态在页面各处颜色一致。
 */
export interface VerdictTone {
  badge: string;
  card: string;
  strong: string;
  meta: string;
}

const TEAL: VerdictTone = {
  badge:
    'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300',
  card: 'border-teal-200 bg-teal-50 dark:border-teal-500/30 dark:bg-teal-500/10',
  strong: 'text-teal-700 dark:text-teal-300',
  meta: 'text-teal-600 dark:text-teal-400/90',
};

const RED: VerdictTone = {
  badge:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300',
  card: 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10',
  strong: 'text-red-700 dark:text-red-300',
  meta: 'text-red-600 dark:text-red-400/90',
};

const AMBER: VerdictTone = {
  badge:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
  card: 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
  strong: 'text-amber-700 dark:text-amber-300',
  meta: 'text-amber-600 dark:text-amber-400/90',
};

const ZINC: VerdictTone = {
  badge:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
  card: 'border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900',
  strong: 'text-zinc-700 dark:text-zinc-300',
  meta: 'text-zinc-500 dark:text-zinc-400',
};

const TONES: Record<string, VerdictTone> = {
  AC: TEAL,
  WA: RED,
  RE: RED,
  NAC: RED,
  TLE: AMBER,
  MLE: AMBER,
  OLE: AMBER,
  CE: AMBER,
};

export function verdictTone(statusKey: string, pending = false): VerdictTone {
  if (pending) return ZINC;
  return TONES[statusKey] ?? ZINC;
}

/** 测试点卡片上的大号状态字，超长的键缩写成短标记。 */
const CARD_LABELS: Record<string, string> = {
  UNSHOWN: 'N/A',
  WAITING: 'WAIT',
  JUDGING: 'JUDGING',
  HACK_SUCCESS: 'HACK',
  HACK_FAILURE: 'HACK',
  HACK_SKIPPED: 'SKIP',
};

export function verdictCardLabel(statusKey: string): string {
  return CARD_LABELS[statusKey] ?? statusKey;
}
