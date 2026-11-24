/// <reference types="vite/client" />
// 「507 기계 운동」 모델 레지스트리 — 번들별 지연 로딩 (작업 지시서 16 · 3-4)
import type { MovementModel } from './types';

type MovementModule = { default: () => MovementModel };

const loaders = import.meta.glob<MovementModule>('./models/m*.ts');

/** m001.ts ↔ 1번 — 번호 → 모듈 경로 */
const key = (n: number): string => `./models/m${String(n).padStart(3, '0')}.ts`;

/** n번 모델이 존재하는가 */
export function hasModel(n: number): boolean {
  return key(n) in loaders;
}

/** n번 모델을 지연 로딩해 만든다 (모델 파일은 MovementBuilder를 default export) */
export async function loadModel(n: number): Promise<MovementModel> {
  const loader = loaders[key(n)];
  if (!loader) throw new Error(`mm507: ${n}번 모델이 없습니다`);
  const mod = await loader();
  return mod.default();
}

/** 만들어 둔 모델 번호 목록 (오름차순) */
export function listModels(): number[] {
  return Object.keys(loaders)
    .map((k) => /^\.\/models\/m(\d+)\.ts$/.exec(k)?.[1])
    .filter((s): s is string => s !== undefined)
    .map((s) => Number(s))
    .sort((a, b) => a - b);
}
