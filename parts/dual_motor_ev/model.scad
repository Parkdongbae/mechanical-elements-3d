// dual_motor_ev — 듀얼 모터 사륜구동 전기자동차(모터 2개) 이미지 기반 절차 모델 (수정본)
// 규약: Z-up, mm, 절대 좌표(조립 좌표계) — 모든 부품 모듈은 최종 조립 위치에 배치
// 구조: 바퀴 4개(X=±88, Y=±116, 지면 접촉), 모터 2개·구동축은 허브 높이 z30,
//       낮춘 새시 데크 z32..48, 중앙 배터리(Y=0), 전·후방 관통형 모터 베이(Y=±116)
// @parts: chassis,front_motor,rear_motor,battery,front_axle,rear_axle,wheel_fl,wheel_fr,wheel_rl,wheel_rr
// @connections: chassis+front_motor, chassis+rear_motor, chassis+battery, front_motor+front_axle, rear_motor+rear_axle, front_axle+wheel_fl, front_axle+wheel_fr, rear_axle+wheel_rl, rear_axle+wheel_rr
PART = -1; // -1=전체, 0..9=개별 부품 (MCP 전용)

// ---------- 공용 헬퍼 ----------
module rbox(w, l, r, h) { // XY 중심 정렬, z=0..h, 둥근 모서리 박스
  linear_extrude(height = h) offset(r = r) square([w - 2*r, l - 2*r], center = true);
}
module xshaft(d, h) { rotate([0, 90, 0]) cylinder(d = d, h = h, center = true); } // X축 방향 실린더

// ---------- 0. chassis : 새시(낮춘 데크 + 중앙 상부 구조 + 전·후방 모터 베이 관통) ----------
module part_chassis() {
  difference() {
    union() {
      translate([0, 0, 32]) rbox(160, 400, 25, 16);  // 데크 z32..48 — 지면과 32mm 간격
      translate([0, 0, 48]) rbox(146, 120, 35, 16);  // 중앙 데크/차실 z48..64, Y -60..60 (구동부 침범 방지)
    }
    
    // 전방 모터 및 전동축 상하 관통 개구부 (Y=116, X -75..75, Y 81..151)
    translate([0, 116, 30]) cube([150, 70, 100], center = true);
    
    // 후방 모터 및 전동축 상하 관통 개구부 (Y=-116, X -75..75, Y -151..-81)
    translate([0, -116, 30]) cube([150, 70, 100], center = true);
  }
}

// ---------- 1/2. 전·후 모터 (파란 실린더 + 냉각핀 + 엔드캡, 축 X방향, z10..50) ----------
module motor_block() {
  xshaft(40, 60);                                                // 본체 X -30..30
  for (x = [-24 : 4 : 24]) translate([x, 0, 0]) xshaft(44, 2.5); // 냉각 핀 13개
  translate([-31, 0, 0]) xshaft(32, 4);                          // 엔드캡 L
  translate([31, 0, 0]) xshaft(32, 4);                           // 엔드캡 R
}
module part_front_motor() translate([0, 116, 30]) motor_block();
module part_rear_motor()  translate([0, -116, 30]) motor_block();

// ---------- 3. battery : 배터리 팩(중앙 데크 위 z48..64 + 흰 라벨판) ----------
module part_battery() {
  translate([0, 0, 48]) rbox(110, 90, 12, 16); // 본체 (차량 중앙 Y=0, Z=48..64)
  translate([0, 0, 64]) rbox(52, 32, 8, 3);    // 라벨
}

// ---------- 4/5. 구동축 (레드 샤프트, X -88..88, z=30) ----------
module part_front_axle() translate([0, 116, 30]) xshaft(8, 176);
module part_rear_axle()  translate([0, -116, 30]) xshaft(8, 176);

// ---------- 6..9. 바퀴 (타이어 d60 + 림 d38 + 허브 d24, 축 X방향) ----------
module wheel_block() {
  xshaft(60, 20); // 타이어
  xshaft(38, 17); // 림
  xshaft(24, 30); // 허브(구동축 삽입부)
}
module part_wheel_fl() translate([-88,  116, 30]) wheel_block();
module part_wheel_fr() translate([ 88,  116, 30]) wheel_block();
module part_wheel_rl() translate([-88, -116, 30]) wheel_block();
module part_wheel_rr() translate([ 88, -116, 30]) wheel_block();

if (PART == -1 || PART == 0) part_chassis();
if (PART == -1 || PART == 1) part_front_motor();
if (PART == -1 || PART == 2) part_rear_motor();
if (PART == -1 || PART == 3) part_battery();
if (PART == -1 || PART == 4) part_front_axle();
if (PART == -1 || PART == 5) part_rear_axle();
if (PART == -1 || PART == 6) part_wheel_fl();
if (PART == -1 || PART == 7) part_wheel_fr();
if (PART == -1 || PART == 8) part_wheel_rl();
if (PART == -1 || PART == 9) part_wheel_rr();