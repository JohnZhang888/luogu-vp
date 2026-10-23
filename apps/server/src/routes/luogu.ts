import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors';

const PID_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,19}$/;

const pidSchema = z
  .string()
  .trim()
  .regex(PID_PATTERN, '题目 ID 格式不正确。');

const resolveSchema = z.object({
  pids: z
    .array(pidSchema)
    .min(1, '至少添加一道题目。')
    .max(26, '一场比赛最多 26 道题。'),
});

export const luoguRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Params: { id: string } }>(
    '/api/luogu/contest/:id',
    async (request) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        throw new AppError('INVALID_REQUEST', '比赛 ID 不合法。', 400);
      }
      return app.services.contests.get(id);
    },
  );

  app.get<{ Params: { pid: string } }>(
    '/api/luogu/problem/:pid',
    async (request) => {
      const pid = pidSchema.parse(request.params.pid);
      return app.services.problems.get(pid);
    },
  );

  app.post('/api/luogu/problems/resolve', async (request) => {
    const body = resolveSchema.parse(request.body);
    const unique = [...new Set(body.pids.map((pid) => pid))];
    const results = await app.services.problems.resolveMany(unique);
    return { results };
  });
};
