// ==========================================
// 회전 놀이기구 (메리고라운드 스피너 디스크)
// 참조 이미지: 회전 놀이기구 이미지.jfif
// 워크플로우: openscad.md (이미지 → 3D 모델 → 절대좌표 STL → 웹검색 형상 검증)
// ==========================================
// 절대좌표계: Z=0 지면, 원점 = 회전 중심축, 단위 mm
// 실물 구조 (웹검색 확인): 지면 콘크리트 고정 중앙 기둥 + 대형 볼베어링 + 회전판
//
// Part Selection:
// 0 = 전체 조립품 (Full Assembly)
// 1 = 회전판 (Turntable: 판 + 베어링 지지판) — 회전부
// 2 = 핸들바 8개 (Handles) — 회전부
// 3 = 중앙 허브 캡 (Hub Cap) — 회전부
// 4 = 볼베어링 (Ball Bearing) — 핵심 기계요소
// 5 = 중앙 축 (Shaft) — 고정부
// 6 = 지면 베이스 (Base) — 고정부
selected_part = 0;

// ==========================================
// 치수 파라미터 (이미지 픽셀 비율 추정, 기준 = 판 지름 2000mm)
// ==========================================
plate_d    = 2000;  // 회전판 지름 (기준 부재)
plate_t    = 30;    // 회전판 두께
plate_z    = 200;   // 회전판 하면 높이 (상면 = 230, CPSC 지상 230mm 이하 기준)
handle_r   = 800;   // 핸들 배치 반경 (판 외곽 r1000 안쪽)
handle_h   = 650;   // 핸들 전체 높이 (판 상면 기준, 이미지 비율)
handle_w   = 300;   // 핸들 상부 바 길이
tube_r     = 14;    // 핸들 파이프 반지름 ( 외경 48mm 파이프 상당)
bend_r     = 60;    // 핸들 모서리 굽힘 반경
hub_r      = 60;    // 중앙 허브 캡 반지름 (이미지 중앙 돌출부)
hub_h      = 15;    // 중앙 허브 캡 높이
shaft_r    = 45;    // 중앙 축 반지름
base_r     = 250;   // 지면 베이스 반지름 (콘크리트 고정부)
base_h     = 120;   // 지면 베이스 높이
brg_h      = 60;    // 볼베어링 높이
brg_z      = 120;   // 볼베어링 하면 (= 베이스 상면과 접촉)
brg_ball_r = 4.5;   // 베어링 볼 반지름
brg_ball_n = 16;    // 베어링 볼 개수
supp_r     = 280;   // 베어링-판 사이 지지판 반지름
supp_t     = 20;    // 지지판 두께

$fn = 16; // 렌더링 속도 최적화 (큰 원은 모듈 안에서 $fn 상향)

// ==========================================
// Helper Modules
// ==========================================

// 베어링 링 (외경/내경/높이 관 튜브)
module bearing_ring(r_out, r_in, h) {
    difference() {
        cylinder(r=r_out, h=h, $fn=48);
        translate([0, 0, -1]) cylinder(r=r_in, h=h+2, $fn=48);
    }
}

// 역 U자 핸들 (파이프: 좌우 기둥 + 모서리 굽힘 + 상부 바)
// 로컬 좌표: 기둥 하단 z=0 (판 상면에 삽입됨), 폭 방향 X
module handle_u() {
    half_w = handle_w/2;            // 150
    post_h = handle_h - bend_r;     // 590
    // 좌우 기둥
    translate([ half_w, 0, 0]) cylinder(r=tube_r, h=post_h);
    translate([-half_w, 0, 0]) cylinder(r=tube_r, h=post_h);
    // 우측 굽힘: 중심선 (half_w,0,post_h) → (half_w-bend_r,0,handle_h)
    translate([half_w - bend_r, 0, post_h])
        rotate([90, 0, 0])
            rotate_extrude(angle=90) translate([bend_r, 0]) circle(r=tube_r);
    // 좌측 굽힘: 중심선 (-half_w,0,post_h) → (-(half_w-bend_r),0,handle_h)
    translate([-(half_w - bend_r), 0, post_h])
        rotate([0, 0, 180]) rotate([90, 0, 0])
            rotate_extrude(angle=90) translate([bend_r, 0]) circle(r=tube_r);
    // 상부 바 (굽힘 끝단 ±(half_w-bend_r) 사이 연결)
    translate([0, 0, handle_h])
        rotate([0, 90, 0])
            cylinder(r=tube_r, h=2*(half_w - bend_r), center=true);
}

// ==========================================
// Main Part Modules — 전부 조립 위치(절대좌표)에 제자리 배치
// ==========================================

// 1. 회전판 + 베어링 지지판 (회전부)
module part_turntable() {
    color("RoyalBlue") {
        // 회전판 본체
        translate([0, 0, plate_z])
            cylinder(r=plate_d/2, h=plate_t, $fn=96);
        // 베어링 지지판: 외륜 상면(z=180)에 안착 → 판 하면(z=200)까지
        translate([0, 0, plate_z - supp_t])
            difference() {
                cylinder(r=supp_r, h=supp_t, $fn=48);
                translate([0, 0, -1]) cylinder(r=75, h=supp_t+2, $fn=48); // 외륜 통과홀
            }
    }
}

// 2. 핸들바 8개 (빨강/파랑 교차) — 판 상면에 15mm 삽입
module part_handles() {
    for (k = [0:7])
        rotate([0, 0, k*45])
            translate([handle_r, 0, plate_z + plate_t - 15])
                color(k % 2 == 0 ? "Crimson" : "DodgerBlue")
                    handle_u();
}

// 3. 중앙 허브 캡 — 판 상면 중앙에 밀착
module part_hub_cap() {
    color("MidnightBlue")
        translate([0, 0, plate_z + plate_t])
            cylinder(r=hub_r, h=hub_h, $fn=32);
}

// 4. 볼베어링 (핵심 기계요소)
//    내륜(r45-65)=축에, 외륜(r75-95)=지지판에, 볼 16개가 내·외륜 사이
module part_ball_bearing() {
    translate([0, 0, brg_z]) {
        color("Silver") bearing_ring(65, shaft_r, brg_h);  // 내륜 (ID = 축 r45 접촉)
        color("Silver") bearing_ring(95, 75, brg_h);       // 외륜 (상면 = 지지판 접촉)
        color("Gold")
            for (i = [0:brg_ball_n-1])
                rotate([0, 0, i * 360/brg_ball_n])
                    translate([70, 0, brg_h/2])
                        sphere(r=brg_ball_r);
    }
}

// 5. 중앙 축 (고정부) — 베이스 관통, 내륜 접촉, 판 안까지
module part_shaft() {
    color("Gray")
        cylinder(r=shaft_r, h=plate_z + plate_t - 2, $fn=32); // z=0 → 228
}

// 6. 지면 베이스 (고정부) — 상면(z=120)에 베어링 안착
module part_base() {
    color("DimGray")
        cylinder(r=base_r, h=base_h, $fn=48);
}

// ==========================================
// Assembly Display Logic
// ==========================================
if (selected_part == 0) {
    part_base();
    part_shaft();
    part_ball_bearing();
    part_turntable();
    part_hub_cap();
    part_handles();
} else if (selected_part == 1) {
    part_turntable();
} else if (selected_part == 2) {
    part_handles();
} else if (selected_part == 3) {
    part_hub_cap();
} else if (selected_part == 4) {
    part_ball_bearing();
} else if (selected_part == 5) {
    part_shaft();
} else if (selected_part == 6) {
    part_base();
}
