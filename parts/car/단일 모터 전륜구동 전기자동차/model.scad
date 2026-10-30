// 단일 모터 전륜구동 전기자동차(모터 1개) 이미지 기반 절차 모델 (수정본)
// 규약: Z-up, mm, 절대 좌표(조립 좌표계) — 모든 부품 모듈은 최종 조립 위치에 배치
// 구조: 바퀴 4개(X=±88, Y=±116, 지면 접촉 z0..60), 전륜구동 — 모터 1개는 앞차축(Y=+116) 허브 높이 z30에 배치,
//       뒷차축(Y=-116)은 구동 없는 고정 축 z30, 새시 데크 z36..48,
//       배터리 및 차실을 앞/뒤 차축 사이(Y=-85..+55)에 안착시켜 차축 위로 침범하지 않도록 조정,
//       모터, 전동축, 차축, 바퀴 간격(Cutout)을 difference()로 제어하여 새시 간섭 방지.
// @parts: chassis,motor,battery,front_axle,rear_axle,wheel_fl,wheel_fr,wheel_rl,wheel_rr
// @connections: chassis+motor, chassis+battery, motor+front_axle, front_axle+wheel_fl, front_axle+wheel_fr, rear_axle+wheel_rl, rear_axle+wheel_rr
PART = -1; // -1=전체, 0..8=개별 부품 (MCP 전용)

// ---------- 공용 헬퍼 ----------
module rbox(w, l, r, h) { // XY 중심 정렬, z=0..h, 둥근 모서리 박스
  linear_extrude(height = h) offset(r = r) square([w - 2*r, l - 2*r], center = true);
}
module xshaft(d, h) { rotate([0, 90, 0]) cylinder(d = d, h = h, center = true); } // X축 방향 실린더

// ---------- 0. chassis : 새시(하강 데크 + 컴팩트 차실 + 전방 후드 + 부품 간섭 제거 컷아웃) ----------
module part_chassis() {
  difference() {
    // 1) 새시 외형 본체 (바닥 데크 z36..48, 상부 차실 z48..70)
    union() {
      translate([0, 0, 36]) rbox(160, 380, 25, 12);   // 바닥 데크 z36..48 (Y -190..190)
      translate([0, -15, 48]) rbox(140, 150, 30, 22); // 상부 차실 z48..70 (Y -90..+60, 차축 사이 범위 내)
      translate([0, 0, 36]) rotate([90, 0, 90])
        linear_extrude(height = 150, center = true)
        polygon(points = [[60, 0], [180, 0], [60, 12]]); // 전방 후드 웨지
    }

    // 2) 부품 간섭 제거 컷아웃
    translate([0, 116, 30]) xshaft(50, 70);   // 모터 안착 공간
    translate([0, 116, 30]) xshaft(16, 180);  // 전동축(앞차축) 통로
    translate([0, -116, 30]) xshaft(16, 180); // 차축(뒷차축) 통로

    // 4개 바퀴 Clearance
    translate([-88,  116, 30]) xshaft(66, 26);
    translate([ 88,  116, 30]) xshaft(66, 26);
    translate([-88, -116, 30]) xshaft(66, 26);
    translate([ 88, -116, 30]) xshaft(66, 26);
  }
}

// ---------- 1. 모터 1개 (파란 실린더 + 냉각핀 + 엔드캡, 축 X방향, 앞차축 위 z10..50) ----------
module motor_block() {
  xshaft(40, 60);                                                // 본체 X -30..30
  for (x = [-24 : 4 : 24]) translate([x, 0, 0]) xshaft(44, 2.5); // 냉각 핀 13개
  translate([-31, 0, 0]) xshaft(32, 4);                          // 엔드캡 L
  translate([31, 0, 0]) xshaft(32, 4);                           // 엔드캡 R
}
module part_motor() translate([0, 116, 30]) motor_block();       // 전륜구동: 앞차축 중심

// ---------- 2. battery : 배터리 팩(차축 사이 중앙 데크 위 z48..65) ----------
module part_battery() {
  translate([0, -15, 48]) rbox(95, 140, 10, 14); // 본체 — 앞/뒤 차축 사이 (Y -85..+55)
  translate([0, -15, 62]) rbox(75, 110, 8, 3);    // 라벨/상부 판
}

// ---------- 3/4. 차축 (앞=구동축 z30, 뒤=고정축 z30, X -88..88) ----------
module part_front_axle() translate([0,  116, 30]) xshaft(8, 176); // 구동축(모터와 함께 회전)
module part_rear_axle()  translate([0, -116, 30]) xshaft(8, 176); // 고정 축(뒷바퀴 자유 회전)

// ---------- 5..8. 바퀴 (타이어 d60 + 림 d38 + 허브 d24, 축 X방향) ----------
module wheel_block() {
  xshaft(60, 20); // 타이어
  xshaft(38, 17); // 림
  xshaft(24, 30); // 허브(차축 삽입부, 축 끝과 결합)
}
module part_wheel_fl() translate([-88,  116, 30]) wheel_block();
module part_wheel_fr() translate([ 88,  116, 30]) wheel_block();
module part_wheel_rl() translate([-88, -116, 30]) wheel_block();
module part_wheel_rr() translate([ 88, -116, 30]) wheel_block();

if (PART == -1 || PART == 0) part_chassis();
if (PART == -1 || PART == 1) part_motor();
if (PART == -1 || PART == 2) part_battery();
if (PART == -1 || PART == 3) part_front_axle();
if (PART == -1 || PART == 4) part_rear_axle();
if (PART == -1 || PART == 5) part_wheel_fl();
if (PART == -1 || PART == 6) part_wheel_fr();
if (PART == -1 || PART == 7) part_wheel_rl();
if (PART == -1 || PART == 8) part_wheel_rr();