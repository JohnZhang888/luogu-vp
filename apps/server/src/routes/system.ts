import type { FastifyInstance } from 'fastify';

/**
 * 桌面端（Electron）退出时需要让服务端优雅关闭，否则 Playwright 启动的浏览器
 * 进程可能残留。只在该环境变量存在时注册，并且要求请求头带上同一个随机令牌，
 * 避免本机其他页面随手把服务关掉。
 */
export async function systemRoutes(app: FastifyInstance): Promise<void> {
  const token = process.env.VP_SHUTDOWN_TOKEN ?? '';
  if (token === '') return;

  app.post('/api/system/shutdown', async (request, reply) => {
    if (request.headers['x-vp-token'] !== token) {
      return reply.status(403).send({
        error: { code: 'FORBIDDEN', message: '无权关闭本地服务。' },
      });
    }

    await reply.send({ ok: true });
    setTimeout(() => {
      void app.close().finally(() => process.exit(0));
    }, 50);
  });
}
