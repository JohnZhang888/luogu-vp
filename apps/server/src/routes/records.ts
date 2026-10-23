import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

const batchSchema = z.object({
  rids: z
    .array(z.number().int().positive())
    .max(200, '一次最多读取 200 条记录。'),
  format: z.enum(['icpc', 'ioi', 'oi', 'rakuta']),
});

export const recordRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/records/batch', async (request) => {
    const body = batchSchema.parse(request.body);
    const records = await app.services.records.fetchMany(body.rids);
    return { records };
  });
};
