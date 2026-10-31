// ================================================
// 올바른 AWD 사륜구동 (듀얼 모터 전기자동차, 교육용 & 절대좌표 유지 분할 출력 모델)
// OpenSCAD Code
// 구조: 앞 모터 + 앞 구동축(전륜 구동) / 바닥 중앙 배터리 팩 / 뒤 모터 + 뒤 구동축(후륜 구동)
//       프로펠러 샤프트 없음 — 각 모터가 직접 해당 축 바퀴를 구동 (4륜 모두 구동)
// 연결 규약: 모터-구동축은 3mm, 구동축-바퀴는 4mm 삽입(겹침)으로 실차 결합면처럼 연결됨
// ================================================

$fn = 60; // 3D 프린터 출력을 위해 정밀도 향상

// ------------------------------------------------
// [출력 선택 제어 (Part Selection)]
// 0  : 전체 어셈블리 미리보기 (조립 확인용)
// 1  : 앞 모터 (Front Motor)
// 2  : 앞 구동축 (Front Driveshaft)
// 3  : 배터리 (Battery)
// 4  : 뒤 모터 (Rear Motor)
// 5  : 뒤 구동축 (Rear Driveshaft)
// 6  : 앞좌측 바퀴 (Front Left Wheel)
// 7  : 앞우측 바퀴 (Front Right Wheel)
// 8  : 뒤좌측 바퀴 (Rear Left Wheel)
// 9  : 뒤우측 바퀴 (Rear Right Wheel)
// 10 : 베이스 프레임 (Car Base Frame)
// ------------------------------------------------
part_select = 0; 

// ---- 기본 치수 (단위: mm) ----
car_width  = 160;   // X축 (좌우)
car_length = 260;   // Y축 (+Y = 전방)
wheel_r    = 25;
wheel_w    = 14;

// ================================================
// 절대 위치(Absolute Position) 적용 개별 부품 모듈
// ================================================

// 모터 단품 — 횡방향 원통형, 냉각 핀 + 양끝 출력 벨 (파랑)
module raw_motor() {
    color([0.15, 0.45, 0.85]) {
        rotate([0, 90, 0])
            cylinder(r=11, h=36, center=true);            // 모터 본체 (x -18..18)
        for (x = [-12, -4, 4, 12])
            translate([x, 0, 0])
                rotate([0, 90, 0]) cylinder(r=12, h=2, center=true); // 냉각 핀
        for (s = [-1, 1])
            translate([s*19, 0, 0])
                rotate([0, 90, 0]) cylinder(r=8, h=3, center=true);  // 출력 벨 (x 17.5..20.5)
    }
}

module part_front_motor() { translate([0,  car_length*0.25, 12]) raw_motor(); }
module part_rear_motor()  { translate([0, -car_length*0.25, 12]) raw_motor(); }

// 전동축 단품 — 모터 벨 삽입 스텁 + 샤프트 + UJ 커버, 바퀴에 4mm 삽입 (빨강)
module raw_driveshaft() {
    color([0.85, 0.15, 0.1]) {
        for (s = [-1, 1]) {
            translate([s*45.5, 0, 0])
                rotate([0, 90, 0]) cylinder(r=3.8, h=49, center=true); // 샤프트 (x 21..70)
            translate([s*18.5, 0, 0])
                rotate([0, 90, 0]) cylinder(r=5, h=7, center=true);    // 모터 결합 스텁 (x 15..22)
            translate([s*35, 0, 0])
                rotate([0, 90, 0]) cylinder(r=6, h=8, center=true);    // UJ 커버 (x 31..39)
        }
    }
}

module part_front_driveshaft() { translate([0,  car_length*0.25, 12]) raw_driveshaft(); }
module part_rear_driveshaft()  { translate([0, -car_length*0.25, 12]) raw_driveshaft(); }

// [3] 배터리 — 앞뒤 축 사이 바닥 중앙의 둥근 모서리 팩 + 단자 2개 (노랑)
module part_battery() {
    color([0.95, 0.8, 0.15]) {
        hull()
            for (x = [-24, 24], y = [-22, 22])
                translate([x, y, 6])
                    cylinder(r=6, h=8, center=true);      // 둥근 모서리 팩 (x ±30, y ±28, z 2..10)
        translate([0, 0, 11])
            cube([48, 44, 2], center=true);               // 상부 커버 플레이트 (z 10..12)
        for (y = [-10, 10])
            translate([0, y, 13])
                cylinder(r=3, h=2, center=true);          // 충전 단자 (z 12..14)
    }
}

// 바퀴 단품
module raw_wheel() {
    rotate([0, 90, 0]) {
        color([0.2, 0.2, 0.2])
            cylinder(r=wheel_r, h=wheel_w, center=true);   // 타이어
        color([0.7, 0.7, 0.7])
            cylinder(r=wheel_r*0.58, h=wheel_w + 0.8, center=true); // 휠
        color([0.1, 0.1, 0.1])
            cylinder(r=4.2, h=wheel_w + 2, center=true);   // 허브
    }
}

module part_wheel_fl() { translate([-car_width/2 + wheel_w/2,  car_length*0.25, 12]) raw_wheel(); }
module part_wheel_fr() { translate([ car_width/2 - wheel_w/2,  car_length*0.25, 12]) raw_wheel(); }
module part_wheel_rl() { translate([-car_width/2 + wheel_w/2, -car_length*0.25, 12]) raw_wheel(); }
module part_wheel_rr() { translate([ car_width/2 - wheel_w/2, -car_length*0.25, 12]) raw_wheel(); }

// [10] 베이스 프레임 — 반투명
module part_car_frame() {
    color([0.8, 0.8, 0.8, 0.3]) {
        difference() {
            translate([0, 0, -2])
                cube([car_width + 10, car_length + 20, 3], center=true);
            for (y = [car_length*0.25, -car_length*0.25])
                translate([0, y, -2])
                    cube([car_width - wheel_w*2 + 2, 12, 5], center=true);
        }
    }
}

// ================================================
// 출력 제어 스위치 (Render Router)
// ================================================

if (part_select == 0) {
    // [0] 전체 어셈블리 (모든 부품 절대위치로 합체)
    part_front_motor();
    part_front_driveshaft();
    part_battery();
    part_rear_motor();
    part_rear_driveshaft();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();
    part_car_frame();

} else if (part_select == 1) {
    // [1] 앞 모터 (절대위치 유지)
    part_front_motor();

} else if (part_select == 2) {
    // [2] 앞 구동축 (절대위치 유지)
    part_front_driveshaft();

} else if (part_select == 3) {
    // [3] 배터리 (절대위치 유지)
    part_battery();

} else if (part_select == 4) {
    // [4] 뒤 모터 (절대위치 유지)
    part_rear_motor();

} else if (part_select == 5) {
    // [5] 뒤 구동축 (절대위치 유지)
    part_rear_driveshaft();

} else if (part_select == 6) {
    // [6] 앞좌측 바퀴 (절대위치 유지)
    part_wheel_fl();

} else if (part_select == 7) {
    // [7] 앞우측 바퀴 (절대위치 유지)
    part_wheel_fr();

} else if (part_select == 8) {
    // [8] 뒤좌측 바퀴 (절대위치 유지)
    part_wheel_rl();

} else if (part_select == 9) {
    // [9] 뒤우측 바퀴 (절대위치 유지)
    part_wheel_rr();

} else if (part_select == 10) {
    // [10] 베이스 프레임 (절대위치 유지)
    part_car_frame();
}
