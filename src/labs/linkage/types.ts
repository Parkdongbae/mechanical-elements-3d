// 링크 장치 실험 공통 타입 — 기구는 "조인트를 차례로 구하는 순서(Step)"로 적는다. 런타임 import 없음.
export type Vec2 = readonly [number, number];
export type Role = 'ground' | 'input' | 'coupler' | 'output' | 'link';

export type Step =
  | { k: 'fix'; id: string; at: Vec2 }                                   // 고정 받침
  | { k: 'crank'; id: string; o: string; r: number }                     // 입력 q(rad): o + r(cos q, sin q)
  | { k: 'push'; id: string; from: Vec2; dir: Vec2 }                     // 입력 q(cm): from + q·dir (dir은 단위 벡터)
  | { k: 'free'; id: string }                                            // 입력 점 그대로(2자유도: 팬터그래프)
  | { k: 'rr'; id: string; a: string; ra: number; b: string; rb: number; side: 1 | -1 } // 원–원 교점. side=+1 은 a→b 방향의 왼쪽
  | { k: 'rp'; id: string; a: string; r: number; p: Vec2; dir: Vec2; side: 1 | -1 }     // 원–직선 교점(슬라이더). side=+1 은 dir 쪽으로 더 먼 교점
  | { k: 'rigid'; id: string; a: string; b: string; u: number; v: number };             // 같은 강체 위의 점: a + u·ê + v·n̂ (ê=(b−a)/|b−a|, n̂=ê를 반시계 90°)

export type InputSpec =
  | { kind: 'rotate'; q0: number }                                       // 한 바퀴 도는 입력(rad)
  | { kind: 'swing'; min: number; max: number; q0: number }              // 범위 안에서 왕복(rad)
  | { kind: 'slide'; min: number; max: number; q0: number }              // 범위 안에서 왕복(cm)
  | { kind: 'point'; center: string; rMin: number; rMax: number; paths: { name: string; pts: Vec2[] }[] }; // 점을 끌거나 정해진 도형을 따라감
export type InputValue = number | Vec2;

export interface Bar { a: string; b: string; role: Role; layer: number; via?: string[]; slot?: boolean }
export interface Plate { pts: readonly [string, string, string]; role: Role; layer: number } // 세 점이 한 몸인 삼각 링크
export interface Rail { at: string; p: Vec2; dir: Vec2; min: number; max: number; style: 'piston' | 'ram' | 'block'; layer: number }
export interface Decor { kind: 'wheel' | 'blade' | 'tire' | 'slotBlock' | 'floor' | 'jawPad'; a: string; b?: string; size: number; ang?: number }
export interface TracePoint { id: string; label: string }

export interface MechanismDef {
  id: string; name: string; unit: 'cm' | '단위';
  oneLine: string;          // 목록 카드 한 줄
  how: string[];            // 어떻게 움직이나 (2~3문장)
  uses: string[];           // 어디에 쓰일까? (2~3개)
  watch: string;            // 이것을 눈여겨봐요 (1문장)
  steps: Step[]; input: InputSpec; handle: string;   // handle: 손으로 끄는 조인트 id
  bars: Bar[]; plates?: Plate[]; rails?: Rail[]; decor?: Decor[];
  trace: TracePoint[];      // 첫 번째가 기본 자취
  topView?: boolean;        // 위에서 본 그림(조향)임을 화면에 표시
}

export interface Pose { ok: boolean; q: InputValue; pts: Record<string, Vec2>; failAt?: string } // ok=false: failAt 조인트를 조립할 수 없음
export interface Bounds { minX: number; maxX: number; minY: number; maxY: number }
export interface Sweep {
  poses: Pose[];            // 입력 전 구간을 고르게 나눈 표본(조립 가능한 것만)
  qs: number[];             // 각 표본의 입력값(rad 또는 cm, point 입력은 경로 진행 0~1)
  full: boolean;            // 입력 링크가 한 바퀴 다 도는가
  qMin: number; qMax: number; // 조립 가능한(또는 지정된) 입력 범위
  bounds: Bounds;           // 모든 조인트가 쓸고 지나가는 영역(자동 배율용)
}
export interface Readout { key: string; label: string; value: string; basis?: string } // basis: 계산 근거 한 줄
export type GrashofKind = 'crank-rocker' | 'double-crank' | 'double-rocker' | 'rocker-crank' | 'change-point' | 'non-grashof' | 'impossible';
export interface GrashofResult { kind: GrashofKind; s: number; l: number; p: number; q: number; label: string; note: string }
