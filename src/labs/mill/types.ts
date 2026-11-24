// 물레방아 실험 공통 상수·타입 — 길이 m, 질량 kg, 각도 rad, 시간 s. 런타임 import 없음.
export const G_ACC = 9.81;
export const RHO = 1000;

/** 치수(실제 m). ★ = 참고 자료의 표준형 값, 나머지는 모형 결정 */
export const MILL = {
  // 물레바퀴 (중심 x=0, y=AXIS_Y, z=0)
  wheelR: 1.65,        // ★ 지름 3.30
  wheelW: 1.0,         // ★ 폭
  blades: 32,          // ★
  bladeLen: 0.4,       // ★ 날개 길이(반지름 방향 깊이) → 칸 안쪽 반지름 1.25
  bladeTilt: 25,       // ★ 도. 반지름 방향에서 기울인 각(해석은 모형 결정)
  head: 0.2,           // ★ 물홈 끝에서 바퀴 꼭대기까지 낙차(자료 10~30 cm)
  qStd: 0.32,          // ★ 표준 유량 m³/s (320 L/s)
  qMax: 0.48,
  axisY: 1.0,          // 굴통 중심 높이(바퀴 아래쪽 0.65는 구덩이 속)
  pitDepth: 1.0,
  // 물이 실리는 구간(바퀴 꼭대기에서 잰 각)
  rMean: 1.45,         // 칸에 담긴 물의 평균 반지름
  phiIn: 10, phiOut: 150, // 도
  bucketCap: 0.0569,   // 한 칸에 담기는 최대 부피 m³ (= 1.0 × 0.4 × (2π·1.45/32) × 0.5)
  // 굴통·누름대
  shaftR: 0.2, shaftX0: -0.75, shaftX1: 3.3,
  armR: 0.6,           // 굴통 중심에서 누름대 끝까지
  armX: [1.7, 2.6] as const,          // 방아채 1·2의 x 위치
  armOffset: [0, 90] as const,        // 도. 방아채 i의 누름대 끝 각 = θ + armOffset[i], 그리고 +180°(막대가 굴통을 관통해 끝이 2개)
  // 방아채(지레)
  pivotZ: 1.3, pivotY: 0.7,           // 볼씨(받침 축)
  tailLen: 1.0,        // 받침 축 ~ 꼬리 끝(누름대가 닿는 길이 a)
  pestleArm: 1.8,      // 받침 축 ~ 공이 중심선(b)
  beamLen: 3.0,        // 꼬리 1.0 + 공이 쪽 2.0
  betaRest: -3,        // 도. 공이가 확 속 곡식 위에 얹힌 자세
  pestleLen: 0.75, pestleMass: 30, beamMass: 60,
  // 바퀴 운동 모형(5-3)
  wheelInertia: 2600,  // kg·m² (빈 바퀴 + 굴통)
  frictionT: 100,      // N·m 굴통 받침 마찰(일정)
  dragC: 1557.2,       // N·m·s 빠르기에 비례하는 저항 — 표준 유량에서 21.5회/분이 되게 맞춘 값
} as const;

export interface BeamState {
  beta: number; betaDot: number;
  engaged: boolean;          // 누름대가 누르고 있는가
  lift: number;              // 공이가 쉬는 자리에서 올라간 높이 m = pestleArm × (sin β − sin βrest)
}
export interface Strike { beam: 0 | 1; speed: number; energy: number; fallTime: number; peakLift: number; t: number }
export interface MillState {
  t: number; theta: number; omega: number;   // 굴통 각·각속도
  waterMass: number;                         // 바퀴에 실린 물 kg
  flow: number;                              // 지금 물홈으로 들어오는 유량 m³/s(수문 반영)
  beams: [BeamState, BeamState];
  strikes: [number, number];                 // 누적 찧은 횟수
  last: [Strike | null, Strike | null];      // 마지막으로 찧은 기록
}
export type DriveMode = 'water' | 'hand';    // 물로 돌리기 / 손으로 돌리기
export interface Readout { key: string; label: string; value: string; basis?: string }
export type StageId = 1 | 2 | 3 | 4 | 5;
export type ViewKey = 'all' | 'wheel' | 'cam' | 'pestle';
export type PartKey = 'chute' | 'gate' | 'wheel' | 'blade' | 'shaft' | 'post' | 'arm1' | 'arm2' | 'beam1' | 'beam2' | 'pivot1' | 'pivot2' | 'pestle1' | 'pestle2' | 'bowl1' | 'bowl2';
