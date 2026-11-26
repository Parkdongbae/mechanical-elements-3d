// 217 하트 캠 홈 — 하트 모양 홈 캠이 돌면 홈 속 스터드 A 가 지레를 흔들어 롤러를 뒤로 45°, 앞으로 90° 돌리고 멈춘다 (판화 217번)
//  설계표 docs/mm507-sheets/217.md · 기계 전체는 kit/k217 의 machine217()·state217() (218 과 공용)
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, tag } from '../kit';
import { K217, machine217, state217 } from '../kit/k217';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM217(): MovementModel {
  const g = new THREE.Group();
  let t = 4; // 시작 위상: 캠 180° 앞(t=4 = 판화 217 자세, e 가 위)
  g.add(displayStand());

  const mach = machine217();
  g.add(mach.group);
  const cam = mach.group.getObjectByName('cam') as THREE.Object3D;

  // 앞층 부품(홈 바퀴·지레·걸쇠·받침 팔)은 반투명 — 뒤의 하트 홈 전체가 보이게
  for (const nm of ['wheelF', 'lever', 'hBracket']) {
    mach.group.getObjectByName(nm)?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.transparent = true;
      mat.opacity = 0.35;
      mat.depthWrite = false;
      m.material = mat;
      m.castShadow = false;
    });
  }

  // 판화 글자 e·C·D·B — 캠과 함께 돎, 지시선 없음(캠 로컬 z 0.3)
  cam.add(tag('e', v(0.0, 1.33, 0.3)), tag('C', v(-0.86, -0.26, 0.3)), tag('D', v(0.0, -0.12, 0.3)), tag('B', v(0.88, 0.24, 0.3)));

  g.add(
    leaderTo(tag('하트 홈 캠(시계 방향으로 돎)', v(1.75, 3.05, 0.7)), 'cam'),
    leaderTo(tag('스터드 A(홈 속, 지레 끝)', v(-1.75, 1.05, 0.7)), 'studA'),
    leaderTo(tag('캠 바퀴 돌기(걸쇠를 쳐 올림)', v(1.85, 0.75, 0.7)), 'lug'),
    leaderTo(tag('걸쇠 G', v(-1.35, 3.15, 0.7)), 'catchG'),
    leaderTo(tag('홈 바퀴 F · 롤러 축 H', v(-1.9, 2.0, 0.7)), 'wheelF')
  );

  const pose = (): void => mach.apply(state217(t));
  pose();

  return {
    group: g,
    view: { pos: [0.2, 1.8, 6.2], target: [0.05, 1.85, 0.1] },
    notes: () => {
      const s = state217(t);
      const KR = K217.KR;
      return [
        { label: '캠 각', value: s.u.toFixed(0) + '° / 360°' },
        { label: '스터드 A 구간', value: s.u < 90 ? 'e→C (걸쇠 들림, 롤러 멈춤)' : s.u < 180 ? 'C→D (롤러 뒤로)' : s.u < K217.UX ? 'D→e (롤러 앞으로)' : 'e 직전 (걸쇠 들림)' },
        { label: '롤러 각', value: s.Phi.toFixed(1) + '°' },
        { label: '한 주기', value: '뒤로 45° → 앞으로 90° → 멈춤 (뒤 1 : 앞 2, 한 주기에 앞으로 45° = 홈 한 칸)' },
        { label: '걸쇠 G', value: s.kappa === 0 ? '홈에 걸림' : s.kappa < KR - 0.01 ? '돌기에 들림' : '평평한 면 위' }
      ];
    },
    update(dt: number, speed: number): void {
      t += speed * dt;
      pose();
    }
  };
}
