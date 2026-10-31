// ================================================
// 사륜구동 가솔린 자동차 (AWD — 교육용 & 절대좌표 유지 분할 출력 모델)
// 구조: 엔진 → 변속기 → 센터 디퍼렌셜 → (앞 전동축 + 프로펠러 샤프트)
//       → 뒤 차동기어 → 반축 (회전 구동) / 앞·뒤 차축은 바퀴 지지
// ================================================

$fn = 60; // 3D 프린터 출력을 위한 정밀도 설정

// ------------------------------------------------
// [출력 선택 제어 (Part Selection)]
// 0  : 전체 어셈블리 미리보기 (조립 확인용)
// 1  : 세로배치 엔진 (Longitudinal Engine)
// 2  : 변속기 (Transmission)
// 3  : 센터 디퍼렌셜 (Center Differential)
// 4  : 전동축 — 앞바퀴 구동 (Front Driveshaft)
// 5  : 프로펠러 샤프트 — 뒷바퀴 구동 (Propeller Shaft)
// 6  : 뒤 차동기어 (Rear Differential)
// 7  : 반축 (Half Shafts)
// 8  : 앞좌측 바퀴 (Front Left Wheel)
// 9  : 앞우측 바퀴 (Front Right Wheel)
// 10 : 뒤좌측 바퀴 (Rear Left Wheel)
// 11 : 뒤우측 바퀴 (Rear Right Wheel)
// ------------------------------------------------
selected_part = 4;

// ---- 기본 치수 (단위: mm) ----
car_width  = 160;   // X축 (좌우)
car_length = 260;   // Y축 (+Y = 전방)
wheel_r    = 25;
wheel_w    = 14;
shaft_z    = 12;    // 축·바퀴 공통 높이 — 축 중심 = 바퀴 중심

// ================================================
// 절대 위치(Absolute Position) 적용 개별 부품 모듈
// ================================================

// [1] 세로배치 엔진 (파랑)
module part_engine() {
    translate([0, 83, 25]) {
        color([0.15, 0.45, 0.85]) {
            translate([0, 0, 13])
                cube([36, 52, 24], center=true);          // 엔진 본체
            translate([0, 0, -2])
                cube([32, 46, 6], center=true);           // 오일 팬
            translate([0, 0, 28])
                cube([30, 44, 5], center=true);           // 밸브 커버
            for (y = [-15, -5, 5, 15])
                translate([0, y, 32])
                    cylinder(r=4.5, h=3, center=true);    // 실린더 헤드
        }
    }
}

// [2] 변속기 (주황)
module part_transmission() {
    translate([0, 40, 16]) {
        color([0.9, 0.4, 0.1]) {
            rotate([90, 0, 0])
                cylinder(r1=16, r2=11, h=36, center=true); // 변속기 본체
            translate([0, 8, 0])
                rotate([90, 0, 0]) cylinder(r=15.1, h=2, center=true);
            translate([0, 0, 0])
                rotate([90, 0, 0]) cylinder(r=14.0, h=2, center=true);
        }
    }
}

// [3] 센터 디퍼렌셜 (노랑) — 변속기 출력을 앞·뒤 구동축으로 나눈다
module part_center_diff() {
    translate([0, 14, 15]) {
        color([0.95, 0.85, 0.2]) {
            cube([22, 20, 20], center=true);              // 센터 디퍼렌셜 하우징
            translate([0, 8, 0])
                rotate([90, 0, 0]) cylinder(r=7.5, h=6, center=true); // 변속기 쪽 입력 플랜지
            translate([0, -8, 0])
                rotate([90, 0, 0]) cylinder(r=5.5, h=6, center=true); // 프로펠러 쪽 출력 플랜지
            for (x = [-8, 8])
                translate([x, 5, 8])
                    cylinder(r=2.5, h=8, center=true);    // 마운트 볼트
        }
    }
}

// [4] 전동축 — 앞바퀴 구동 (초록): 센터 디퍼렌셜 → 앞 차동기어 → 앞바퀴 좌우
module part_front_driveshaft() {
    translate([0, car_length*0.25, shaft_z]) {
        color([0.2, 0.65, 0.25]) {
            // 앞 차축 라인을 따라 바퀴를 관통하는 전동 반축
            rotate([0, 90, 0])
                cylinder(r=3.8, h=car_width, center=true);
            sphere(r=10);                                 // 앞 차동기어 하우징
            // 바퀴 허브 쪽 두꺼운 조인트
            for (x = [-(car_width/2 - wheel_w/2), (car_width/2 - wheel_w/2)]) {
                translate([x, 0, 0])
                    rotate([0, 90, 0])
                        cylinder(r=6, h=wheel_w + 2, center=true);
            }
        }
        // 센터 디퍼렌셜 → 앞 차동기어 연결 세로 축 (y 14 → 65)
       // color([0.2, 0.65, 0.25])
        //    translate([0, -25.5, 0])
         //       rotate([90, 0, 0])
            //        cylinder(r=3.8, h=51, center=true);
    }
}

// [5] 프로펠러 샤프트 — 뒷바퀴 구동 (초록): 센터 디퍼렌셜 → 뒤 차동기어
module part_propeller_shaft() {
    translate([0, -25.5, 13.5]) {
        rotate([2.2, 0, 0]) {
            color([0.2, 0.65, 0.25]) {
                rotate([90, 0, 0])
                    cylinder(r=3.5, h=80, center=true);   // 프로펠러 샤프트 본체
                translate([0, 36, 0])
                    rotate([90, 0, 0]) cylinder(r=5.5, h=8, center=true); // 전단 UJ
                translate([0, -36, 0])
                    rotate([90, 0, 0]) cylinder(r=5.5, h=8, center=true); // 후단 UJ
            }
        }
    }
}

// [6] 뒤 차동기어 하우징 중앙부 (초록)
module part_rear_differential() {
    translate([0, -65, 12]) {
        color([0.2, 0.65, 0.25]) {
            sphere(r=12);                                 // 뒤 차동기어 하우징 중앙
            translate([0, 11, 0])
                rotate([90, 0, 0]) cylinder(r=4.5, h=8, center=true); // 핀니언 입력 목
        }
    }
}

// [7] 반축 (보라): 뒤 차동기어 → 뒷바퀴 좌우 내부 구동축
module part_half_shafts() {
    translate([0, -65, 12]) {
        color([0.5, 0.1, 0.7]) {
            for (s = [-1, 1])
                translate([s * 36, 0, 0])
                    rotate([0, 90, 0]) cylinder(r=3.2, h=62, center=true); // 내부 구동 반축

            for (x = [-60, 60])
                translate([x, 0, 0]) {
                    rotate([0, 90, 0]) {
                        cylinder(r=5.5, h=8, center=true);                // CV 조인트/부츠 표현
                        translate([0, 0, 2]) cylinder(r=6, h=3, center=true);
                    }
                }
        }
    }
}

// 바퀴 기본 모듈
module raw_wheel() {
    rotate([0, 90, 0]) {
        color([0.2, 0.2, 0.2])
            cylinder(r=wheel_r, h=wheel_w, center=true);           // 타이어
        color([0.7, 0.7, 0.7])
            cylinder(r=wheel_r*0.58, h=wheel_w + 0.8, center=true); // 휠
        color([0.1, 0.1, 0.1])
            cylinder(r=4.2, h=wheel_w + 2, center=true);           // 허브
    }
}

module part_wheel_fl() { translate([-car_width/2 + wheel_w/2,  car_length*0.25, 12]) raw_wheel(); }
module part_wheel_fr() { translate([ car_width/2 - wheel_w/2,  car_length*0.25, 12]) raw_wheel(); }
module part_wheel_rl() { translate([-car_width/2 + wheel_w/2, -car_length*0.25, 12]) raw_wheel(); }
module part_wheel_rr() { translate([ car_width/2 - wheel_w/2, -car_length*0.25, 12]) raw_wheel(); }

// ================================================
// 출력 제어 스위치 (Render Router)
// ================================================

if (selected_part == 0) {
    // [0] 전체 어셈블리
    part_engine();
    part_transmission();
    part_center_diff();
    part_front_driveshaft();
    part_propeller_shaft();
    part_rear_differential();
    part_half_shafts();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();

} else if (selected_part == 1) {
    part_engine();

} else if (selected_part == 2) {
    part_transmission();

} else if (selected_part == 3) {
    part_center_diff();

} else if (selected_part == 4) {
    part_front_driveshaft();

} else if (selected_part == 5) {
    part_propeller_shaft();

} else if (selected_part == 6) {
    part_rear_differential();

} else if (selected_part == 7) {
    part_half_shafts();

} else if (selected_part == 8) {
    part_wheel_fl();

} else if (selected_part == 9) {
    part_wheel_fr();

} else if (selected_part == 10) {
    part_wheel_rl();

} else if (selected_part == 11) {
    part_wheel_rr();
}
