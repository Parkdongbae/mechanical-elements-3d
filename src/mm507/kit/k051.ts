// 51·52번 전용 부품 — 타원 고리(맞걸이 조인트), 스터드·구멍 클러치 원판
import * as THREE from 'three';
import { brass, bronze, darkSteel, paint, steel } from '../../models/materials';
import { lathe, mesh, rodProfile } from '../../models/parts/geom';

/** 타원 고리: 로컬 XY 평면, 긴 반축 a(X), 짧은 반축 b(Y), 관 반지름 tube. 원점 = 고리 중심 */
export function ovalRing(a: number, b: number, tube: number, opts: { driver?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const pts: THREE.Vector3[] = [];
  const n = 96;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(a * Math.cos(t), b * Math.sin(t), 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, 192, tube, 14, true);
  g.add(mesh(geo, opts.driver === true ? bronze({ roughness: 0.34 }) : brass()));
  return g;
}

export interface ClutchDiscOpts {
  /** 얼굴(+Z 면)에서 +Z 로 튀어나온 스터드 */
  studs?: { count: number; radius: number; r: number; len: number };
  /** 얼굴(+Z 면)에서 뚫린 구멍(원판을 관통) */
  holes?: { count: number; radius: number; r: number };
  hubR?: number;
  /** 허브는 −Z 쪽으로 길이 hubLen */
  hubLen?: number;
  driver?: boolean;
  /** 첫 스터드·구멍의 각(로컬 XY 평면의 +X 기준, 라디안). 기본 0 */
  phase?: number;
}

/** 클러치 원판: 로컬 Z 가 축. 원판은 z ∈ [0, thick]. 스터드·구멍은 균등 각도, 허브는 −Z. 림에 표시점 */
export function clutchDisc(R: number, thick: number, opts: ClutchDiscOpts = {}): THREE.Group {
  const g = new THREE.Group();
  const phase = opts.phase ?? 0;
  const body = opts.driver === true ? bronze({ roughness: 0.34 }) : brass();
  const shape = new THREE.Shape();
  shape.absarc(0, 0, R, 0, Math.PI * 2, false);
  const hr = opts.hubR ?? 0.1;
  const hole = new THREE.Path();
  hole.absarc(0, 0, hr * 0.5, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  if (opts.holes) {
    for (let i = 0; i < opts.holes.count; i++) {
      const an = phase + (i / opts.holes.count) * Math.PI * 2;
      const p = new THREE.Path();
      p.absarc(Math.cos(an) * opts.holes.radius, Math.sin(an) * opts.holes.radius, opts.holes.r, 0, Math.PI * 2, true);
      shape.holes.push(p);
    }
  }
  const c = Math.min(thick * 0.25, 0.02);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick - 2 * c, bevelEnabled: true, bevelThickness: c, bevelSize: c, bevelSegments: 2, curveSegments: 48
  });
  geo.translate(0, 0, c);
  g.add(mesh(geo, body));
  // 허브(−Z)
  const hubLen = opts.hubLen ?? 0.3;
  const hubGeo = lathe(rodProfile(hr, -hubLen, 0.001, 0.01, 0), 32);
  hubGeo.rotateX(Math.PI / 2);
  g.add(mesh(hubGeo, body));
  // 스터드(+Z)
  if (opts.studs) {
    const s = opts.studs;
    for (let i = 0; i < s.count; i++) {
      const an = phase + (i / s.count) * Math.PI * 2;
      const sg = lathe(rodProfile(s.r, 0, s.len, 0, s.r * 0.35), 20);
      sg.rotateX(Math.PI / 2);
      const m = mesh(sg, steel());
      m.position.set(Math.cos(an) * s.radius, Math.sin(an) * s.radius, thick - 0.001);
      g.add(m);
    }
  }
  // 림 표시점(회전이 보이게) — 첫 스터드·구멍과 90° 어긋난 자리
  const mk = mesh(new THREE.BoxGeometry(0.05, 0.05, 0.012), paint(0xf2b619));
  const ma = phase + Math.PI / 2;
  mk.position.set(Math.cos(ma) * (R - 0.06), Math.sin(ma) * (R - 0.06), thick + 0.004);
  mk.rotation.z = ma;
  g.add(mk);
  // 얼굴 쪽 동심 홈선(회전이 보이도록)
  const ringGeo = new THREE.TorusGeometry(R * 0.72, 0.006, 6, 64);
  const rm = mesh(ringGeo, darkSteel());
  rm.position.z = thick + 0.001;
  g.add(rm);
  return g;
}
