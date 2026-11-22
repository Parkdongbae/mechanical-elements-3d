// 학습 모드(도감·퀴즈) 공통 인터페이스 — 미션과 달리 3D 씬과 DOM 패널을 모드가 직접 관리한다.

import type { SceneManager } from '../scene/SceneSetup';
import type { ThumbnailFactory } from '../models/thumbnails';
import type { AppSettings } from '../state/settings';

export interface ModeContext {
  sceneMgr: SceneManager;
  thumbs: ThumbnailFactory;
  /** 모드 전용 DOM 컨테이너(화면 전체, pointer-events: none). 모드가 넣은 패널에는 pointer-events: auto를 준다. */
  root: HTMLElement;
  settings: AppSettings;
  toast(message: string, kind?: 'ok' | 'warn' | 'info', duration?: number): void;
  goHome(): void;
  playSound(kind: 'ok' | 'wrong'): void;
}

export interface AppMode {
  /** 모드 진입: root에 DOM을 만들고 씬에 오브젝트를 추가하고 카메라를 맞춘다 */
  enter(ctx: ModeContext): void;
  /** 모드 종료: 자신이 추가한 DOM·씬 오브젝트·이벤트 리스너를 모두 제거한다 */
  exit(): void;
  update(dt: number, t: number): void;
}
