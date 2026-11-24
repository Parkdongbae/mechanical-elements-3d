// 507 기계 운동 — 모든 운동 모델이 지키는 공용 타입 (작업 지시서 16 §3-2)
import type * as THREE from 'three';
import type { CameraView } from '../scene/SceneSetup';

export interface MovementNote { label: string; value: string }

export interface MovementModel {
  /** 씬에 추가할 루트. 전시대 포함 */
  group: THREE.Group;
  /** 매 프레임. dt = 초, speed = 사용자 속도 배율(0~3, 음수면 역회전) */
  update(dt: number, speed: number): void;
  /** 상세 화면 수치 패널(선택) — 매 프레임 읽으므로 가볍게 */
  notes?(): MovementNote[];
  /** 권장 시점(없으면 기본 정면 시점) */
  view?: CameraView;
  /** 직접 만든 텍스처 등 해제(지오메트리·재질은 공용 disposeObject 가 처리) */
  dispose?(): void;
}

/** src/mm507/models/mNNN.ts 는 이 함수를 default export 한다 */
export type MovementBuilder = () => MovementModel;

/** 기본 구동 각속도(rad/s, 약 15rpm) — §3-2. 설계표가 따로 정하면 그 값을 쓴다 */
export const OMEGA = 1.6;
