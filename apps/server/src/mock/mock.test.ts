import { describe, expect, it, vi } from 'vitest';
import { MOCK_PROBLEM_PID } from '@vp/core';
import {
  isMockPid,
  isMockRid,
  mockJudge,
  mockProblem,
  nextMockRid,
} from './mock';

describe('虚构测试比赛数据', () => {
  it('题目详情字段完整且指向虚构题号', () => {
    const problem = mockProblem();
    expect(problem.pid).toBe(MOCK_PROBLEM_PID);
    expect(problem.fullScore).toBe(100);
    expect(problem.timeLimitMs).toBeGreaterThan(0);
    expect(problem.memoryLimitKb).toBeGreaterThan(0);
    expect(problem.samples.length).toBeGreaterThan(0);
    expect(problem.languages.length).toBeGreaterThan(0);
    expect(isMockPid(problem.pid)).toBe(true);
  });

  it('评测结果覆盖 AC/WA/TLE/MLE/RE/OLE/UKE 七种状态', () => {
    const judge = mockJudge();
    const keys = judge.subtasks.map(
      (subtask) => subtask.testCases[0]?.statusKey,
    );
    expect(keys).toEqual(['AC', 'WA', 'TLE', 'MLE', 'RE', 'OLE', 'UKE']);
    expect(judge.pending).toBe(false);
    // 第一个失败的子任务决定总状态。
    expect(judge.statusKey).toBe('WA');
    expect(judge.score).toBe(10);
    expect(judge.timeMs).toBe(1000);
    expect(judge.memoryKb).toBe(512 * 1024);
  });

  it('每次调用返回相同结构的结果', () => {
    expect(mockJudge()).toEqual(mockJudge());
  });

  it('mock rid 可识别且不与真实记录冲突', () => {
    const first = nextMockRid();
    const second = nextMockRid();
    expect(second).toBe(first + 1);
    expect(isMockRid(first)).toBe(true);
    expect(isMockRid(123456789)).toBe(false);
  });
});

describe('禁用 mock（生产模式行为）', () => {
  it('VP_DEV_MOCK=0 时题目、记录、提交全部拒绝且不触发洛谷请求', async () => {
    vi.stubEnv('VP_DEV_MOCK', '0');
    vi.resetModules();
    try {
      const { appConfig } = await import('../config');
      expect(appConfig.mockEnabled).toBe(false);

      const { MOCK_PROBLEM_PID: pid } = await import('@vp/core');
      const { ProblemService } = await import('../luogu/problem');
      const { RecordService } = await import('../luogu/record');
      const { SubmissionService } = await import('../submissions/service');
      const { isMockRid: checkRid } = await import('./mock');
      const { SessionStore } = await import('../session/store');
      const { BrowserLauncher } = await import('../browser/launcher');

      await expect(new ProblemService().get(pid)).rejects.toMatchObject({
        code: 'PROBLEM_NOT_FOUND',
      });

      const session = new SessionStore('/tmp') as InstanceType<typeof SessionStore>;
      const launcher = new BrowserLauncher() as InstanceType<typeof BrowserLauncher>;
      const records = new RecordService(session);
      await expect(records.fetchRecord(9_000_000_001)).rejects.toMatchObject({
        code: 'RECORD_NOT_FOUND',
      });
      expect(checkRid(9_000_000_001)).toBe(true);

      const submissions = new SubmissionService(
        session,
        launcher,
        new ProblemService(),
        records,
      );
      const clientId = crypto.randomUUID();
      submissions.start({
        clientId,
        pid,
        code: 'int main() {}',
        languageId: 28,
        enableO2: false,
        format: 'ioi',
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
      const view = submissions.get(clientId);
      expect(view?.state).toBe('failed');
      expect(view?.error?.code).toBe('MOCK_DISABLED');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
