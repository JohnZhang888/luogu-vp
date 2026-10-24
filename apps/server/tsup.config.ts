import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@vp/core'],
  define: {
    // 生产构建永久关闭虚构测试比赛；开发用 tsx 直跑源码，不受此 define 影响。
    'process.env.VP_DEV_MOCK': '"0"',
  },
});
