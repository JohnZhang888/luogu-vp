import { describe, expect, it } from 'vitest';
import type { JudgeResult, SubmissionJobView } from '@vp/core';
import { MOCK_PROBLEM_PID } from '@vp/core';
import { ProblemService } from '../luogu/problem';
import { RecordService } from '../luogu/record';
import type { SessionStore } from '../session/store';
import type { BrowserLauncher } from '../browser/launcher';
import { nextMockRid } from '../mock/mock';
import { SubmissionService } from './service';

const dummySession = {} as SessionStore;
const dummyLauncher = {} as BrowserLauncher;

function newService(): SubmissionService {
  return new SubmissionService(
    dummySession,
    dummyLauncher,
    new ProblemService(),
    new RecordService(dummySession),
  );
}

function waitFor(
  service: SubmissionService,
  clientId: string,
  timeoutMs: number,
): Promise<SubmissionJobView> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const view = service.get(clientId);
      if (view === null) {
        reject(new Error('任务不存在'));
        return;
      }
      if (view.state === 'done' || view.state === 'failed') {
        resolve(view);
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`等待超时，当前状态 ${view.state}`));
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('虚构测试提交', () => {
  it('不登录也能完成 IOI 提交并返回七种状态的评测结果', async () => {
    const service = newService();
    const clientId = crypto.randomUUID();
    service.start({
      clientId,
      pid: MOCK_PROBLEM_PID,
      code: '#include <iostream>',
      languageId: 28,
      enableO2: true,
      format: 'ioi',
    });

    const view = await waitFor(service, clientId, 15_000);
    expect(view.error).toBeNull();
    expect(view.state).toBe('done');
    expect(view.rid).not.toBeNull();
    expect(view.judge?.subtasks.map((s) => s.testCases[0]?.statusKey)).toEqual([
      'AC',
      'WA',
      'TLE',
      'MLE',
      'RE',
      'OLE',
      'UKE',
    ]);
  }, 20_000);

  it('OI 赛制下视图不泄露评测结果', async () => {
    const service = newService();
    const clientId = crypto.randomUUID();
    service.start({
      clientId,
      pid: MOCK_PROBLEM_PID,
      code: 'print(1)',
      languageId: 28,
      enableO2: false,
      format: 'oi',
    });

    await delay(300);
    const view = service.get(clientId);
    expect(view?.state).toBe('submitted');
    expect(view?.rid).not.toBeNull();
    expect(view?.judge).toBeNull();
  });

  it('记录服务对 mock rid 直接返回虚构结果', async () => {
    const records = new RecordService(dummySession);
    const judge: JudgeResult = await records.fetchRecord(nextMockRid());
    expect(judge.pending).toBe(false);
    expect(judge.subtasks.length).toBe(7);
  });
});
