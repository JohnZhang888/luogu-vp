import { buildApp } from './app';
import { appConfig } from './config';

const app = await buildApp();

try {
  await app.listen({ port: appConfig.port, host: appConfig.host });
  app.log.info(
    `VP 服务已启动：http://${appConfig.host}:${appConfig.port}`,
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

let closing = false;
async function shutdown(signal: string): Promise<void> {
  if (closing) return;
  closing = true;
  app.log.info(`收到 ${signal}，正在关闭服务。`);
  try {
    await app.close();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
