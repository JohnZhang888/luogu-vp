import type { FastifyPluginAsync } from 'fastify';
import type { AuthStatus, LoginStatus } from '@vp/core';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/auth/status', async (): Promise<AuthStatus> => {
    try {
      const user = await app.services.session.currentUser();
      return { loggedIn: user !== null, user, error: null };
    } catch (error) {
      return {
        loggedIn: false,
        user: null,
        error: error instanceof Error ? error.message : '无法连接洛谷。',
      };
    }
  });

  app.post('/api/auth/login', async (): Promise<LoginStatus> => {
    return app.services.login.start();
  });

  app.get('/api/auth/login', async (): Promise<LoginStatus> => {
    return app.services.login.getStatus();
  });

  app.post('/api/auth/login/check', async (): Promise<LoginStatus> => {
    return app.services.login.checkNow();
  });

  app.post('/api/auth/login/cancel', async (): Promise<LoginStatus> => {
    return app.services.login.cancel();
  });

  app.post('/api/auth/logout', async () => {
    await app.services.session.clear();
    await app.services.login.cancel();
    return { ok: true };
  });
};
