import { describe, expect, it } from 'vitest';
import type { LuoguConfig } from './config';
import { normalizeRecord } from './record';

const config: LuoguConfig = {
  CodeLanguage: {
    '28': {
      type: 'Cpp14Gcc9',
      id: 28,
      name: 'C++14 (GCC 9)',
      order: 4,
      family: 'c',
      disabled: false,
      canO2: true,
      hljs: 'cpp',
    },
  },
  RecordStatus: {
    '0': {
      type: 'Waiting',
      id: 0,
      name: 'Waiting',
      shortName: 'Waiting',
      color: 'blue-4',
    },
    '1': {
      type: 'Judging',
      id: 1,
      name: 'Judging',
      shortName: 'Judging',
      color: 'blue-3',
    },
    '12': {
      type: 'Accepted',
      id: 12,
      name: 'Accepted',
      shortName: 'AC',
      color: 'green-3',
    },
  },
  ContestMethod: {},
};

describe('normalizeRecord', () => {
  it('reads the real Luogu record detail shape', () => {
    const judge = normalizeRecord(
      {
        status: 12,
        score: 100,
        time: 12,
        memory: 1024,
        submitTime: 1_792_678_000,
        language: 28,
        enableO2: true,
        detail: {
          compileResult: { success: false, message: "error: expected ';'" },
          judgeResult: {
            subtasks: [
              {
                id: 0,
                score: 100,
                status: 12,
                testCases: [
                  {
                    id: 0,
                    subtaskID: 0,
                    status: 12,
                    score: 100,
                    time: 12,
                    memory: 1024,
                    description: '',
                  },
                ],
              },
            ],
          },
        },
      },
      config,
    );

    expect(judge.statusKey).toBe('AC');
    expect(judge.statusShortName).toBe('AC');
    expect(judge.score).toBe(100);
    expect(judge.pending).toBe(false);
    expect(judge.compileMessage).toBe("error: expected ';'");
    expect(judge.submittedAtMs).toBe(1_792_678_000_000);
    expect(judge.subtasks).toHaveLength(1);
    expect(judge.subtasks[0]?.testCases[0]?.id).toBe('1');
    expect(judge.subtasks[0]?.testCases[0]?.memoryKb).toBe(1024);
  });

  it('marks waiting/judging records as pending', () => {
    const judge = normalizeRecord({ status: 1, score: 0 }, config);
    expect(judge.pending).toBe(true);
    expect(judge.statusKey).toBe('JUDGING');
  });
});
