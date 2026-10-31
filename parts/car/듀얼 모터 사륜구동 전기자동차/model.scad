// 전기자동차 듀얼 모터 AWD 파워트레인 교육용 모델 (슬림 배터리 & 대형 바퀴 적용)
// 규약: Z-up, mm, 절대 좌표(조립 좌표계)

selected_part = 0;

// ---------- 공용 헬퍼 ----------
module rbox(w, l, r, h) {
  linear_extrude(height = h) offset(r = r) square([w - 2*r, l - 2*r], center = true);
}
module xshaft(d, h) { rotate([0, 90, 0]) cylinder(d = d, h = h, center = true); }
module yshaft(d, h) { rotate([90, 0, 0]) cylinder(d = d, h = h, center = true); }

// ---------- 1. motor : 모터 블록 (Z=36 중심) ----------
module motor_block() {
  yshaft(40, 60);                         // 모터 메인 실린더
  for (y = [-24 : 6 : 24]) translate([0, y, 0]) yshaft(44, 2); // 냉각핀
  translate([0, -31, 0]) yshaft(32, 4);   // 뒤쪽 엔드캡
  translate([0, 31, 0]) yshaft(10, 18);   // 전방 출력 축 (디퍼렌셜 방향)
}

// 전방 모터
module part_front_motor() translate([0, 60, 36]) motor_block();

// 후방 모터
module part_rear_motor() translate([0, -60, 36]) rotate([0, 0, 180]) motor_block();

// ---------- 2. battery : 슬림 하부 배터리 팩 (두께 대폭 축소) ----------
module part_battery() {
  // 두께를 얇게 낮추어(Z=0..10) 모터(Z=36)와 완전 이격
  translate([0, 0, 7]) rbox(100, 130, 10, 6);  // 얇은 메인 케이싱 (8mm)
  translate([0, 0, 13]) rbox(90, 120, 8, 2);    // 상부 커버 (2mm)
}

// ---------- 3. differential : 구 형태 차동기어 ----------
module differential_sphere_assembly() {
  union() {
    sphere(r = 24, $fn = 40);
    xshaft(32, 36);
  }
}

module part_front_differential() translate([0, 116, 36]) differential_sphere_assembly();
module part_rear_differential()  translate([0, -116, 36]) differential_sphere_assembly();

// ---------- 4. drive shafts : 구동 반축 ----------
module drive_shaft_pair() {
  translate([-51, 0, 0]) {
    xshaft(10, 70);
    translate([20, 0, 0]) xshaft(16, 8);
    translate([-20, 0, 0]) xshaft(16, 8);
  }
  translate([ 51, 0, 0]) {
    xshaft(10, 70);
    translate([20, 0, 0]) xshaft(16, 8);
    translate([-20, 0, 0]) xshaft(16, 8);
  }
}

module part_front_axle() translate([0, 116, 36]) drive_shaft_pair();
module part_rear_axle()  translate([0, -116, 36]) drive_shaft_pair();

// ---------- 5. wheels : 대형 바퀴 (외경 72mm로 확대) ----------
module wheel_block() {
  xshaft(72, 22); // 타이어 (외경 d=72mm, 폭 22mm)
  xshaft(46, 19); // 림 (외경 d=46mm)
  xshaft(28, 32); // 허브
}

// 바퀴 중심 높이 Z=36 (반지름 36mm이므로 바닥면 Z=0 접촉)
module part_wheel_fl() translate([-88,  116, 36]) wheel_block();
module part_wheel_fr() translate([ 88,  116, 36]) wheel_block();
module part_wheel_rl() translate([-88, -116, 36]) wheel_block();
module part_wheel_rr() translate([ 88, -116, 36]) wheel_block();

// ---------- 최종 조립 / 출력 제어 ----------
if (selected_part == 0) {
    part_front_motor();
    part_rear_motor();
    part_battery();
    part_front_differential();
    part_rear_differential();
    part_front_axle();
    part_rear_axle();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();

} else if (selected_part == 1) {
    part_front_motor();

} else if (selected_part == 2) {
    part_rear_motor();

} else if (selected_part == 3) {
    part_battery();

} else if (selected_part == 4) {
    part_front_differential();

} else if (selected_part == 5) {
    part_rear_differential();

} else if (selected_part == 6) {
    part_front_axle();

} else if (selected_part == 7) {
    part_rear_axle();

} else if (selected_part == 8) {
    part_wheel_fl();

} else if (selected_part == 9) {
    part_wheel_fr();

} else if (selected_part == 10) {
    part_wheel_rl();

} else if (selected_part == 11) {
    part_wheel_rr();
}