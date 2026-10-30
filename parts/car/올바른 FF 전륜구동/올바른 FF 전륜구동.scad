// ================================================
// 올바른 FF 전륜구동 (교육용 & 절대좌표 유지 분할 출력 모델)
// OpenSCAD Code
// ================================================

$fn = 60; // 3D 프린터 출력을 위해 정밀도 향상

// ------------------------------------------------
// [출력 선택 제어 (Part Selection)]
// 0 : 전체 어셈블리 미리보기 (조립 확인용)
// 1 : 가로배치 엔진 (Engine)
// 2 : 트랜스액슬 변속기 (Transaxle)
// 3 : 앞 구동축 & 차동기어 (Front Driveshaft)
// 4 : 뒤 차축 (Rear Axle)
// 5 : 앞좌측 바퀴 (Front Left Wheel)
// 6 : 앞우측 바퀴 (Front Right Wheel)
// 7 : 뒤좌측 바퀴 (Rear Left Wheel)
// 8 : 뒤우측 바퀴 (Rear Right Wheel)
// 9 : 베이스 프레임 (Car Base Frame)
// ------------------------------------------------
part_select = 0; 

// ---- 기본 치수 (단위: mm) ----
car_width  = 160;
car_length = 260;
wheel_r    = 25;
wheel_w    = 14;

// ================================================
// 단품 기본 형상 (로컬 원점 기준)
// ================================================

// 바퀴 단품
module raw_wheel() {
    rotate([0, 90, 0]) {
        color([0.2, 0.2, 0.2]) 
            cylinder(r=wheel_r, h=wheel_w, center=true);
        color([0.7, 0.7, 0.7]) 
            cylinder(r=wheel_r*0.58, h=wheel_w + 0.8, center=true);
        color([0.1, 0.1, 0.1])
            cylinder(r=4.2, h=wheel_w + 2, center=true);
    }
}

// 엔진 단품
module raw_engine() {
    color([0.15, 0.45, 0.85]) {
        translate([0, 0, 10])
            cube([38, 48, 26], center=true);
        translate([0, 0, -5])
            cube([34, 44, 6], center=true);
        translate([0, 0, 25])
            cube([34, 44, 4], center=true);
        for (y = [-16, -5, 5, 16]) {
            translate([0, y, 28])
                cylinder(r=4, h=3, center=true);
        }
    }
}

// 트랜스액슬 단품
module raw_transaxle() {
    color([0.9, 0.4, 0.1]) {
        translate([0, 0, 5])
            rotate([0, 90, 0])
                cylinder(r1=18, r2=14, h=28, center=true);
    }
    color([0.2, 0.65, 0.25]) {
        translate([0, -8, -2])
            sphere(r=12);
        rotate([0, 90, 0])
            cylinder(r=4.5, h=30, center=true);
    }
}

// 앞 구동축 단품
module raw_front_driveshafts() {
    color([0.2, 0.65, 0.25]) {
        rotate([0, 90, 0])
            cylinder(r=3.8, h=car_width - wheel_w*2, center=true);
        sphere(r=11.5);
        for(x = [-45, 45]) {
            translate([x, 0, 0])
                rotate([0, 90, 0])
                    cylinder(r=6, h=8, center=true);
        }
    }
}

// 뒤 차축 단품
module raw_rear_axle() {
    color([0.15, 0.45, 0.85]) {
        rotate([0, 90, 0])
            cylinder(r=4, h=car_width - wheel_w*2, center=true);
        cube([14, 10, 10], center=true);
    }
}

// 베이스 프레임 단품
module raw_car_frame() {
    color([0.8, 0.8, 0.8, 0.3]) {
        difference() {
            translate([0, 0, -2])
                cube([car_width + 10, car_length + 20, 3], center=true);
            for(y = [car_length*0.25, -car_length*0.25]) {
                translate([0, y, -2])
                    cube([car_width - wheel_w*2 + 2, 12, 5], center=true);
            }
        }
    }
}

// ================================================
// 절대 위치(Absolute Position) 적용 개별 부품 모듈
// ================================================

module part_engine() {
    translate([-22, car_length*0.25 - 8, 24]) 
        raw_engine();
}

module part_transaxle() {
    translate([11, car_length*0.25, 22]) 
        raw_transaxle();
}

module part_front_driveshaft() {
    translate([0, car_length*0.25, 12]) 
        raw_front_driveshafts();
}

module part_rear_axle() {
    translate([0, -car_length*0.25, 12]) 
        raw_rear_axle();
}

module part_wheel_fl() {
    translate([-car_width/2 + wheel_w/2, car_length*0.25, 12]) 
        raw_wheel();
}

module part_wheel_fr() {
    translate([car_width/2 - wheel_w/2, car_length*0.25, 12]) 
        raw_wheel();
}

module part_wheel_rl() {
    translate([-car_width/2 + wheel_w/2, -car_length*0.25, 12]) 
        raw_wheel();
}

module part_wheel_rr() {
    translate([car_width/2 - wheel_w/2, -car_length*0.25, 12]) 
        raw_wheel();
}

module part_car_frame() {
    raw_car_frame();
}

// ================================================
// 출력 제어 스위치 (Render Router)
// ================================================

if (part_select == 0) {
    // [0] 전체 어셈블리 (모든 부품 절대위치로 합체)
    part_engine();
    part_transaxle();
    part_front_driveshaft();
    part_rear_axle();
    part_wheel_fl();
    part_wheel_fr();
    part_wheel_rl();
    part_wheel_rr();
    part_car_frame();

} else if (part_select == 1) {
    // [1] 엔진 (절대위치 유지)
    part_engine();

} else if (part_select == 2) {
    // [2] 트랜스액슬 (절대위치 유지)
    part_transaxle();

} else if (part_select == 3) {
    // [3] 앞 구동축 (절대위치 유지)
    part_front_driveshaft();

} else if (part_select == 4) {
    // [4] 뒤 차축 (절대위치 유지)
    part_rear_axle();

} else if (part_select == 5) {
    // [5] 앞좌측 바퀴 (절대위치 유지)
    part_wheel_fl();

} else if (part_select == 6) {
    // [6] 앞우측 바퀴 (절대위치 유지)
    part_wheel_fr();

} else if (part_select == 7) {
    // [7] 뒤좌측 바퀴 (절대위치 유지)
    part_wheel_rl();

} else if (part_select == 8) {
    // [8] 뒤우측 바퀴 (절대위치 유지)
    part_wheel_rr();

} else if (part_select == 9) {
    // [9] 베이스 프레임 (절대위치 유지)
    part_car_frame();
}