// 083 톱니 부채꼴 두 개로 돌리기 — 같은 로커 축 B 에 고정된 앞·뒤 톱니 부채꼴 C 두 개가 면 래칫 바퀴 D 의 윗면 톱니를
// 축 앞(+z)과 뒤(−z)에서 번갈아 밀어, 막대 A 를 어느 쪽으로 흔들어도 바퀴는 한 방향(위에서 보아 반시계)으로 돈다.
// 쉬는 부채꼴은 스프링을 누르며 제 축 방향으로 들려 톱니를 넘어간다 (판화 83번, 설계표 docs/mm507-sheets/083.md).
// 절대 자세: 모든 자세는 누적 구동각 theta 의 함수 — k83State(theta).
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { bronze } from '../../models/materials';
import { circlePath, extrude, mesh, roundedRect } from '../../models/parts/geom';
import { displayStand, markPin, rotArrow, setMM, shaftZ, tag } from '../kit';
import { coilSpring } from '../kit/gear2';
import {
  crownRatchetWheel,
  eyeBar,
  footBearing,
  guidePost,
  K83,
  K83_PHI,
  K83_PP,
  k83State,
  ratchetArc,
  rockKey,
  rockLever,
  shaftY,
  type K83State
} from '../kit/k083';

const D = Math.PI / 180;
const BX = -0.55; // 로커 축 B · 바퀴 축 x
const BY = 1.78; // 로커 축 B 높이
const ZC = 0.25; // 바퀴 축 깊이
const Z_FRONT = ZC + K83.ZR; // 0.65
const Z_BACK = ZC - K83.ZR; // −0.15
const WHEEL_Y = BY - K83.RP - K83.H / 2; // 1.1375 — 톱니 뿌리 평면
const FLOOR = 0.18; // 받침 윗면
const ROD_Z = 0.75; // 막대 A 층(z 0.73 ~ 0.77)
const SLIDE_Z = 0.685; // 크로스헤드·안내 기둥 층 — 막대 바로 뒤(설계표는 0.75 로 막대와 겹쳐 있었음)
const SPRING_TOP = -K83.KEY; // 키 밑면(로커 로컬 y)
const SPRING_FREE = K83.SLOT + 0.003; // 들림 0 일 때 키 밑 → 구멍 바닥 0.073

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM083(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());

  // ── 래칫 바퀴 D(세로축, 면 래칫) + 세로축(바퀴의 자식) + 바닥 축받이 ──
  const wheel = crownRatchetWheel(0.1);
  wheel.name = 'wheelD';
  wheel.position.set(BX, WHEEL_Y, ZC);
  wheel.add(shaftY(FLOOR + 0.04 - WHEEL_Y, 0, 0.045)); // 월드 y 0.22 ~ 1.1375
  g.add(wheel);
  const foot = footBearing(0.16, 0.05);
  foot.position.set(BX, FLOOR, ZC);
  g.add(foot);

  // ── 로커 그룹: 앞·뒤 부채꼴, 사각 키, 스프링, 레버 ──
  const rock = new THREE.Group();
  rock.name = 'rock';
  rock.position.set(BX, BY, 0);
  g.add(rock);
  // 로커 축 B(뒤판 보스에서 z 0.78 까지 — 끝 너트가 레버 허브 z 0.73 을 비키게). 둥근 축이라 흔들림은 키·허브로만 보인다
  g.add(shaftZ(BX, BY, 0.78, 0.04));

  const arcFront = ratchetArc(false, true);
  arcFront.name = 'arcFront';
  arcFront.position.z = Z_FRONT;
  const arcBack = ratchetArc(true, false);
  arcBack.name = 'arcBack';
  arcBack.position.z = Z_BACK;
  rock.add(arcFront, arcBack);

  const springs: THREE.Mesh[] = [];
  for (const z of [Z_FRONT, Z_BACK]) {
    const key = rockKey(0.09);
    key.position.z = z;
    rock.add(key);
    const sp = coilSpring(0.022, 0.006, 4);
    sp.rotation.z = -Math.PI / 2; // 로컬 +x → 아래(−y)
    sp.position.set(0, SPRING_TOP, z);
    sp.scale.x = SPRING_FREE;
    rock.add(sp);
    springs.push(sp);
  }

  const lever = rockLever(K83.LEVER, 0.03);
  lever.name = 'lever';
  lever.position.z = 0.705;
  rock.add(lever);
  const pinLever = new THREE.Object3D();
  pinLever.name = 'pinLever';
  pinLever.position.set(0, K83.LEVER, ROD_Z - 0.705);
  markPin(pinLever);
  lever.add(pinLever);

  // ── 막대 A + 크로스헤드 + 안내 기둥(판화에 없음 — 막대 끝을 직선으로 받친다) ──
  const rodA = eyeBar(K83.ROD, 0.04, 0.03, 0.06);
  rodA.name = 'rodA';
  g.add(rodA);
  // 크로스헤드: 핀 구멍(반지름 0.022)이 난 블록 0.14 × 0.078 × 0.06 — 막대 A 의 오른 핀이 뒤로 들어간다
  const slideShape = roundedRect(-0.07, -0.039, 0.07, 0.039, 0.008);
  slideShape.holes.push(circlePath(0, 0, 0.022));
  const slide = mesh(extrude(slideShape, 0.06, 0.004), bronze({ roughness: 0.4 }));
  setMM(slide, { kind: 'slider' });
  slide.name = 'slide';
  g.add(slide);
  const pinSlide = new THREE.Object3D();
  pinSlide.name = 'pinSlide';
  pinSlide.position.z = ROD_Z - SLIDE_Z; // 막대 A 의 오른 핀과 같은 층
  markPin(pinSlide);
  slide.add(pinSlide);
  const guide = guidePost(BY + K83.SLIDE_Y - FLOOR, 0.5); // 안내 중심 높이 1.74
  guide.position.set(0.7125, FLOOR, SLIDE_Z);
  g.add(guide);

  // ── 표시 ──
  const arrow = rotArrow(0.28, true); // 위에서 보아 반시계
  arrow.rotation.x = -Math.PI / 2;
  arrow.position.set(BX, 0.88, ZC); // 허브 밑(y 0.9675)보다 아래 — 원판에 가리지 않게
  g.add(arrow);
  g.add(
    tag('래칫 바퀴 D(윗면 톱니 30)', v(-1.45, 0.75, 0.3)),
    tag('앞 부채꼴 C(오른쪽으로 갈 때 밂)', v(-1.5, 1.55, 0.7)),
    tag('뒤 부채꼴 C(왼쪽으로 갈 때 밂)', v(0.45, 1.3, 0.0)),
    tag('로커 축 B', v(-1.1, 1.95, 0.75)),
    tag('막대 A(왕복)', v(0.3, 2.3, 0.75))
  );

  let theta = 0;
  let st: K83State = k83State(theta);

  const apply = (): void => {
    st = k83State(theta);
    rock.rotation.z = st.phi;
    wheel.rotation.y = st.psi;
    arcFront.position.y = st.liftFront;
    arcBack.position.y = st.liftBack;
    springs[0]!.scale.x = SPRING_FREE - st.liftFront;
    springs[1]!.scale.x = SPRING_FREE - st.liftBack;
    const px = BX + st.pin[0];
    const py = BY + st.pin[1];
    const sx = BX + st.slide[0];
    const sy = BY + st.slide[1];
    rodA.position.set(px, py, ROD_Z);
    rodA.rotation.z = Math.atan2(sy - py, sx - px);
    slide.position.set(sx, sy, SLIDE_Z);
  };
  apply();

  return {
    group: g,
    view: { pos: [0.1, 2.3, 6.4], target: [-0.1, 1.3, 0.2] },
    notes: () => {
      const rest = st.driving === 'front' ? st.liftBack : st.liftFront;
      return [
        { label: '지금 미는 쪽', value: st.driving === 'front' ? '앞 부채꼴' : '뒤 부채꼴' },
        { label: '로커 각 φ', value: `${(st.phi / D).toFixed(1)}° (±${(K83_PHI / D).toFixed(1)}°)` },
        { label: '쉬는 쪽 들림', value: rest.toFixed(3) },
        { label: '바퀴가 간 톱니', value: `${(st.psi / K83_PP).toFixed(1)}개 (한 번 흔들 때 ${K83.STEP}개)` },
        { label: '방향', value: '어느 쪽으로 흔들어도 바퀴는 한 방향' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
