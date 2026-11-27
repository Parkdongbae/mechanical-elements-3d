// 249 관용 볼 앤드 소켓 이음 — 위 관 끝의 속 빈 공이 소켓 속에서 돌아 ±16° 꺾여도 관 속 물길이 끊기지 않는다
// 세로 단면(앞 반쪽을 잘라 낸 뒤 반쪽) — 설계표 docs/mm507-sheets/249.md
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { K249, PROFILE_BALL249, PROFILE_BOT249, PROFILE_TOP249, bolt249, guide249, halfLathe249, state249 } from '../kit/k249';
import { mesh } from '../../models/parts/geom';
import { darkSteel, paint, steel } from '../../models/materials';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K249;
const [OX, OY] = K.O;

export default function buildM249(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  // 소켓 위 반쪽 + 위 귀 둘(고정)
  const socketTop = new THREE.Group();
  socketTop.name = 'socketTop';
  socketTop.position.set(OX, OY, K.ZC);
  socketTop.add(halfLathe249(PROFILE_TOP249, 48, steel(), paint(0xc8553d)));
  // 소켓 아래 반쪽 + 아래 관 + 아래 귀 둘(고정). 아래 관을 가리킬 수 있게 회전체를 pipeDown 으로 감싼다
  const socketBottom = new THREE.Group();
  socketBottom.name = 'socketBottom';
  socketBottom.position.set(OX, OY, K.ZC);
  const pipeDown = new THREE.Group();
  pipeDown.name = 'pipeDown';
  pipeDown.add(halfLathe249(PROFILE_BOT249, 48, steel(), paint(0xd06a4a)));
  socketBottom.add(pipeDown);
  const [ex0, ex1, eh] = K.EAR;
  const earW = ex1 - ex0;
  for (const [parent, sy, cutHex] of [[socketTop, 1, 0xc8553d], [socketBottom, -1, 0xd06a4a]] as [THREE.Group, number, number][]) {
    for (const sx of [-1, 1]) {
      const side = steel();
      const ear = new THREE.Mesh(new THREE.BoxGeometry(earW, eh, 0.14), [side, side, side, side, paint(cutHex), side]);
      ear.castShadow = true;
      ear.receiveShadow = true;
      ear.position.set(sx * (ex0 + earW / 2), sy * (eh / 2), -0.07);
      parent.add(ear);
    }
  }
  g.add(socketTop, socketBottom);

  // 볼트 둘(통째)
  const boltL = bolt249();
  boltL.name = 'boltL';
  boltL.position.set(-K.BOLT_X, OY, K.ZC);
  const boltR = bolt249();
  boltR.name = 'boltR';
  boltR.position.set(K.BOLT_X, OY, K.ZC);
  g.add(boltL, boltR);

  // 공 + 위 관(z 축으로만 돎). 이름표가 가리킬 수 있게 pipeUp ⊃ ball ⊃ 회전체로 겹쳐 둔다
  const ballPipe = new THREE.Group();
  ballPipe.name = 'ballPipe';
  ballPipe.position.set(OX, OY, K.ZC);
  const pipeUp = new THREE.Group();
  pipeUp.name = 'pipeUp';
  const ball = new THREE.Group();
  ball.name = 'ball';
  ball.add(halfLathe249(PROFILE_BALL249, 48, paint(0xb9c3cf), paint(0xf2b619)));
  pipeUp.add(ball);
  const ring = halfLathe249([[0.2886, 1.37], [0.32, 1.37], [0.32, 1.43], [0.2886, 1.43]], 24, steel(), paint(0xf2b619));
  pipeUp.add(ring);
  ballPipe.add(pipeUp);
  // 안내 핀: 관 뒤 벽 속(로컬 z −0.23)에서 뒤판 홈(세계 z −0.285)까지
  const pinZ0 = -0.23;
  const pinZ1 = -0.285 - K.ZC;
  const pinGeo = new THREE.CylinderGeometry(0.015, 0.015, pinZ0 - pinZ1, 12);
  pinGeo.rotateX(Math.PI / 2);
  const guidePin = mesh(pinGeo, darkSteel());
  guidePin.name = 'guidePin';
  guidePin.position.set(0, 1.4, (pinZ0 + pinZ1) / 2);
  ballPipe.add(guidePin);
  g.add(ballPipe);

  // 각도 안내(뒤판)
  const guide = guide249();
  guide.name = 'guide';
  g.add(guide);

  // 물길 점 8개(빈 관 속, 단면 평면에서 0.08 뒤)
  const flowMat = paint(0x2468c9);
  const dots: THREE.Mesh[] = [];
  for (let k = 0; k < 8; k++) {
    const d = mesh(new THREE.SphereGeometry(0.035, 14, 10), flowMat);
    d.name = 'flow';
    dots.push(d);
    g.add(d);
  }

  // 회전 화살표: β 가 늘 때 반시계, 줄 때 시계
  const arrowCCW = rotArrow(0.25, true);
  arrowCCW.position.set(OX, OY, 0.62);
  const arrowCW = rotArrow(0.25, false);
  arrowCW.position.set(OX, OY, 0.62);
  g.add(arrowCCW, arrowCW);

  // 이름표 6개(z 0.75)
  const Z = 0.75;
  g.add(
    leaderTo(tag('위 관(꺾임)', v(-1.45, 2.85, Z)), 'pipeUp'),
    leaderTo(tag('소켓 위 반쪽', v(-1.6, 2.2, Z)), 'socketTop'),
    leaderTo(tag('소켓 아래 반쪽', v(-1.6, 1.0, Z)), 'socketBottom'),
    leaderTo(tag('공(위 관 끝)', v(1.6, 2.25, Z)), 'ball'),
    leaderTo(tag('죔 볼트', v(1.75, 0.95, Z)), 'boltR'),
    leaderTo(tag('아래 관(고정)', v(1.3, 0.5, Z)), 'pipeDown')
  );

  let st = state249(0);
  let dBeta = 0;
  const LU = 1.4;
  const LD = 1.3;
  const apply = (): void => {
    st = state249(t);
    const d = 1e-3;
    dBeta = state249(t + d).beta - state249(t - d).beta;
    ballPipe.rotation.z = st.beta;
    const sb = Math.sin(st.beta);
    const cb = Math.cos(st.beta);
    dots.forEach((dot, k) => {
      const p = (((t * 0.25 + k / 8) % 1) + 1) % 1;
      const s = p * (LU + LD);
      if (s < LU) {
        const r = LU - s;
        dot.position.set(OX - r * sb, OY + r * cb, K.ZC - 0.08);
      } else dot.position.set(OX, OY - (s - LU), K.ZC - 0.08);
    });
    arrowCCW.visible = dBeta > 1e-6;
    arrowCW.visible = dBeta < -1e-6;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.3, 1.9, 6.9], target: [0.0, 1.7, 0.2] },
    notes: () => [
      { label: '꺾인 각', value: ((st.beta * 180) / Math.PI).toFixed(1) + '°' },
      { label: '관 바깥–소켓 구멍 틈', value: '≥ 0.077 (±16°)' },
      { label: '물길', value: '공 아래 구멍이 아래 관 구멍을 늘 덮음 — 끊기지 않음' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      apply();
    }
  };
}
