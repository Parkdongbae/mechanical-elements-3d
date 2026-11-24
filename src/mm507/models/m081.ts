// 081 결손 기어로 올리는 랙 막대 — 이가 일부만 있는 평기어 A 가 랙 막대 B 를 올리고, 이가 벗어나면 스프링 C 가 되돌린다 (판화 81번)
import * as THREE from 'three';
import { OMEGA, type MovementModel } from '../types';
import { displayStand, rotArrow, shaftZ, tag } from '../kit';
import { coilSpring } from '../kit/gear2';
import { guideBracket81, mutilatedGear81, rackLift81, rackRod81, ROD81 } from '../kit/k080';

const GX = 0.2;
const GY = 1.62;
const ZC = 0.12;
const RACK_X = -0.024;
const ROD_Y = 1.535;
const SPRING_Y = 1.635;
const SPRING_REST = 0.8023;
const ROD_X = -0.134;
const D2R = Math.PI / 180;

const v = (x: number, y: number, z: number): THREE.Vector3 => new THREE.Vector3(x, y, z);

export default function buildM081(): MovementModel {
  const g = new THREE.Group();
  let theta = 0;
  g.add(displayStand());

  const gear = mutilatedGear81(0.1);
  gear.name = 'gearA';
  gear.position.set(GX, GY, ZC);
  g.add(gear);
  g.add(shaftZ(GX, GY, 0.3, 0.04));

  const rod = rackRod81(0.08);
  rod.name = 'rackB';
  rod.position.set(RACK_X, ROD_Y, ZC);
  g.add(rod);

  const top = guideBracket81(ZC);
  top.name = 'guideTop';
  top.position.set(ROD_X, 2.4548, ZC);
  const bot = guideBracket81(ZC);
  bot.name = 'guideBottom';
  bot.position.set(ROD_X, 0.9577, ZC);
  g.add(top, bot);

  const spring = coilSpring(0.042, 0.008, 8);
  spring.name = 'springC';
  spring.rotation.z = Math.PI / 2;
  spring.position.set(ROD_X, SPRING_Y, ZC);
  g.add(spring);

  // 화살표의 빈 쪽(110°)을 랙 쪽(왼쪽)으로 돌리고 조금 오른쪽으로 옮겨, 호가 물림 자리·랙을 가리지 않고
  // 판화처럼 기어 오른쪽을 따라 내려가게 한다(호 전체가 기어 이끝 원 밖)
  const arr = rotArrow(0.32, false);
  arr.rotation.z = Math.PI;
  arr.position.set(GX + 0.09, GY, 0.2);
  g.add(arr);

  g.add(
    tag('결손 기어 A(이 5개)', v(1.05, 2.05, 0.3)),
    tag('랙 막대 B', v(-0.95, 1.3, 0.3)),
    tag('안내판(고정)', v(-0.95, 0.7, 0.3))
  );

  // 스프링 이름표는 막대와 함께 오르내린다
  const springTag = new THREE.Group();
  springTag.add(tag('스프링 C', v(-0.85, 2.05, 0.3)));
  g.add(springTag);

  let lift = 0;
  let thetaE = 0;
  const apply = (): void => {
    thetaE = theta;
    gear.rotation.z = -thetaE;
    lift = rackLift81(thetaE);
    rod.position.y = ROD_Y + lift;
    spring.position.y = SPRING_Y + lift;
    springTag.position.y = lift;
    spring.scale.x = SPRING_REST - lift;
  };
  apply();

  return {
    group: g,
    view: { pos: [0.4, 1.7, 6.4], target: [0.1, 1.7, 0.1] },
    notes: () => {
      const deg = (((thetaE / D2R) % 360) + 360) % 360;
      const state = lift <= 0.0005 ? '쉼' : deg < 187 ? '올림(이가 물림)' : '되돌림(스프링)';
      return [
        { label: '지금 상태', value: state },
        { label: '올라간 높이', value: `${lift.toFixed(3)} / ${ROD81.lift.toFixed(2)}` },
        { label: '스프링 길이', value: `${(SPRING_REST - lift).toFixed(2)} (0.80 → 0.20)` },
        { label: '한 왕복', value: '기어 한 바퀴에 한 번 왕복 · 이 5개 몫 0.60' },
        { label: '기어 회전수', value: (thetaE / (2 * Math.PI)).toFixed(2) }
      ];
    },
    update(dt: number, speed: number): void {
      theta += OMEGA * speed * dt;
      apply();
    }
  };
}
