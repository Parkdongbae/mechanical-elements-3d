// 여러 개의 원(스프로킷·체인링·변속기 풀리)을 차례로 감는 닫힌 체인 경로.
// factory의 ChainPath2D는 원 2개만 감으므로, 뒤 변속기의 S자 경로(풀리 2개)를 위해 일반화했다.
// 각 원은 감는 방향(dir: +1 반시계, -1 시계)을 가진다 — 체인은 진행 방향 기준으로 원의 바깥을 지난다.

export interface LoopCircle {
  x: number;
  y: number;
  r: number;
  z: number;
  dir: 1 | -1;
}

export interface LoopPoint {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
}

interface LineSeg {
  kind: 'line';
  s0: number;
  len: number;
  ax: number;
  ay: number;
  az: number;
  bx: number;
  by: number;
  bz: number;
}

interface ArcSeg {
  kind: 'arc';
  s0: number;
  len: number;
  c: LoopCircle;
  th0: number;
}

type Seg = LineSeg | ArcSeg;

const TAU = Math.PI * 2;
const mod = (a: number, m: number): number => ((a % m) + m) % m;

/** 원 A에서 원 B로 가는 접선: 진행 방향 각도와 양 끝점 */
function tangent(a: LoopCircle, b: LoopCircle): { ang: number; ax: number; ay: number; bx: number; by: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // 진행 방향 d의 왼쪽 법선 기준으로 원 중심의 부호 거리: 반시계면 중심이 왼쪽
  const k = b.dir * b.r - a.dir * a.r;
  const L = Math.sqrt(Math.max(1e-9, dx * dx + dy * dy - k * k));
  const ang = Math.atan2(dy, dx) - Math.atan2(k, L);
  const lx = -Math.sin(ang);
  const ly = Math.cos(ang);
  return {
    ang,
    ax: a.x - a.dir * a.r * lx,
    ay: a.y - a.dir * a.r * ly,
    bx: b.x - b.dir * b.r * lx,
    by: b.y - b.dir * b.r * ly
  };
}

export class ChainLoop {
  readonly length: number;
  private segs: Seg[] = [];
  /** 원 i의 감기 구간 시작 정보 (스프로킷 위상 맞춤용) */
  readonly arcs: { s0: number; th0: number; c: LoopCircle }[] = [];

  constructor(readonly circles: LoopCircle[]) {
    const n = circles.length;
    const tans = circles.map((c, i) => tangent(c, circles[(i + 1) % n]!));
    let s = 0;
    for (let i = 0; i < n; i++) {
      const c = circles[i]!;
      const tin = tans[(i - 1 + n) % n]!;
      const tout = tans[i]!;
      const th0 = Math.atan2(tin.by - c.y, tin.bx - c.x);
      const th1 = Math.atan2(tout.ay - c.y, tout.ax - c.x);
      const sweep = c.dir > 0 ? mod(th1 - th0, TAU) : mod(th0 - th1, TAU);
      const arcLen = sweep * c.r;
      this.segs.push({ kind: 'arc', s0: s, len: arcLen, c, th0 });
      this.arcs.push({ s0: s, th0, c });
      s += arcLen;
      const nx = circles[(i + 1) % n]!;
      const len = Math.hypot(tout.bx - tout.ax, tout.by - tout.ay);
      this.segs.push({ kind: 'line', s0: s, len, ax: tout.ax, ay: tout.ay, az: c.z, bx: tout.bx, by: tout.by, bz: nx.z });
      s += len;
    }
    this.length = s;
  }

  pointAt(sIn: number, out: LoopPoint): LoopPoint {
    const s = mod(sIn, this.length);
    let seg = this.segs[this.segs.length - 1]!;
    for (const g of this.segs) {
      if (s < g.s0 + g.len) {
        seg = g;
        break;
      }
    }
    const u = s - seg.s0;
    if (seg.kind === 'line') {
      const k = seg.len > 0 ? u / seg.len : 0;
      out.x = seg.ax + (seg.bx - seg.ax) * k;
      out.y = seg.ay + (seg.by - seg.ay) * k;
      out.z = seg.az + (seg.bz - seg.az) * k;
      const L = Math.max(1e-9, Math.hypot(seg.bx - seg.ax, seg.by - seg.ay, seg.bz - seg.az));
      out.tx = (seg.bx - seg.ax) / L;
      out.ty = (seg.by - seg.ay) / L;
      out.tz = (seg.bz - seg.az) / L;
    } else {
      const c = seg.c;
      const th = seg.th0 + (c.dir * u) / c.r;
      out.x = c.x + c.r * Math.cos(th);
      out.y = c.y + c.r * Math.sin(th);
      out.z = c.z;
      out.tx = -c.dir * Math.sin(th);
      out.ty = c.dir * Math.cos(th);
      out.tz = 0;
    }
    return out;
  }

  /**
   * 원 i 위의 롤러가 이골에 앉도록 하는 스프로킷 회전각(mod 이 간격).
   * 롤러(링크 이음매)는 경로 위치 offset + (j + ½)·pitch 에 있다.
   */
  seatAngle(i: number, offset: number, pitch: number): number {
    const a = this.arcs[i]!;
    const sJoint = offset + pitch * 0.5;
    // 감기 구간 시작 이후 첫 이음매까지의 거리
    const du = mod(sJoint - a.s0, pitch);
    return a.th0 + (a.c.dir * du) / a.c.r;
  }
}

/** 잇수 N, 피치 p의 스프로킷을 체인이 감을 때 쓰는 유효 반지름 — 호 길이 1피치 = 이 1개 간격 */
export function effRadius(teeth: number, pitch: number): number {
  return (teeth * pitch) / TAU;
}

/** current를 target과 같은 위상(mod step)의 가장 가까운 값 쪽으로 최대 maxStep만큼 옮긴다 */
export function approachPhase(current: number, target: number, step: number, maxStep: number): number {
  let d = target - current;
  d -= step * Math.round(d / step);
  if (Math.abs(d) > maxStep) d = Math.sign(d) * maxStep;
  return current + d;
}
