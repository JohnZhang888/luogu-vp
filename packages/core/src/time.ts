import type {
  ContestConfig,
  ContestPhase,
  ContestRuntime,
  PauseInterval,
} from './types';

export function createRuntime(): ContestRuntime {
  return { finishedAt: null, pauses: [] };
}

export function hasOpenPause(runtime: ContestRuntime): boolean {
  const last = runtime.pauses[runtime.pauses.length - 1];
  return last !== undefined && last.end === null;
}

/** at 时刻之前（含当前未结束暂停）累计暂停了多久。 */
export function pausedMsAt(runtime: ContestRuntime, at: number): number {
  let total = 0;
  for (const interval of runtime.pauses) {
    if (at <= interval.start) continue;
    const end = interval.end ?? at;
    if (end <= interval.start) continue;
    total += Math.min(end, at) - interval.start;
  }
  return Math.max(0, total);
}

/** 单次提交对应的有效比赛用时：排除暂停时间，并截断到比赛时长。 */
export function activeElapsedMs(
  config: ContestConfig,
  runtime: ContestRuntime,
  at: number,
): number {
  const start = config.startAt;
  if (at <= start) return 0;
  const end = Math.min(at, config.startAt + config.durationMs + pausedMsAt(runtime, at));
  const elapsed = end - start - pausedMsAt(runtime, end);
  return Math.min(config.durationMs, Math.max(0, elapsed));
}

export function effectiveEnd(
  config: ContestConfig,
  runtime: ContestRuntime,
  at: number,
): number {
  if (runtime.finishedAt !== null) return runtime.finishedAt;
  return config.startAt + config.durationMs + pausedMsAt(runtime, at);
}

export function remainingMs(
  config: ContestConfig,
  runtime: ContestRuntime,
  at: number,
): number {
  if (runtime.finishedAt !== null) return 0;
  if (at < config.startAt) return config.durationMs;
  const active = at - config.startAt - pausedMsAt(runtime, at);
  return Math.max(0, config.durationMs - active);
}

export function phaseAt(
  config: ContestConfig,
  runtime: ContestRuntime,
  at: number,
): ContestPhase {
  if (runtime.finishedAt !== null) return 'finished';
  if (at < config.startAt) return 'scheduled';
  if (hasOpenPause(runtime)) return 'paused';
  if (at >= effectiveEnd(config, runtime, at)) return 'finished';
  return 'running';
}

export function pauseContest(
  runtime: ContestRuntime,
  at: number,
): ContestRuntime {
  if (runtime.finishedAt !== null || hasOpenPause(runtime)) return runtime;
  const interval: PauseInterval = { start: at, end: null };
  return { ...runtime, pauses: [...runtime.pauses, interval] };
}

export function resumeContest(
  runtime: ContestRuntime,
  at: number,
): ContestRuntime {
  if (!hasOpenPause(runtime)) return runtime;
  const pauses = runtime.pauses.map((interval, index) => {
    if (index !== runtime.pauses.length - 1 || interval.end !== null) {
      return interval;
    }
    return { ...interval, end: Math.max(interval.start, at) };
  });
  return { ...runtime, pauses };
}

export function finishContest(
  runtime: ContestRuntime,
  at: number,
): ContestRuntime {
  if (runtime.finishedAt !== null) return runtime;
  const closed = resumeContest(runtime, at);
  return { ...closed, finishedAt: Math.max(at, 0) };
}

export function usedActiveMs(
  config: ContestConfig,
  runtime: ContestRuntime,
  at: number,
): number {
  const end =
    runtime.finishedAt !== null ? runtime.finishedAt : effectiveEnd(config, runtime, at);
  return activeElapsedMs(config, runtime, end);
}
