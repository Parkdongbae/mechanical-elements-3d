// 임시 스텁 — 작업 지시서 13에 따라 구현 예정
import type { AppMode, ModeContext } from '../modes/types';

export class HandPump implements AppMode {
  enter(ctx: ModeContext): void { ctx.root.innerHTML = ''; }
  exit(): void {}
  update(): void {}
}
