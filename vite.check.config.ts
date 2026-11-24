// 검사 전용 dev 서버(지시서 20 · 2-3) — 포트 5274, HMR 끔.
// 다른 에이전트가 파일을 고쳐도 열린 검사 페이지가 새로 고쳐지지 않는다(새로 여는 페이지는 최신 코드를 받는다).
// 사용: npm run dev:check   (5273 사용자·수동 확인 서버는 vite.config.ts 그대로)
import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config';

export default mergeConfig(
  base,
  defineConfig({
    server: {
      port: 5274,
      strictPort: true,
      hmr: false
    }
  })
);
