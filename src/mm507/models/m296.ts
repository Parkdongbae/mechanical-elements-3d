// 296 레버 탈진기 — 균형 바퀴의 충격 핀이 레버 끝 홈에 들어 레버를 젖히면 두 팔레트가 탈진 바퀴의 이를 번갈아 놓아 준다.
// 균형 바퀴 각만 시간표, 레버 각은 핀–홈 기하, 바퀴 각은 이끝–팔레트 접촉. 설계표 docs/mm507-sheets/296.md · 부품·계산은 kit/k296
import * as THREE from 'three';
import { type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, shaftZ, tag } from '../kit';
import { D2R, K296, balance296, balanceBoss296, bankPins296, escWheel296, lever296, state296 } from '../kit/k296';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const K = K296;

export default function buildM296(): MovementModel {
  const g = new THREE.Group();
  g.add(displayStand());
  const [wx, wy] = K.W;
  const [bx, by] = K.B;
  const [dx, dy] = K.D;

  const wheel = escWheel296();
  wheel.position.set(wx, wy, 0);
  const lever = lever296();
  lever.position.set(bx, by, 0);
  const balance = balance296();
  balance.position.set(dx, dy, 0);
  g.add(shaftZ(wx, wy, 0.13, 0.04), shaftZ(bx, by, 0.12, 0.035), balanceBoss296(), bankPins296(), wheel, lever, balance);

  const arrow = rotArrow(0.22, false);
  arrow.position.set(1.05, 1.85, 0.12);
  g.add(arrow);

  g.add(
    leaderTo(tag('A 탈진 바퀴', v(-1.45, 0.55, 0.3)), 'escapeWheel'),
    leaderTo(tag('B 팔레트', v(1.75, 1.55, 0.3)), 'palletExit'),
    leaderTo(tag('C 레버', v(1.35, 2.95, 0.3)), 'leverTail'),
    leaderTo(tag('D 원판', v(-1.5, 1.35, 0.3)), 'rollerDisk'),
    leaderTo(tag('E 홈', v(-1.6, 2.95, 0.3)), 'leverFork'),
    leaderTo(tag('균형 바퀴', v(-0.2, 2.95, 0.3)), 'balanceWheel')
  );

  const wheelMat = wheel.userData.wheelMat as THREE.MeshStandardMaterial;
  const mE = lever.userData.matEntry as THREE.MeshPhysicalMaterial;
  const mX = lever.userData.matExit as THREE.MeshPhysicalMaterial;
  const pinMat = balance.userData.pinMat as THREE.MeshStandardMaterial;

  let t = 0;
  let st = state296(0);
  const place = (): void => {
    st = state296(t);
    balance.rotation.z = st.beta * D2R;
    lever.rotation.z = st.lam * D2R;
    wheel.rotation.z = st.phi * D2R;
    mE.emissive.setHex(st.holder === 'entry' ? 0x661010 : 0x000000);
    mX.emissive.setHex(st.holder === 'exit' ? 0x661010 : 0x000000);
    wheelMat.emissive.setHex(st.justDropped ? 0x553300 : 0x000000);
    pinMat.emissive.setHex(st.engaged ? 0x664400 : 0x000000);
  };
  place();

  return {
    group: g,
    view: { pos: [0, 1.45, 5.6], target: [0, 1.45, 0] },
    notes: () => [
      { label: '균형 바퀴 각', value: st.beta.toFixed(0) + '°' },
      { label: '레버 각', value: st.lam.toFixed(2) + '°' },
      { label: '바퀴 각', value: st.phi.toFixed(1) + '°' },
      { label: '걸린 팔레트', value: st.holder === 'entry' ? '왼쪽(입구)' : '오른쪽(출구)' },
      { label: '핀', value: st.engaged ? '홈 안 — 레버를 젖힘' : '홈 밖 — 레버는 멈춤 핀에' },
      { label: '원리', value: '균형 바퀴가 220° 까지 도는 동안 핀은 가운데 ±73° 에서만 홈에 들어 레버를 6.3° 젖힌다 — 그 밖에서는 레버와 바퀴가 멈춰 있어 균형 바퀴가 자유롭게 흔들린다' },
      { label: '나아감', value: '한 번 오갈 때 바퀴는 이 하나(18°)씩 나아간다' }
    ],
    update(dt: number, speed: number): void {
      t += dt * speed;
      place();
    }
  };
}
