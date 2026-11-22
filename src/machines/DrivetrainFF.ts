// 자동차 구동방식 — FF 전륜구동: 엔진·트랜스액슬·바퀴 4가 순차 등장하는 차에서
// 하단 '축용' 패널에서 구동축(앞 구동축&차동기어) → 차축(뒤 차축) 순서로 정답을 찾아 선택하는 미션.
// 정답을 모두 맞추면 구동축과 앞바퀴만 회전한다(뒷바퀴는 차축 위 정지).
//
// v2: OpenSCAD STL을 버리고 drivetrainParts.ts의 절차 모델로 교체. 좌표는 기존 STL 조립 좌표(root 기준,
// 바퀴/축 중심 y=0.12, 앞차축 z=-0.65, 뒷차축 z=+0.65)를 그대로 써서 슬롯·비행 목표·피벗·라벨이 같은 자리에 있다.
// 엔진(가로 배치, 왼쪽 -X)·트랜스액슬(오른쪽 +X, 아래에 반투명 디퍼렌셜 하우징)·사다리 프레임·반투명 차체 셸.

import * as THREE from 'three';
import { BaseMachine, type MachineSim } from './types';
import { makeCalloutLine, makeLabelSprite } from './stlShared';
import {
  CAR,
  applyIntro,
  buildCaliper,
  buildCarShell,
  buildDiffWithHalfShafts,
  buildFFTransaxle,
  buildInline4Engine,
  buildLadderFrame,
  buildStrutCorner,
  buildTorsionBeamAxle,
  buildWheel,
  finishIntroItems,
  fixGhostShadows,
  hideIntroItems,
  type IntroItem
} from './drivetrainParts';

const ROOT_Y = CAR.rootY; // 바퀴 바닥이 씬 바닥(y=0)에 닿는 루트 높이
const X_AXIS = new THREE.Vector3(1, 0, 0);
const SPIN_SPEED = 2.2;

// root 좌표 회전축 기준점(축 중심선: X 방향)
const FRONT_AXIS = new THREE.Vector3(0, CAR.axleY, CAR.frontZ);
const REAR_AXIS = new THREE.Vector3(0, CAR.axleY, CAR.rearZ);

// 엔진(기존 STL 외곽: x -0.41~-0.03, y 0.16~0.535, z -0.81~-0.33)
const ENGINE = { length: 0.38, width: 0.48, height: 0.375, center: new THREE.Vector3(-0.22, 0.3475, -0.57) };
const CRANK_Y = ENGINE.center.y - ENGINE.height / 2 + 0.12 * (ENGINE.height / 0.38);

interface AnswerSpec {
  center: THREE.Vector3; // 비행 목표(기존 STL bbox 중심, root 좌표)
  axis: THREE.Vector3; // 회전 피벗(root 좌표)
  build: () => THREE.Group; // root 좌표 모델
}

class AnswerPart {
  pivot: THREE.Group | null = null;
  installed = false;
  constructor(readonly spec: AnswerSpec) {}
}

export class DrivetrainFF extends BaseMachine {
  readonly id = 'drivetrain-ff';
  readonly stepCount = 2;

  private root = new THREE.Group();
  private intro: IntroItem[] = [];
  private introStart = -1;
  private introDone = false;

  private drive = new AnswerPart({ center: new THREE.Vector3(0, 0.12, -0.65), axis: FRONT_AXIS, build: () => buildDiffWithHalfShafts(CAR.frontZ, 0.04, false) }); // step 0: 구동축
  private axle = new AnswerPart({
    center: new THREE.Vector3(0, 0.12, 0.65),
    axis: REAR_AXIS,
    build: () => {
      const g = new THREE.Group();
      const a = buildTorsionBeamAxle();
      a.position.copy(REAR_AXIS);
      g.add(a);
      return g;
    }
  }); // step 1: 차축
  private wheelPivots: { pivot: THREE.Group; sign: number; front: boolean }[] = [];
  private theta = 0;
  private spinning = false;

  constructor() {
    super();
    this.root.position.set(0, ROOT_Y, 0);
    this.group.add(this.root);
    this.buildCar();
    this.buildSlots();
    this.buildFrontRearLabels();
    this.enableShadows();
    hideIntroItems(this.intro);
  }

  protected override enableShadows(): void {
    super.enableShadows();
    fixGhostShadows(this.group);
  }

  // ── Machine 인터페이스 ──

  isInstalled(step: number): boolean {
    return step === 0 ? this.drive.installed : this.axle.installed;
  }

  getFlyTarget(step: number): THREE.Vector3 {
    const part = step === 0 ? this.drive : this.axle;
    return new THREE.Vector3(0, ROOT_Y, 0).add(part.spec.center);
  }

  slotTarget(step: number): THREE.Vector3 {
    return this.getFlyTarget(step);
  }

  buildStepModel(step: number): THREE.Group {
    const part = step === 0 ? this.drive : this.axle;
    const group = new THREE.Group();
    group.add(this.makeHolder(part));
    return group;
  }

  /** 정답 모델을 '중심이 원점'인 홀더에 담는다(비행 중 원점 = 비행 목표) */
  private makeHolder(part: AnswerPart): THREE.Group {
    const holder = new THREE.Group();
    const model = part.spec.build();
    model.position.sub(part.spec.center);
    holder.add(model);
    holder.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true;
    });
    return holder;
  }

  installStep(step: number, model: THREE.Group): void {
    const part = step === 0 ? this.drive : this.axle;
    if (part.installed) return;
    part.installed = true;
    this.hideSlot(step);
    if (step === 0) {
      this.showSlot(1); // 다음 정답(차축) 슬롯 표시
      if (this.diffCallout) { // 구동축이 등장한 후 디퍼렌셜 라벨 표시
        this.diffCallout.sprite.visible = true;
        this.diffCallout.line.visible = true;
      }
    }
    const holder = (model.children[0] as THREE.Group | undefined) ?? this.makeHolder(part);
    model.removeFromParent();
    this.attachAnswerPivot(part, holder);
    if (this.drive.installed && this.axle.installed) this.spinning = true;
    this.enableShadows();
  }

  reset(): void {
    for (const part of [this.drive, this.axle]) {
      part.installed = false;
      if (part.pivot) {
        part.pivot.removeFromParent();
        part.pivot = null;
      }
    }
    this.showSlot(0);
    this.hideSlot(1);
    if (this.diffCallout) {
      this.diffCallout.sprite.visible = false;
      this.diffCallout.line.visible = false;
    }
    this.introStart = -1;
    this.introDone = false;
    this.spinning = false;
    this.theta = 0;
    for (const w of this.wheelPivots) w.pivot.setRotationFromAxisAngle(X_AXIS, 0);
    hideIntroItems(this.intro);
  }

  update(t: number): void {
    super.update(t);
    this.updateIntro(t);
  }

  createSim(): MachineSim {
    const self = this;
    return {
      update: (dt: number) => {
        if (!self.spinning) return;
        self.theta += SPIN_SPEED * dt;
        for (const entry of this.spinEntries()) {
          entry.pivot.setRotationFromAxisAngle(X_AXIS, self.theta * entry.sign);
        }
      },
      getDisplay: () => [
        { label: '구동 방식', value: 'FF (전륜구동)' },
        { label: '구동 요소', value: '구동축 + 차동기어' },
        { label: '회전', value: this.spinning ? '구동축 + 앞바퀴' : '정지' }
      ]
    };
  }

  private spinEntries(): { pivot: THREE.Group; sign: number }[] {
    // FF는 전륜구동 — 구동축과 앞바퀴만 회전한다(뒷바퀴는 차축 위 정지)
    const entries: { pivot: THREE.Group; sign: number }[] = [];
    if (this.drive.pivot) entries.push({ pivot: this.drive.pivot, sign: -1 });
    for (const w of this.wheelPivots) if (w.front) entries.push(w);
    return entries;
  }

  // ── 씬 구성 ──

  private buildCar(): void {
    // 프레임 + 앞 스트럿(고정부) — 인트로 시작과 함께 페이드 인(낙하 없음)
    const frame = buildLadderFrame();
    frame.add(buildStrutCorner(-1, CAR.frontZ), buildStrutCorner(1, CAR.frontZ));
    this.root.add(frame);
    this.intro.push({ obj: frame, delay: 0, baseY: 0, drop: false });

    // 엔진(가로 배치: 크랭크축 X, 풀리·벨트는 왼쪽 -X, 플라이휠은 트랜스액슬 쪽 +X)
    const engine = buildInline4Engine({ length: ENGINE.length, width: ENGINE.width, height: ENGINE.height, mountX: 0.07 });
    engine.position.copy(ENGINE.center);
    this.root.add(engine);
    this.intro.push({ obj: engine, delay: 0.0, baseY: ENGINE.center.y, drop: true });

    const transaxle = buildFFTransaxle(CRANK_Y, ENGINE.center.z, CAR.frontZ);
    this.root.add(transaxle);
    this.intro.push({ obj: transaxle, delay: 0.7, baseY: 0, drop: true });

    // 바퀴 4 — 회전 피벗(바퀴 중심) + 고정 캘리퍼를 한 조립체로 낙하
    const wheels: { name: string; x: number; front: boolean; delay: number }[] = [
      { name: 'fl', x: -CAR.halfTrack, front: true, delay: 1.4 },
      { name: 'fr', x: CAR.halfTrack, front: true, delay: 1.7 },
      { name: 'rl', x: -CAR.halfTrack, front: false, delay: 2.0 },
      { name: 'rr', x: CAR.halfTrack, front: false, delay: 2.3 }
    ];
    for (const w of wheels) {
      const side = (w.x > 0 ? 1 : -1) as 1 | -1;
      const asm = new THREE.Group();
      asm.position.set(w.x, CAR.axleY, w.front ? CAR.frontZ : CAR.rearZ);
      const pivot = new THREE.Group();
      pivot.add(buildWheel(side, { marker: true }));
      asm.add(pivot, buildCaliper(side));
      this.root.add(asm);
      this.wheelPivots.push({ pivot, sign: w.front ? -1 : 1, front: w.front });
      this.intro.push({ obj: asm, delay: w.delay, baseY: CAR.axleY, drop: true });
    }

    // 반투명 차체 셸 — 마지막에 페이드 인
    const shell = buildCarShell();
    this.root.add(shell);
    this.intro.push({ obj: shell, delay: 3.0, baseY: 0, drop: false });
  }

  private buildSlots(): void {
    for (const [step, axis] of [[0, FRONT_AXIS], [1, REAR_AXIS]] as const) {
      this.addSlot(step, 0.42, axis.clone().add(new THREE.Vector3(0, ROOT_Y, 0)));
      const slot = this.slots[step];
      if (slot) slot.rotation.x = -Math.PI / 2; // 축을 감싸는 수평 펄스 링
    }
    this.hideSlot(1); // 현재 정답(구동축) 슬롯만 표시 — 차축은 구동축 정답 후 표시
  }

  /** 캔버스 텍스트 스프라이트 (부품 라벨·앞뒤 표시 공용) */
  private makeLabel(text: string, color: string, position: THREE.Vector3, w = 0.9, h = 0.34, fontPx = 44): THREE.Sprite {
    const sprite = makeLabelSprite(text, color, w, h, fontPx);
    sprite.position.copy(position);
    this.group.add(sprite);
    return sprite;
  }

  private diffCallout: { sprite: THREE.Sprite; line: THREE.Line } | null = null;

  private buildFrontRearLabels(): void {
    this.makeLabel('앞 FRONT', '#7fd1ff', new THREE.Vector3(0, 0.28, -1.65));
    this.makeLabel('뒤 REAR', '#ffd479', new THREE.Vector3(0, 0.28, 1.65));
    // 부품 라벨은 부품에서 띄우고 지시선으로 연결 — 겹침 방지
    this.makeCallout('엔진', '#7fd1ff', new THREE.Vector3(-0.22, 0.18, -0.57), new THREE.Vector3(-0.85, 0.62, -0.55));
    this.makeCallout('변속기', '#ffb37a', new THREE.Vector3(0.13, 0.26, -0.61), new THREE.Vector3(0.62, 0.62, -0.4));
    // 디퍼렌셜은 구동축이 등장한 후에 표시
    this.diffCallout = this.makeCallout('디퍼렌셜', '#8ee08e', new THREE.Vector3(0.0, 0.14, -0.65), new THREE.Vector3(-0.55, 0.5, -0.95));
    this.diffCallout.sprite.visible = false;
    this.diffCallout.line.visible = false;
  }

  /** 부품 → 라벨 지시선 */
  private makeCallout(text: string, color: string, partPoint: THREE.Vector3, labelPos: THREE.Vector3): { sprite: THREE.Sprite; line: THREE.Line } {
    const sprite = this.makeLabel(text, color, labelPos, 0.6, 0.24, 56);
    const line = makeCalloutLine(partPoint, labelPos, color);
    this.root.add(line);
    return { sprite, line };
  }

  /** 정답 부품을 회전 피벗에 물린다 — 피벗 = 회전축 기준점, 홀더 원점 = 비행 목표(center) */
  private attachAnswerPivot(part: AnswerPart, holder: THREE.Group): void {
    const pivot = new THREE.Group();
    pivot.position.copy(part.spec.axis);
    holder.position.copy(part.spec.center).sub(part.spec.axis);
    holder.rotation.set(0, 0, 0);
    holder.scale.setScalar(1);
    pivot.add(holder);
    this.root.add(pivot);
    part.pivot = pivot;
  }

  private updateIntro(t: number): void {
    if (this.introDone) return;
    // 진행도 복원(정답 완료) 상태면 인트로 없이 즉시 표시
    if (this.drive.installed || this.axle.installed) {
      this.finishIntro();
      return;
    }
    if (this.introStart < 0) this.introStart = t;
    if (applyIntro(this.intro, t - this.introStart)) this.finishIntro();
  }

  private finishIntro(): void {
    this.introDone = true;
    finishIntroItems(this.intro);
  }
}
