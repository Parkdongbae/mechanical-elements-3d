// 218 걸쇠와 홈 바퀴 — 걸쇠가 홈에 걸려 바퀴 F 를 뒤로 45°·앞으로 90° 돌리고, 캠 돌기에 들리면 평평한 면 위를 지나며 바퀴가 멈춘다 (판화 218번)
//  설계표 docs/mm507-sheets/218.md · 기계는 217 과 같은 kit/k217 의 machine217()·state217()
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { K217, machine217, state217 } from '../kit/k217';
import { paint } from '../../models/materials';
import { mesh } from '../../models/parts/geom';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM218(): MovementModel {
  const g = new THREE.Group();
  let t = 0;
  g.add(displayStand());

  const mach = machine217();
  g.add(mach.group);
  const lever = mach.group.getObjectByName('lever') as THREE.Object3D;

  // 걸쇠 상태 등: 눈 핀 앞 작은 구(걸림 초록 / 들림 주황 / 평평한 면 위 회색)
  const matHang = paint(0x22c55e);
  const matLift = paint(0xf97316);
  const matFlat = paint(0x9ca3af);
  const lamp = mesh(new THREE.SphereGeometry(0.035, 20, 14), matHang);
  lamp.name = 'catchLamp';
  lamp.position.set(K217.E[0], K217.E[1], 0.29);
  lever.add(lamp);

  g.add(
    leaderTo(tag('G 걸쇠(돌기에 들림)', v(-1.3, 3.15, 0.7)), 'catchG'),
    leaderTo(tag('F 홈 바퀴(홈 8개)', v(-1.9, 1.75, 0.7)), 'wheelF'),
    leaderTo(tag('H 롤러 축', v(0.55, 3.1, 0.7)), 'roller'),
    leaderTo(tag('A 스터드(캠 홈 속)', v(-1.6, 0.95, 0.7)), 'studA'),
    leaderTo(tag('캠 바퀴 돌기', v(1.35, 0.8, 0.7)), 'lug'),
    leaderTo(tag('평평한 면(두 홈 사이)', v(-2.0, 2.5, 0.7)), 'markFlat')
  );

  const pose = (): void => {
    const s = state217(t);
    mach.apply(s);
    lamp.material = s.kappa === 0 ? matHang : s.kappa < K217.KR - 0.01 ? matLift : matFlat;
  };
  pose();

  return {
    group: g,
    view: { pos: [-0.5, 2.45, 5.7], target: [-0.35, 2.3, 0.15] },
    notes: () => {
      const s = state217(t);
      const KR = K217.KR;
      return [
        { label: '걸쇠 G', value: s.kappa === 0 ? '홈에 걸림 — 바퀴 F 를 민다' : s.kappa < KR - 0.01 ? '돌기에 들림 — 홈에서 빠짐' : '평평한 면 위 — 운동을 안 전함' },
        { label: '롤러(바퀴 F)', value: s.phase === 'back' ? '뒤로' : s.phase === 'fwd' ? '앞으로' : '멈춤' },
        { label: '롤러 각', value: s.Phi.toFixed(1) + '°' },
        { label: '스터드 A', value: s.u < 90 ? 'e→C' : s.u < 180 ? 'C→D' : 'D→e' },
        { label: '순서', value: 'C 떨어짐 → 뒤로 45° → 앞으로 90° → e 들림 → 평평한 면 → C' }
      ];
    },
    update(dt: number, speed: number): void {
      t += speed * dt;
      pose();
    }
  };
}
