// 161 원심 조속기 — 세로 스핀들과 크라운 기어가 돌고, 원심력으로 두 팔이 벌어지면
//  링크가 슬라이드(슬리브)를 올려 조절 지레가 높아진다(판화 161번 · 증기 기관 조속기).
//  설계표 docs/mm507-sheets/161.md · 부품은 전부 kit/k161(이미 구현됨) — 이 파일은 배치·자세 대입만 한다.
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, leaderTo, rotArrow, tag } from '../kit';
import { bedFrame161, drive161, gov161, K161, setPose161, spin161, valveLever161 } from '../kit/k161';

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);
const DEG = 180 / Math.PI;

export default function buildM161(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;

  g.add(displayStand());

  // 고정 받침 — 뒤판에서 나온 팔 넷(아래·중간 베어링 링, 밸브 지레 collar, 구동축 링)
  g.add(bedFrame161());

  // 도는 한 몸(스핀들·크라운·머리·팔·공·링크·슬라이드·조절 지레)
  const spin = spin161();
  spin.position.set(0, 0, K161.zc);
  g.add(spin);

  // 고정 밸브 지레 — collar 위 눈으로 피벗, 스핀들은 구멍 속을 자유로 지나감
  const lever = valveLever161();
  lever.position.set(0, K161.leverY, K161.zc);
  g.add(lever);

  // 구동 피니언 + 수평 구동축 — 크라운 +X 피치점 바로 위(판화에 없는 원문대로의 보충)
  const drive = drive161();
  drive.position.set(K161.rm, K161.yp, K161.zc);
  g.add(drive);

  // 회전 방향 화살표 둘 — 스핀들(위에서 반시계, 공 스윗 아래), 구동축(+X 회전)
  const arrowSpin = rotArrow(0.2, true);
  arrowSpin.rotation.x = -Math.PI / 2;
  arrowSpin.position.set(0, 1.12, K161.zc);
  const arrowDrive = rotArrow(0.16, true);
  arrowDrive.rotation.y = Math.PI / 2;
  arrowDrive.position.set(0.85, K161.yp, K161.zc);
  g.add(arrowSpin, arrowDrive);

  // 이름표 6개 — 공·슬라이드·조절 지레 셋은 움직이는 부재를 따라간다
  const tagCrown = tag('크라운 기어(베벨)', v(-0.85, 2.75, 0.3));
  const tagDrive = tag('구동 축(피니언)', v(1.15, 2.85, 0.3));
  const tagValve = tag('밸브 지레(고정)', v(-1.05, 1.2, 0.3));
  const tagBall = tag('공', v(0, 0, 0.3));
  const tagSlide = tag('슬라이드', v(0, 0, 0.3));
  const tagAdj = tag('조절 지레', v(0, 0, 0.3));
  // 지시선 대상을 직접 정한다(자동 고르기가 크라운 대신 축받이·공 대신 팔 등을 가리켰음 — 사용자 지적)
  leaderTo(tagCrown, 'crown');
  leaderTo(tagDrive, 'pinionGear');
  leaderTo(tagBall, 'ballL');
  leaderTo(tagSlide, 'sleeve');
  leaderTo(tagAdj, 'adjLever');
  g.add(tagCrown, tagDrive, tagValve, tagBall, tagSlide, tagAdj);

  /** theta 의 닫힌 식으로 전체 자세를 다시 계산(누적 오차·역회전 없음) */
  const pose = (th: number): void => {
    const p = gov161(th);
    setPose161(spin, p);
    const pinion = drive.getObjectByName('pinion');
    if (pinion) pinion.rotation.x = p.phiP + K161.pin0;
    // 따라가는 이름표 셋(ψ = spin.rotation.y — 왼쪽 공·지레 끝의 회전된 x)
    tagBall.position.set(-p.ballR * Math.cos(p.psi) - 0.28, p.ballY + 0.15, 0.3);
    tagSlide.position.set(0.66, p.sy + 0.08, 0.3);
    tagAdj.position.set(-0.45 * Math.cos(p.psi) - 0.32, p.sy - 0.16 + 0.2, 0.3);
  };
  pose(0);

  return {
    group: g,
    view: { pos: [0.4, 1.9, 6.4], target: [0, 1.6, 0] },
    notes: () => {
      const p = gov161(theta);
      return [
        { label: '기관 속도 인자', value: `${p.w.toFixed(2)} (느림 2.5~빠름 5.5)` },
        { label: '팔 각', value: `${(p.alpha * DEG).toFixed(1)}° (24~55°)` },
        { label: '슬라이드 높이', value: `${p.sy.toFixed(3)} (행정 0.164)` },
        { label: '한 주기', value: '피니언 4바퀴 · 스핀들 2바퀴 · 속도 1왕복' }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      pose(theta);
    }
  };
}
