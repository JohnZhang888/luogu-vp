import { sleep } from '../util/fs';

/** 任意两次发往洛谷的请求之间的全局最小间隔。 */
export const LUOGU_MIN_REQUEST_INTERVAL_MS = 500;

export interface Throttle {
  wait(): Promise<void>;
}

/**
 * 创建一个全局节流器：所有调用方排队进入，保证相邻两次请求的发出时间
 * 至少相隔 minIntervalMs。节流只影响“何时发出请求”，不等待请求完成，
 * 因此不会因为某个请求卡住而阻塞其它调用方。
 */
export function createThrottle(minIntervalMs: number): Throttle {
  let tail: Promise<void> = Promise.resolve();
  let lastAt = 0;

  return {
    wait(): Promise<void> {
      const slot = tail.then(async () => {
        const now = Date.now();
        const waitMs = lastAt + minIntervalMs - now;
        if (waitMs > 0) await sleep(waitMs);
        lastAt = Date.now();
      });
      // 单个调用方失败不应该让整条队列表死；wait 本身不抛错。
      tail = slot.catch(() => undefined);
      return slot;
    },
  };
}

/** 服务端所有洛谷请求共用的节流器。 */
export const luoguThrottle = createThrottle(LUOGU_MIN_REQUEST_INTERVAL_MS);
