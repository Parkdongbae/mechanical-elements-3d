// 전기자동차 전륜구동(FWD) 파워트레인 모델 (밀폐형 디퍼렌셜 적용)
// 규약: Z-up, mm, 절대 좌표(조립 좌표계)

// ------------------------------------------------
// [출력 선택 제어 (Part Selection)]
// 0 : 전체 어셈블리 미리보기 (조립 확인용)
// 1 : 모터 (Motor)
// 2 : 배터리 (Battery)
// 3 : 앞 차동기어 (Front Differential)
// 4 : 앞 구동축 (Front Axle / Drive Shafts)
// 5 : 뒤차축 (Rear Axle)
// 6 : 앞좌측 바퀴 (Front Left Wheel)
// 7 : 앞우측 바퀴 (Front Right Wheel)
// 8 : 뒤좌측 바퀴 (Rear Left Wheel)
// 9 : 뒤우측 바퀴 (Rear Right Wheel)
// ------------------------------------------------
selected_part = 0;

// ---------- 공용 헬퍼 ----------
module rbox(w, l, r, h) { // XY 중심 정렬, z=0..h, 둥근 모서리 박스
  linear_extrude(height = h) offset(r = r) square([w - 2*r, l - 2*r], center = true);
}
module xshaft(d, h) { rotate([0, 90, 0]) cylinder(d = d, h = h, center = true); }
module yshaft(d, h) { rotate([90, 0, 0]) cylinder(d = d, h = h, center = true); }

// ---------- 1. motor : 전기 모터 ----------
module motor_block() {
  yshaft(35, 70); // 모터 메인 실린더
  for (y = [-28 : 5 : 28]) translate([0, y, 0]) yshaft(40, 2); // 냉각핀
  translate([0, 36, 0]) yshaft(36, 4); // 엔드캡
  translate([0, -36, 0]) yshaft(12, 10); // 출력 축
}
module part_motor() translate([0, 70, 42]) motor_block();

// ---------- 2. battery : 배터리 팩 ----------
module part_battery() {
  translate([0, -20, 12]) rbox(95, 120, 10, 12);
  translate([0, -20, 24]) rbox(75, 90, 8, 3);
}

// ---------- 3. front_differential : 밀폐형 디퍼렌셜 ----------
module differential_sphere_assembly() {
  // 내부 컷아웃(창)을 제거하여 내부가 전혀 보이지 않는 구 형태 하우징
  union() {
    sphere(r = 24, $fn = 40);
    xshaft(32, 36); // 측면 구동축 결합부
  }
}

module part_front_differential() {
  // 밀폐형 구 형태 디퍼렌셜 유닛 (앞차축 Y=+116, Z=30)
  translate([0, 116, 30]) differential_sphere_assembly();
}

// ---------- 4. front_axle : 전륜 좌/우 구동 반축 ----------
module part_front_axle() {
  translate([-51, 116, 30]) {
    xshaft(10, 70);
    translate([20, 0, 0]) xshaft(16, 8); // CV Joint
    translate([-20, 0, 0]) xshaft(16, 8);
  }
  translate([ 51, 116, 30]) {
    xshaft(10, 70);
    translate([20, 0, 0]) xshaft(16, 8); // CV Joint
    translate([-20, 0, 0]) xshaft(16, 8);
  }
}

// ---------- 4. rear_axle : 뒷차축 ----------
module part_rear_axle() {
  translate([0, -116, 30]) {
    xshaft(8, 160); // 원통형 고정 차축
  }
}

// ---------- 5..8. 바퀴 ----------
module wheel_block() {
  xshaft(60, 20); // 타이어
  xshaft(38, 17); // 림
  xshaft(24, 30); // 허브
}
module part_wheel_fl() translate([-88,  116, 30]) wheel_block();
module part_wheel_fr() translate([ 88,  116, 30]) wheel_block();
module part_wheel_rl() translate([-88, -116, 30]) wheel_block();
module part_wheel_rr() translate([ 88, -116, 30]) wheel_block();

// ---------- 최종 조립 / 출력 제어 ----------
if (selected_part == 0) {
    // [0] 전체 어셈블리
    part_motor();
    part_battery();
    part_front_differential();
    part_front_axle();
    part_rear_axle();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();

} else if (selected_part == 1) {
    part_motor();

} else if (selected_part == 2) {
    part_battery();

} else if (selected_part == 3) {
    part_front_differential();

} else if (selected_part == 4) {
    part_front_axle();

} else if (selected_part == 5) {
    part_rear_axle();

} else if (selected_part == 6) {
    part_wheel_fl();

} else if (selected_part == 7) {
    part_wheel_fr();

} else if (selected_part == 8) {
    part_wheel_rl();

} else if (selected_part == 9) {
    part_wheel_rr();
}