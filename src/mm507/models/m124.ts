// 124 활비비(피들 드릴) — 활을 시위 방향으로 오가면, 실패를 한 바퀴 감은 시위가 드릴 축을 정·역회전시킨다 (판화 124번)
// 판화처럼 드릴 축을 끝에서 본다(축 = Z). 모든 자세는 누적 theta 의 닫힌 식(fiddle124)에서 절대로 다시 계산한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { Rope, displayStand, rotArrow, tag, leaderTo } from '../kit';
import { K124, K124_C, bow, drillSpindle, fiddle124, fiddlePath124, poseBow124, spindleBearing } from '../kit/k122';

const DEG = Math.PI / 180;
const U: [number, number] = [Math.cos(K124.dirDeg * DEG), Math.sin(K124.dirDeg * DEG)];
const N: [number, number] = [-U[1], U[0]]; // 시위의 왼쪽 위 법선

export default function buildM124(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  let s = 0;
  let phi = 0;

  g.add(displayStand());

  const bearing = spindleBearing(K124_C[0], K124_C[1], 0.1);
  g.add(bearing);

  const spindle = drillSpindle();
  spindle.name = 'spindle';
  spindle.children[spindle.children.length - 1]!.name = 'bit124';
  spindle.position.set(K124_C[0], K124_C[1], K124.zS);
  g.add(spindle);

  const bowG = bow();
  bowG.name = 'bow';
  g.add(bowG);

  const rope = new Rope(K124.rho);
  rope.group.name = 'string';
  g.add(rope.group);

  // 회전 화살표 둘 — 번갈아 보인다(실패 앞 턱 면 위)
  const arrowCw = rotArrow(0.17, false);
  const arrowCcw = rotArrow(0.17, true);
  for (const a of [arrowCw, arrowCcw]) {
    a.position.set(K124_C[0], K124_C[1], 0.445);
    g.add(a);
  }

  const tagBow = tag('활', new THREE.Vector3());
  // 시위 이름표: 아래 가닥(활이 어디 있든 늘 0.69 이상 남는 쪽) 바로 오른쪽 아래에 고정 — 시위 직선은 제자리이므로 따라갈 필요 없다
  const tagString = leaderTo(tag('시위', new THREE.Vector3(K124.T[0] - U[0] * 0.42 - N[0] * 0.22, K124.T[1] - U[1] * 0.42 - N[1] * 0.22, 0.5)), 'string');
  const tagSpool = tag('실패', new THREE.Vector3(0.95, 1.2, 0.5));
  const tagDrill = leaderTo(tag('드릴 축과 날', new THREE.Vector3(1.3, 1.75, 0.7)), 'bit124');
  g.add(tagBow, tagString, tagSpool, tagDrill);

  function apply(): void {
    const r = fiddle124(theta);
    s = r.s;
    phi = r.phi;
    spindle.rotation.z = phi;
    poseBow124(bowG, s);
    rope.setPath(fiddlePath124(s));
    const goingUp = Math.cos(theta - 1.6) > 0;
    arrowCw.visible = goingUp;
    arrowCcw.visible = !goingUp;
    // 활 이름표는 활을 따라간다
    const d = -0.14 + s;
    tagBow.position.set(K124.T[0] + U[0] * d + N[0] * 0.7, K124.T[1] + U[1] * d + N[1] * 0.7, 0.5);
  }

  apply();

  return {
    group: g,
    view: { pos: [0, 1.75, 6.4], target: [0, 1.65, 0] },
    notes: () => {
      const deg = Math.abs(phi / DEG);
      return [
        { label: '활 위치', value: 's = ' + (s >= 0 ? '+' : '−') + Math.abs(s).toFixed(2) + ' (진폭 0.6)' },
        { label: '드릴 회전', value: (phi <= 0 ? '시계로 ' : '반시계로 ') + deg.toFixed(0) + '°' },
        { label: '시위', value: '실패를 한 바퀴(360°) 감음 — 활 0.212 움직일 때 축 1 rad' },
        { label: '방향', value: '활이 오른쪽 위로 → 시계, 왼쪽 아래로 → 반시계' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
