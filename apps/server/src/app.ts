import { existsSync } from 'node:fs';
import path from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { appConfig } from './config';
import { AppError } from './errors';
import { authRoutes } from './routes/auth';
import { luoguRoutes } from './routes/luogu';
import { recordRoutes } from './routes/records';
import { submissionRoutes } from './routes/submissions';
import { systemRoutes } from './routes/system';
import { createServices, shutdownServices, type Services } from './services';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: appConfig.logLevel,
      redact: {
        paths: ['req.headers.cookie', 'req.headers.authorization'],
        censor: '[redacted]',
      },
    },
    bodyLimit: 2 * 1024 * 1024,
  });

  const services: Services = createServices();
  app.decorate('services', services);

  const allowedOrigins = new Set([
    `http://127.0.0.1:${appConfig.port}`,
    `http://localhost:${appConfig.port}`,
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ]);
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin !== undefined && !allowedOrigins.has(origin)) {
      return reply.status(403).send({
        error: {
          code: 'ORIGIN_NOT_ALLOWED',
          message: '请求来源不被允许。',
        },
      });
    }
  });
  app.addHook('onClose', async () => {
    await shutdownServices(services);
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error.issues[0]?.message ?? '请求参数不合法。',
        },
      });
    }
    const statusCode = (error as { statusCode?: number }).statusCode;
    if (
      typeof statusCode === 'number' &&
      statusCode >= 400 &&
      statusCode < 500
    ) {
      return reply.status(statusCode).send({
        error: {
          code: 'INVALID_REQUEST',
          message: error instanceof Error ? error.message : '请求参数不合法。',
        },
      });
    }
    if (error instanceof AppError) {
      return reply.status(error.status).send({
        error: { code: error.code, message: error.message },
      });
    }
    request.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({
      error: { code: 'INTERNAL', message: '服务器内部错误。' },
    });
  });

  await app.register(authRoutes);
  await app.register(luoguRoutes);
  await app.register(submissionRoutes);
  await app.register(recordRoutes);
  await app.register(systemRoutes);

  app.get('/api/health', async () => ({ ok: true }));

  const clientIndex = path.join(appConfig.clientDist, 'index.html');
  if (existsSync(clientIndex)) {
    await app.register(fastifyStatic, {
      root: appConfig.clientDist,
      prefix: '/',
      wildcard: false,
    });
    app.setNotFoundHandler((request, reply) => {
      if (request.method === 'GET' && !request.url.startsWith('/api')) {
        return reply.sendFile('index.html');
      }
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: '资源不存在。' },
      });
    });
  } else {
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api')) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: '接口不存在。' },
        });
      }
      return reply.status(503).send({
        error: {
          code: 'CLIENT_NOT_BUILT',
          message: '前端尚未构建：请运行 npm run build 后再启动服务。',
        },
      });
    });
  }

  return app;
}
