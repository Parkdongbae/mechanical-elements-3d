import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    watch: {
      // 쇼츠 산출물(shorts/, assets/shorts/ — 프레임 수천 장·음악 복사 중 EBUSY)도 뺀다. 내려받는 중인 파일(.crdownload)이나 큰 참고 자료 폴더를 감시하다 EBUSY로 서버가 죽는 것을 막는다
      ignored: ['**/mechanical_movements_507/**', '**/*.crdownload', '**/shots/**', '**/parts/**', '**/dist/**', '**/shorts/**', '**/assets/shorts/**']
    }
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200
  }
});
