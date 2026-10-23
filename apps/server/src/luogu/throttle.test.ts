import { describe, expect, it } from 'vitest';
import { createThrottle } from './throttle';

describe('createThrottle', () => {
  it('spaces concurrent callers by at least the minimum interval', async () => {
    const throttle = createThrottle(120);
    const startedAt: number[] = [];

    await Promise.all(
      Array.from({ length: 3 }, () =>
        throttle.wait().then(() => {
          startedAt.push(Date.now());
        }),
      ),
    );

    const sorted = [...startedAt].sort((a, b) => a - b);
    expect(sorted).toHaveLength(3);
    for (let index = 1; index < sorted.length; index += 1) {
      // 给定时器一点抖动余量，但必须明显大于 0。
      expect(sorted[index] - sorted[index - 1]).toBeGreaterThanOrEqual(100);
    }
  });

  it('does not delay the first call', async () => {
    const throttle = createThrottle(5_000);
    const start = Date.now();
    await throttle.wait();
    expect(Date.now() - start).toBeLessThan(200);
  });
});
