// ==========================================
// User Parameters & Control Variables
// ==========================================
// Part Selection:
// 0 = 전체 조립품 (Full Assembly)
// 1 = 하부 기둥 (Lower Column)
// 2 = 상부 기둥 (Upper Column)
// 3 = 수평 들보 (Horizontal Beams)
// 4 = 이음 칼라 및 연결판 (Connection Plates)
// 5 = 체결 볼트/너트 (Bolts & Nuts)
selected_part = 0; 

// 치수 설정 (단위: mm)
col_size  = 180; // 기둥 단면 (180x180)
col_wall  = 12;  // 기둥 두께
beam_h    = 160; // 들보 높이
beam_w    = 100; // 들보 폭
beam_ft   = 10;  // 들보 플랜지 두께
beam_wt   = 8;   // 들보 웹 두께
plate_t   = 10;  // 연결판 두께
collar_h  = 220; // 기둥 연결 이음 칼라 높이

$fn = 16; // 렌더링 속도 최적화

// ==========================================
// Helper Modules
// ==========================================

// 1. 사각 파이프 기둥
module shape_box_column(size, wall, len) {
    difference() {
        cube([size, size, len], center=true);
        cube([size - wall*2, size - wall*2, len + 2], center=true);
    }
}

// 2. H형강 들보
module shape_h_beam(h, w, ft, wt, len) {
    rotate([90, 0, 0])
    linear_extrude(height = len, center = true) {
        polygon(points=[
            [-w/2, -h/2], [w/2, -h/2],
            [w/2, -h/2 + ft], [wt/2, -h/2 + ft],
            [wt/2, h/2 - ft], [w/2, h/2 - ft],
            [w/2, h/2], [-w/2, h/2],
            [-w/2, h/2 - ft], [-wt/2, h/2 - ft],
            [-wt/2, -h/2 + ft], [-w/2, -h/2 + ft]
        ]);
    }
}

// 3. 부재에 완벽히 밀착되는 볼트 (Gold)
module shape_bolt_only(grip_len=20, extra=12, r=4.5) {
    color("Gold") {
        // 볼트 머리 (부재 뒷면에 안착)
        translate([0, 0, -4])
            cylinder(r=r*1.5, h=4, $fn=6);
        // 관통 및 돌출 나사산 축
        cylinder(r=r, h=grip_len + extra);
    }
}

// 4. 부재 표면에 '탁' 붙는 너트 (Silver - 독립 모듈 및 색상 구분)
module shape_nut_only(grip_len=20, r=4.5) {
    color("Silver") {
        // grip_len 위치(=부재 전면 표면)에 공백 없이 밀착
        translate([0, 0, grip_len])
            cylinder(r=r*1.6, h=5, $fn=6);
    }
}

// ==========================================
// Main Part Modules
// ==========================================

// 1. 하부 기둥
module part_lower_column() {
    color("SlateGray")
    translate([0, 0, -200])
        shape_box_column(col_size, col_wall, 400);
}

// 2. 상부 기둥
module part_upper_column() {
    color("SteelBlue")
    translate([0, 0, 200])
        shape_box_column(col_size, col_wall, 400);
}

// 3. 수평 들보 (좌/우)
module part_horizontal_beams() {
    color("DarkCyan") {
        // 우측 들보
        translate([300, 0, 0])
            rotate([0, 0, 90])
                shape_h_beam(beam_h, beam_w, beam_ft, beam_wt, 400);
        // 좌측 들보
        translate([-300, 0, 0])
            rotate([0, 0, -90])
                shape_h_beam(beam_h, beam_w, beam_ft, beam_wt, 400);
    }
}

// 4. 기둥 이음 칼라 및 들보 연결판
module part_connection_plates() {
    color("FireBrick") {
        // 수직 기둥 연결 이음 칼라
        difference() {
            cube([col_size + plate_t*2, col_size + plate_t*2, collar_h], center=true);
            cube([col_size, col_size, collar_h + 2], center=true);
        }
        // 우측 들보 연결판
        translate([150, -(beam_wt/2 + plate_t/2), 0])
            cube([120, plate_t, beam_h - 2*beam_ft], center=true);
        // 좌측 들보 연결판
        translate([-150, -(beam_wt/2 + plate_t/2), 0])
            cube([120, plate_t, beam_h - 2*beam_ft], center=true);
    }
}

// 5. 체결 볼트(Gold) 및 밀착 너트(Silver)
module part_bolts() {
    // A. 수평 들보 볼트/너트 체결부
    beam_grip = plate_t + beam_wt; // 이음판(10mm) + 들보 웹(8mm) = 18mm 관통
    
    for (z = [-40, -20, 0, 20, 40]) {
        // 우측 들보 체결부
        for (x = [120, 170]) {
            translate([x, -(beam_wt/2 + plate_t), z])
                rotate([-90, 0, 0]) {
                    shape_bolt_only(beam_grip, 12, 4);
                    shape_nut_only(beam_grip, 4); // 부재 전면 표면에 밀착
                }
        }
        // 좌측 들보 체결부
        for (x = [-120, -170]) {
            translate([x, -(beam_wt/2 + plate_t), z])
                rotate([-90, 0, 0]) {
                    shape_bolt_only(beam_grip, 12, 4);
                    shape_nut_only(beam_grip, 4); // 부재 전면 표면에 밀착
                }
        }
    }
    
    // B. 수직 기둥 볼트/너트 체결부
    col_grip = plate_t + col_wall; // 이음 칼라(10mm) + 기둥 벽(12mm) = 22mm 관통
    
    for (z = [70, -70]) {
        for (x = [-40, 40]) {
            // 전면 체결부
            translate([x, col_size/2 - col_wall, z])
                rotate([-90, 0, 0]) {
                    shape_bolt_only(col_grip, 12, 4.5);
                    shape_nut_only(col_grip, 4.5); // 이음 칼라 표면에 밀착
                }
            // 후면 체결부
            translate([x, -(col_size/2 - col_wall), z])
                rotate([90, 0, 0]) {
                    shape_bolt_only(col_grip, 12, 4.5);
                    shape_nut_only(col_grip, 4.5); // 이음 칼라 표면에 밀착
                }
        }
    }
}

// ==========================================
// Assembly Display Logic
// ==========================================
if (selected_part == 0) {
    part_lower_column();
    part_upper_column();
    part_horizontal_beams();
    part_connection_plates();
    part_bolts();
} else if (selected_part == 1) {
    part_lower_column();
} else if (selected_part == 2) {
    part_upper_column();
} else if (selected_part == 3) {
    part_horizontal_beams();
} else if (selected_part == 4) {
    part_connection_plates();
} else if (selected_part == 5) {
    part_bolts();
}