// ================================================
// FR 후륜구동 반축(구동축) & 차축 하우징 포함 OpenSCAD 코드
// 구조: 엔진 → 변속기 → 프로펠러 샤프트 → 차동기어 → 반축 (회전 구동) + 차축 하우징 (고정)
// ================================================

$fn = 60; // 3D 프린터 출력을 위한 정밀도 설정

// ------------------------------------------------
// [출력 선택 제어 (Part Selection)]
// 0  : 전체 어셈블리 미리보기 (조립 확인용)
// 1  : 세로배치 엔진 (Longitudinal Engine)
// 2  : 변속기 (Transmission)
// 3  : 프로펠러 샤프트 (Propeller Shaft)
// 4  : 차동기어 (Differential)
// 5  : 반축 / 구동축 (Half Shafts - Purple)
// 6  : 차축 하우징 (Axle Housing - Green)
// 7  : 앞 차축 (Front Axle)
// 8  : 앞좌측 바퀴 (Front Left Wheel)
// 9  : 앞우측 바퀴 (Front Right Wheel)
// 10 : 뒤좌측 바퀴 (Rear Left Wheel)
// 11 : 뒤우측 바퀴 (Rear Right Wheel)
// 12 : 베이스 프레임 (Car Base Frame)
// ------------------------------------------------
selected_part = 0; 

// ---- 기본 치수 (단위: mm) ----
car_width  = 160;   // X축 (좌우)
car_length = 260;   // Y축 (+Y = 전방)
wheel_r    = 25;
wheel_w    = 14;

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

// [3] 프로펠러 샤프트 (노랑)
module part_propeller_shaft() {
    translate([0, -13.5, 14]) {
        rotate([3.52, 0, 0]) {                            
            color([0.95, 0.8, 0.15]) {
                rotate([90, 0, 0])
                    cylinder(r=3.5, h=66, center=true);   // 프로펠러 샤프트 본체
                translate([0, 32.5, 0])
                    rotate([90, 0, 0]) cylinder(r=5.5, h=8, center=true); // 전단 UJ
                translate([0, -32.5, 0])
                    rotate([90, 0, 0]) cylinder(r=5.5, h=8, center=true); // 후단 UJ
            }
        }
    }
}

// [4] 차동기어 하우징 중앙부 (녹색)
module part_differential() {
    translate([0, -65, 12]) {
        color([0.2, 0.65, 0.25]) {
            sphere(r=12);                                 // 디퍼렌셜 하우징 중앙
            translate([0, 11, 0])
                rotate([90, 0, 0]) cylinder(r=4.5, h=8, center=true); // 핀니언 입력 목
        }
    }
}

// [5] 반축 / 구동축 (첫 번째 이미지의 보라색 내부 구동축 반영)
module part_half_shafts() {
    translate([0, -65, 12]) {
        color([0.5, 0.1, 0.7]) { // 보라색 (Half Shafts)
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

// [6] 차축 하우징 (첫 번째 이미지의 녹색 고정 차축 하우징)
module part_axle_housing() {
    translate([0, -65, 12]) {
        color([0.2, 0.65, 0.25, 0.8]) { // 녹색 하우징
            difference() {
                union() {
                    // 차동기어에서 양쪽 바퀴 쪽으로 뻗어나가는 외부 고정 하우징 파이프
                    for (s = [-1, 1])
                        translate([s * 30, 0, 0])
                            rotate([0, 90, 0]) cylinder(r=6.5, h=40, center=true);
                }
                // 내부 반축 통과 구멍 (중공 파이프 구조)
                rotate([0, 90, 0]) cylinder(r=4.0, h=140, center=true);
            }
        }
    }
}

// [7] 앞 차축 (조향 전용 단순 빔 액슬, 다크 그레이)
module part_front_axle() {
    translate([0, 65, 12]) {
        color([0.25, 0.25, 0.28]) {
            rotate([0, 90, 0])
                cylinder(r=4, h=car_width - wheel_w*2, center=true);
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

// [12] 베이스 프레임 (반투명)
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

if (selected_part == 0) {
    // [0] 전체 어셈블리
    part_engine();
    part_transmission();
    part_propeller_shaft();
    part_differential();
    part_half_shafts();
    part_axle_housing();
    part_front_axle();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();
    part_car_frame();

} else if (selected_part == 1) {
    part_engine();

} else if (selected_part == 2) {
    part_transmission();

} else if (selected_part == 3) {
    part_propeller_shaft();

} else if (selected_part == 4) {
    part_differential();

} else if (selected_part == 5) {
    part_half_shafts();

} else if (selected_part == 6) {
    part_axle_housing();

} else if (selected_part == 7) {
    part_front_axle();

} else if (selected_part == 8) {
    part_wheel_fl();

} else if (selected_part == 9) {
    part_wheel_fr();

} else if (selected_part == 10) {
    part_wheel_rl();

} else if (selected_part == 11) {
    part_wheel_rr();

} else if (selected_part == 12) {
    part_car_frame();
}