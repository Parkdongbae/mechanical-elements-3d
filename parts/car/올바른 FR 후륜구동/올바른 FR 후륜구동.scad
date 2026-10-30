// ================================================
// 올바른 FR 후륜구동 (교육용 & 절대좌표 유지 분할 출력 모델)
// OpenSCAD Code
// 구조: 세로배치 엔진 → 변속기 → 프로펠러 샤프트 → 차동기어 → 뒤 구동축(뒷바퀴 구동)
//       앞 차축은 구동하지 않는 단순 빔 액슬 (조향 전용)
// 연결 규약: 엔진-변속기, 변속기-UJ, UJ-차동기어 핀니언, 차동기어-반축은
//            실차의 결합면처럼 1~4mm 삽입(겹침)으로 시각적·조립상 연결됨
// ================================================

$fn = 60; // 3D 프린터 출력을 위해 정밀도 향상

// ------------------------------------------------
// [출력 선택 제어 (Part Selection)]
// 0  : 전체 어셈블리 미리보기 (조립 확인용)
// 1  : 세로배치 엔진 (Longitudinal Engine)
// 2  : 변속기 (Transmission)
// 3  : 프로펠러 샤프트 (Propeller Shaft)
// 4  : 차동기어 (Differential)
// 5  : 뒤 구동축 (Rear Driveshaft)
// 6  : 앞 차축 (Front Axle)
// 7  : 앞좌측 바퀴 (Front Left Wheel)
// 8  : 앞우측 바퀴 (Front Right Wheel)
// 9  : 뒤좌측 바퀴 (Rear Left Wheel)
// 10 : 뒤우측 바퀴 (Rear Right Wheel)
// 11 : 베이스 프레임 (Car Base Frame)
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

// [1] 세로배치 엔진 — 전방 차축을 걸치고, 하부가 액슬 빔(상단 z=16) 위로 통과 (파랑)
module part_engine() {
    translate([0, 83, 25]) {
        color([0.15, 0.45, 0.85]) {
            translate([0, 0, 13])
                cube([36, 52, 24], center=true);          // 엔진 본체 (길이방향)
            translate([0, 0, -2])
                cube([32, 46, 6], center=true);           // 오일 팬(하부)
            translate([0, 0, 28])
                cube([30, 44, 5], center=true);           // 밸브 커버
            for (y = [-15, -5, 5, 15])
                translate([0, y, 32])
                    cylinder(r=4.5, h=3, center=true);    // 실린더 헤드 4기
        }
    }
}

// [2] 변속기 — 노즈가 엔진 뒷면(y=57)에 1mm 삽입되어 연결, 축 z=16 (주황)
module part_transmission() {
    translate([0, 40, 16]) {
        color([0.9, 0.4, 0.1]) {
            rotate([90, 0, 0])                            // r1이 +Y(엔진 쪽, y 22..58)
                cylinder(r1=16, r2=11, h=36, center=true); // 테이퍼 기어박스 본체
            translate([0, 8, 0])
                rotate([90, 0, 0]) cylinder(r=15.1, h=2, center=true); // 냉각 립
            translate([0, 0, 0])
                rotate([90, 0, 0]) cylinder(r=14.0, h=2, center=true); // 냉각 립
        }
    }
}

// [3] 프로펠러 샤프트 — 변속기 출력(z=16) → 차동기어(z=12)로 완만히 경사,
//     전단 UJ는 변속기 뒷면에 삽입, 후단 UJ는 핀니언 목에 접촉 (노랑)
module part_propeller_shaft() {
    translate([0, -13.5, 14]) {
        rotate([3.52, 0, 0]) {                            // 전단이 높은 완만한 경사
            color([0.95, 0.8, 0.15]) {
                rotate([90, 0, 0])
                    cylinder(r=3.5, h=66, center=true);   // 축 본체
                translate([0, 32.5, 0])
                    rotate([90, 0, 0]) cylinder(r=5.5, h=8, center=true); // 전단 UJ (변속기에 삽입)
                translate([0, -32.5, 0])
                    rotate([90, 0, 0]) cylinder(r=5.5, h=8, center=true); // 후단 UJ (핀니언 목 접촉)
            }
        }
    }
}

// [4] 차동기어 — 리어 차축 정중앙, 90도 전향 + 좌우 회전차 허용 (녹색)
module part_differential() {
    translate([0, -65, 12]) {
        color([0.2, 0.65, 0.25]) {
            sphere(r=12);                                 // 차동기어 하우징
            translate([0, 11, 0])
                rotate([90, 0, 0]) cylinder(r=4.5, h=8, center=true); // 핀니언 목 (후단 UJ에 접촉)
        }
    }
}

// [5] 뒤 구동축 — 차동기어 → 좌우 뒷바퀴 (구동됨, 녹색)
module part_rear_driveshaft() {
    translate([0, -65, 12]) {
        color([0.2, 0.65, 0.25]) {
            for (s = [-1, 1])
                translate([s*37, 0, 0])
                    rotate([0, 90, 0]) cylinder(r=3.8, h=58, center=true); // 좌우 반축 (안쪽 끝이 차동기어에 4mm 삽입)
            for (x = [-45, 45])
                translate([x, 0, 0])
                    rotate([0, 90, 0]) cylinder(r=6, h=8, center=true);    // CV 조인트
        }
    }
}

// [6] 앞 차축 — 구동하지 않는 단순 빔 액슬 (조향 전용, 다크 그레이)
module part_front_axle() {
    translate([0, 65, 12]) {
        color([0.25, 0.25, 0.28]) {
            rotate([0, 90, 0])
                cylinder(r=4, h=car_width - wheel_w*2, center=true);
        }
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

// [11] 베이스 프레임 — 반투명
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
    part_engine();
    part_transmission();
    part_propeller_shaft();
    part_differential();
    part_rear_driveshaft();
    part_front_axle();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();
    part_car_frame();

} else if (part_select == 1) {
    // [1] 세로배치 엔진 (절대위치 유지)
    part_engine();

} else if (part_select == 2) {
    // [2] 변속기 (절대위치 유지)
    part_transmission();

} else if (part_select == 3) {
    // [3] 프로펠러 샤프트 (절대위치 유지)
    part_propeller_shaft();

} else if (part_select == 4) {
    // [4] 차동기어 (절대위치 유지)
    part_differential();

} else if (part_select == 5) {
    // [5] 뒤 구동축 (절대위치 유지)
    part_rear_driveshaft();

} else if (part_select == 6) {
    // [6] 앞 차축 (절대위치 유지)
    part_front_axle();

} else if (part_select == 7) {
    // [7] 앞좌측 바퀴 (절대위치 유지)
    part_wheel_fl();

} else if (part_select == 8) {
    // [8] 앞우측 바퀴 (절대위치 유지)
    part_wheel_fr();

} else if (part_select == 9) {
    // [9] 뒤좌측 바퀴 (절대위치 유지)
    part_wheel_rl();

} else if (part_select == 10) {
    // [10] 뒤우측 바퀴 (절대위치 유지)
    part_wheel_rr();

} else if (part_select == 11) {
    // [11] 베이스 프레임 (절대위치 유지)
    part_car_frame();
}
