import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '../errors';

const formatSchema = z.enum(['icpc', 'ioi', 'oi', 'rakuta']);

const startSchema = z.object({
  clientId: z.string().uuid(),
  pid: z.string().trim().min(1).max(32),
  code: z.string().max(1_000_000),
  languageId: z.number().int().positive(),
  enableO2: z.boolean(),
  format: formatSchema,
});

const captchaSchema = z.object({
  answer: z.string().trim().min(1).max(64),
});

export const submissionRoutes: FastifyPluginAsync = async (app) => {
  app.post('/api/submissions', async (request) => {
    const body = startSchema.parse(request.body);
    return app.services.submissions.start(body);
  });

  app.get<{ Params: { clientId: string } }>(
    '/api/submissions/:clientId',
    async (request) => {
      const view = app.services.submissions.get(request.params.clientId);
      if (view === null) {
        throw new AppError('SUBMISSION_NOT_FOUND', '找不到这次提交。', 404);
      }
      return view;
    },
  );

  app.post<{ Params: { clientId: string } }>(
    '/api/submissions/:clientId/captcha',
    async (request) => {
      const body = captchaSchema.parse(request.body);
      return app.services.submissions.answerCaptcha(
        request.params.clientId,
        body.answer,
      );
    },
  );

  app.post<{ Params: { clientId: string } }>(
    '/api/submissions/:clientId/cancel',
    async (request) => {
      return app.services.submissions.cancel(request.params.clientId);
    },
  );
};
