#!/usr/bin/env node
// ============================================================
// image-to-stl MCP 서버 (stdio, 의존성 없음)
//
// openscad.md 워크플로우(이미지 → OpenSCAD → 절대좌표 STL →
// 웹검색 형상 검증)의 기계적 단계를 자동화한다.
//  - find_openscad : OpenSCAD 실행파일 확인
//  - export_stls   : selected_part 별 STL 일괄 export
//  - render_preview: 검증용 PNG 렌더링
//  - render_cutaway: 중앙 연결부 단면(컷어웨이) 렌더링
//  - check_stl     : 절대좌표 bbox 검증 (메쉬 품질 검사가 아님)
// ============================================================
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OPENSCAD_CANDIDATES = [
  process.env.OPENSCAD_PATH,
  "openscad",
  "C:\\Program Files\\OpenSCAD\\openscad.exe",
  "C:\\Program Files (x86)\\OpenSCAD\\openscad.exe",
].filter(Boolean);

function log(msg) { process.stderr.write(`[image-to-stl] ${msg}\n`); }

function findOpenscad() {
  for (const c of OPENSCAD_CANDIDATES) {
    try {
      fs.accessSync(c, fs.constants.X_OK);
      return c;
    } catch { /* try next */ }
  }
  return null;
}

function runOpenscad(args, timeoutMs) {
  return new Promise((resolve) => {
    const exe = findOpenscad();
    if (!exe) {
      resolve({ ok: false, code: -1, stderr: "OpenSCAD 실행파일을 찾을 수 없습니다. OPENSCAD_PATH 환경변수로 지정하세요.", stdout: "" });
      return;
    }
    const child = spawn(exe, args, { windowsHide: true });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => { child.killed = true; child.kill(); }, timeoutMs);
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, code: -1, stderr: String(e), stdout });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: !child.killed && code === 0, killed: !!child.killed, code, stderr, stdout });
    });
  });
}

function excerpt(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  const problems = lines.filter((l) => /ERROR|WARNING/i.test(l)).slice(0, 15);
  const src = problems.length ? problems : lines.slice(-10);
  return src.join("\n").slice(0, 4000) || "(출력 없음)";
}

function fail(text) { return { content: [{ type: "text", text }], isError: true }; }
function ok(text) { return { content: [{ type: "text", text }] }; }

function str(...parts) { return parts.join("\n"); }

// ---------- 툴 구현 ----------

const TOOLS = [
  {
    name: "find_openscad",
    description: "OpenSCAD 실행파일 경로와 버전을 확인한다. 다른 툴이 실패할 때 먼저 실행해 원인을 진단한다.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    async run() {
      const exe = findOpenscad();
      if (!exe) return fail("OpenSCAD를 찾지 못했습니다. OPENSCAD_PATH 환경변수에 openscad.exe 전체 경로를 지정하거나 OpenSCAD를 설치하세요.");
      const r = await runOpenscad(["--version"], 30000);
      return ok(str(`실행파일: ${exe}`, `버전: ${(r.stdout || r.stderr || "").trim()}`));
    },
  },
  {
    name: "export_stls",
    description: "OpenSCAD .scad 파일에서 selected_part 값별로 STL을 일괄 export한다. openscad.md 워크플로우의 3단계(부품별 절대좌표 STL 저장) 전용. 파일명은 부품 모듈과 대응되게 지을 것.",
    inputSchema: {
      type: "object",
      required: ["scad_path", "exports"],
      properties: {
        scad_path: { type: "string", description: ".scad 파일 절체 경로" },
        exports: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["file", "selected_part"],
            properties: {
              file: { type: "string", description: "출력 STL 파일명 (예: lower_column.stl). out_dir 하위에 저장" },
              selected_part: { type: "number", description: "scad의 selected_part 값 (0=전체 조립품 관례)" },
            },
            additionalProperties: false,
          },
        },
        out_dir: { type: "string", description: "출력 폴더. 생략 시 scad와 같은 폴더" },
        timeout_ms: { type: "number", description: "부품 1개당 타임아웃 ms (기본 180000)" },
      },
      additionalProperties: false,
    },
    async run(a) {
      const scad = path.resolve(a.scad_path);
      if (!fs.existsSync(scad)) return fail(`scad 파일이 없습니다: ${scad}`);
      const outDir = path.resolve(a.out_dir || path.dirname(scad));
      fs.mkdirSync(outDir, { recursive: true });
      const timeout = a.timeout_ms || 180000;
      const results = [];
      for (const ex of a.exports) {
        const out = path.join(outDir, ex.file);
        const r = await runOpenscad(["-o", out, "-D", `selected_part=${ex.selected_part}`, scad, "--export-format", "binstl"], timeout);
        const exists = fs.existsSync(out) && fs.statSync(out).size > 0;
        if (r.ok && exists) {
          results.push(`OK   ${ex.file} (${(fs.statSync(out).size / 1024).toFixed(0)} KB, selected_part=${ex.selected_part})`);
        } else {
          results.push(`FAIL ${ex.file} (selected_part=${ex.selected_part})${r.killed ? " — 타임아웃" : ""}\n${excerpt(r.stderr)}`);
        }
      }
      const failed = results.filter((l) => l.startsWith("FAIL")).length;
      return ok(str(`out_dir: ${outDir}`, `성공 ${results.length - failed}/${results.length}`, "", ...results));
    },
  },
  {
    name: "render_preview",
    description: "scad 파일(또는 selected_part 단품)을 PNG로 렌더링한다. openscad.md 워크플로우 4단계 — 원본 이미지와 비교할 검증 스크린샷 생성용. 카메라는 center/rot/dist 7값 김볼 방식.",
    inputSchema: {
      type: "object",
      required: ["scad_path", "out_png"],
      properties: {
        scad_path: { type: "string" },
        out_png: { type: "string" },
        selected_part: { type: "number", description: "지정 시 해당 부품만 렌더링" },
        camera: {
          type: "object",
          description: "생략 시 autocenter+viewall로 전체 자동 프레이밍",
          properties: {
            center: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 },
            rot: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3, description: "[rx,ry,rz]. rx=60≈30도 앙각, rz로 수평 회전" },
            dist: { type: "number" },
          },
          additionalProperties: false,
        },
        viewall: { type: "boolean", description: "전체가 들어오도록 거리 자동 조정 (기본 false, 카메라 생략 시 true)" },
        imgsize: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2, description: "기본 [1200,900]" },
        timeout_ms: { type: "number" },
      },
      additionalProperties: false,
    },
    async run(a) {
      return renderScad({
        scadPath: a.scad_path,
        outPng: a.out_png,
        selectedPart: a.selected_part,
        camera: a.camera,
        viewall: a.viewall,
        imgsize: a.imgsize || [1200, 900],
        timeout: a.timeout_ms || 180000,
      });
    },
  },
  {
    name: "render_cutaway",
    description: "scad를 반평면으로 잘라 단면(컷어웨이) PNG를 렌더링한다. openscad.md 검증 항목 1(연결성) 확인 전용 — 조립 위치에서 부품 간 접촉(틈/침투)을 단면으로 본다. modules에는 절대좌표 부품 모듈명을 나열한다.",
    inputSchema: {
      type: "object",
      required: ["scad_path", "out_png", "modules"],
      properties: {
        scad_path: { type: "string" },
        out_png: { type: "string" },
        modules: { type: "array", items: { type: "string" }, minItems: 1, description: "단면에 포함할 부품 모듈명 (예: [\"part_base\",\"part_shaft\"])" },
        clip: {
          type: "object",
          description: "절단 평면. 기본: y축 음의 쪽 절반 유지(y=0에서 절단)",
          properties: {
            axis: { type: "string", enum: ["x", "y", "z"] },
            keep: { type: "string", enum: ["negative", "positive"] },
            at: { type: "number", description: "절단 좌표 (기본 0)" },
          },
          additionalProperties: false,
        },
        suppress_selected_part: { type: "number", description: "원본 display logic을 무효화할 selected_part 값 (기본 9999 — openscad.md 관례 파일은 어느 분기도 걸리지 않음)" },
        camera: { type: "object", properties: { center: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 }, rot: { type: "array", items: { type: "number" }, minItems: 3, maxItems: 3 }, dist: { type: "number" } }, additionalProperties: false },
        viewall: { type: "boolean" },
        imgsize: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
        timeout_ms: { type: "number" },
      },
      additionalProperties: false,
    },
    async run(a) {
      const scad = path.resolve(a.scad_path);
      if (!fs.existsSync(scad)) return fail(`scad 파일이 없습니다: ${scad}`);
      const src = fs.readFileSync(scad, "utf8");
      const clip = a.clip || { axis: "y", keep: "negative", at: 0 };
      const BIG = 1e5;
      const at = clip.at ?? 0;
      const axisIdx = { x: 0, y: 1, z: 2 }[clip.axis || "y"];
      const t = [0, 0, 0]; const size = [2 * BIG, 2 * BIG, 2 * BIG];
      if ((clip.keep || "negative") === "negative") { t[axisIdx] = at - BIG; size[axisIdx] = BIG; }
      else { t[axisIdx] = at; size[axisIdx] = BIG; }
      const calls = a.modules.map((m) => `        ${m}();`).join("\n");
      const appended = `\n// --- cutaway (image-to-stl mcp) ---\nintersection() {\n    union() {\n${calls}\n    }\n    translate([${t.join(", ")}]) cube([${size.join(", ")}]);\n}\n`;
      const tmpScad = path.join(path.dirname(scad), `__cut_${crypto.randomBytes(4).toString("hex")}.scad`);
      fs.writeFileSync(tmpScad, src + appended, "utf8"); // UTF-8 무BOM — 한글 주석 깨짐 방지
      try {
        return await renderScad({
          scadPath: tmpScad,
          outPng: a.out_png,
          selectedPart: a.suppress_selected_part ?? 9999,
          camera: a.camera,
          viewall: a.viewall,
          imgsize: a.imgsize || [1200, 900],
          timeout: a.timeout_ms || 180000,
        });
      } finally {
        try { fs.unlinkSync(tmpScad); } catch { /* 정리 실패는 무시 */ }
      }
    },
  },
  {
    name: "check_stl",
    description: "STL의 삼각형 수와 bbox(X/Y/Z 최소·최대)를 계산한다. 목적은 절대좌표 검증 — 모든 부품 STL이 조립 위치 좌표를 유지하는지(원점 기준) 확인한다. 노멀/매니폴드 같은 메쉼 품질 검사 도구가 아니다(openscad.md 원칙). ASCII/BSTL 모두 지원.",
    inputSchema: {
      type: "object",
      required: ["stl_path"],
      properties: { stl_path: { type: "string" } },
      additionalProperties: false,
    },
    async run(a) {
      const p = path.resolve(a.stl_path);
      if (!fs.existsSync(p)) return fail(`STL 파일이 없습니다: ${p}`);
      const buf = fs.readFileSync(p);
      const head = buf.subarray(0, 5).toString("latin1");
      let tris = [];
      if (head === "solid" && buf.indexOf("facet", 0, "latin1") !== -1) {
        const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
        let m;
        const s = buf.toString("utf8");
        while ((m = re.exec(s)) !== null) tris.push([+m[1], +m[2], +m[3]]);
      }
      if (tris.length === 0 && buf.length > 84) { // binary STL
        const n = buf.readUInt32LE(80);
        if (84 + n * 50 === buf.length) {
          for (let i = 0; i < n; i++) {
            const off = 84 + i * 50 + 12; // normal 건너뜀
            for (let v = 0; v < 3; v++) {
              tris.push([buf.readFloatLE(off + v * 12), buf.readFloatLE(off + v * 12 + 4), buf.readFloatLE(off + v * 12 + 8)]);
            }
          }
        }
      }
      if (tris.length === 0) return fail("STL에서 정점을 읽지 못했습니다 (손상 또는 미지원 형식).");
      const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (const [x, y, z] of tris) {
        for (let i = 0; i < 3; i++) {
          const val = [x, y, z][i];
          if (val < mn[i]) mn[i] = val;
          if (val > mx[i]) mx[i] = val;
        }
      }
      const axis = (i) => `${["X", "Y", "Z"][i]}[${mn[i].toFixed(1)}, ${mx[i].toFixed(1)}] 크기 ${(mx[i] - mn[i]).toFixed(1)}`;
      const nTri = tris.length / 3;
      return ok(str(
        `파일: ${p}`,
        `형식: ${head === "solid" && buf.indexOf("facet", 0, "latin1") !== -1 ? "ASCII" : "binary"} STL`,
        `삼각형: ${nTri}`,
        `bbox:`,
        `  ${axis(0)}`,
        `  ${axis(1)}`,
        `  ${axis(2)}`,
        `중심: [${((mn[0] + mx[0]) / 2).toFixed(1)}, ${((mn[1] + mx[1]) / 2).toFixed(1)}, ${((mn[2] + mx[2]) / 2).toFixed(1)}]`,
        `판정 보조: 원점 대칭 여부 = ${Math.abs((mn[0] + mx[0]) / 2) < 1e-6 && Math.abs((mn[1] + mx[1]) / 2) < 1e-6 ? "X/Y 중심이 원점 (회전축 정렬)" : "X/Y 중심이 원점에서 벗어남"}`,
      ));
    },
  },
];

// ---------- 렌더 공통 ----------

async function renderScad({ scadPath, outPng, selectedPart, camera, viewall, imgsize, timeout }) {
  const scad = path.resolve(scadPath);
  if (!fs.existsSync(scad)) return fail(`scad 파일이 없습니다: ${scad}`);
  const out = path.resolve(outPng);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const args = ["-o", out, "--imgsize=" + imgsize.join(","), "--projection=perspective", "--colorscheme=Cornfield"];
  if (selectedPart !== undefined && selectedPart !== null) args.push("-D", `selected_part=${selectedPart}`);
  if (camera) {
    const c = camera.center || [0, 0, 0], r = camera.rot || [60, 0, 215], d = camera.dist ?? 0;
    args.push("--camera=" + [...c, ...r, d].join(","));
    if (viewall) args.push("--viewall");
  } else {
    args.push("--camera=0,0,0,60,0,215,0", "--autocenter", "--viewall");
  }
  args.push(scad);
  const r = await runOpenscad(args, timeout);
  const exists = fs.existsSync(out) && fs.statSync(out).size > 0;
  if (r.ok && exists) {
    return ok(str(`렌더링 완료: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`, `imgsize: ${imgsize.join("x")}`));
  }
  return fail(str(`렌더링 실패${r.killed ? " (타임아웃)" : ""}`, excerpt(r.stderr)));
}

// ---------- MCP stdio 프로토콜 ----------

const SERVER_INFO = { name: "image-to-stl", version: "1.0.0" };

function reply(id, result) { writeLine({ jsonrpc: "2.0", id, result }); }
function replyError(id, code, message) { writeLine({ jsonrpc: "2.0", id, error: { code, message } }); }
function writeLine(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }

const queue = [];
let busy = false;
let stdinClosed = false;
function enqueue(job) {
  queue.push(job);
  drain();
}
async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const job = queue.shift();
    try { await job(); } catch (e) { log(`작업 오류: ${e?.stack || e}`); }
  }
  busy = false;
  if (stdinClosed) process.exit(0);
}

function handleMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  if (msg.jsonrpc !== "2.0" || typeof msg.method !== "string") return;
  if (msg.id === undefined || msg.id === null) return; // notification — 응답 없음

  enqueue(async () => {
    const { id, method, params } = msg;
    try {
      if (method === "initialize") {
        reply(id, {
          protocolVersion: params?.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
      } else if (method === "ping") {
        reply(id, {});
      } else if (method === "tools/list") {
        reply(id, { tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
      } else if (method === "tools/call") {
        const tool = TOOLS.find((t) => t.name === params?.name);
        if (!tool) {
          replyError(id, -32602, `알 수 없는 툴: ${params?.name}`);
          return;
        }
        try {
          const result = await tool.run(params?.arguments || {});
          reply(id, result);
        } catch (e) {
          log(`툴 실행 오류(${tool.name}): ${e?.stack || e}`);
          reply(id, fail(`툴 실행 중 오류: ${e?.message || e}`));
        }
      } else {
        replyError(id, -32601, `지원하지 않는 메서드: ${method}`);
      }
    } catch (e) {
      replyError(id, -32603, `내부 오류: ${e?.message || e}`);
    }
  });
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch { log(`파싱 실패: ${s.slice(0, 200)}`); return; }
  handleMessage(msg);
});
rl.on("close", () => {
  stdinClosed = true;
  if (!busy && queue.length === 0) process.exit(0);
});
log("기동 완료 (stdio)");
