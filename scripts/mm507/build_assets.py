"""P1 자산 빌더: 영어 원문 병합 + 판화 잘라 내기 + catalog.json 생성.

사용: python scripts/mm507/build_assets.py
입력: data/mm507/pNNN.json, data/mm507/en.json, data/mm507/ocr/pNNN.json, 책 PDF
출력: public/mm507/fig/NNN.png(200dpi 회색조), public/mm507/catalog.json
pNNN.json·PDF·OCR이 일부 없어도 중단하지 않고 요약에 보고한다. 무엇이든 덮어 써도 결과가 같다(멱등).
"""
import glob
import json
import os
import re
import sys
from collections import Counter
from difflib import SequenceMatcher

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import warnings  # noqa: E402

warnings.filterwarnings("ignore")
import pymupdf  # noqa: E402

DATA = os.path.join("data", "mm507")
OCR_DIR = os.path.join(DATA, "ocr")
EN_PATH = os.path.join(DATA, "en.json")
PDF = os.path.join("mechanical_movements_507", "Mechanical_Movements_507.pdf")
FIG_DIR = os.path.join("public", "mm507", "fig")
CAT_PATH = os.path.join("public", "mm507", "catalog.json")
N_TOTAL = 507
DPI = 200       # 판화 렌더 해상도
MARGIN = 6      # 자를 때 여백(px)

PLATE_FILES = sorted(glob.glob(os.path.join(DATA, "p[0-9][0-9][0-9].json")))


def norm(s: str) -> str:
    """소문자화, 문장부호→공백, 공백 압축."""
    return re.sub(r"\s+", " ", re.sub(r"[^0-9a-z]+", " ", s.lower())).strip()


def words_with_offsets(s: str) -> tuple[list[str], list[int]]:
    """(정규화 단어 목록, 원문에서의 시작 오프셋) — 공백·문장부호 달라도 찾도록."""
    ws: list[str] = []
    offs: list[int] = []
    cur = ""
    for i, ch in enumerate(s):
        if ch.isalnum():
            if not cur:
                offs.append(i)
            cur += ch.lower()
        elif cur:
            ws.append(cur)
            cur = ""
    if cur:
        ws.append(cur)
    return ws, offs


def _word_eq(a: str, b: str) -> bool:
    """낱말 일치: 같거나 OCR 오독 수준(유사도 0.7+)이면 같은 것으로 본다."""
    return a == b or SequenceMatcher(None, a, b).ratio() >= 0.7


def find_split(hay: str, needle: str) -> int:
    """hay에서 needle 시작 오프셋(마지막 출현). 실패 시 -1.
    전체 일치 → 앞 3낱말 → 앞 2낱말 순으로, 긴쪽부터 시도한다."""
    hw, hoff = words_with_offsets(hay)
    nw, _ = words_with_offsets(needle)
    if not hw or not nw:
        return -1
    for w, allow in ((len(nw), max(1, len(nw) // 3)), (min(3, len(nw)), 1), (min(2, len(nw)), 0)):
        if w < 1 or w > len(hw):
            continue
        cut = nw[:w]
        best = -1
        for i in range(len(hw) - w + 1):
            miss = sum(0 if _word_eq(hw[i + j], cut[j]) else 1 for j in range(w))
            if miss <= allow:
                best = i  # 마지막(가장 뒤) 위치를 쓴다 — 이어 붙은 꼬리가 뒤에 있다
        if best >= 0:
            return hoff[best]
    return -1


def load_plates() -> tuple[dict[int, dict], dict[int, dict], list[int], list[int]]:
    """pNNN.json 읽기. 없는 파일은 그냥 건너뛴다. 번호 중복은 보고용으로 모은다."""
    texts: dict[int, dict] = {}
    figs: dict[int, dict] = {}
    dup_fig: list[int] = []
    dup_txt: list[int] = []
    for f in PLATE_FILES:
        try:
            d = json.load(open(f, encoding="utf-8"))
        except (OSError, ValueError) as e:
            print(f"! 읽기 실패 {f}: {e}")
            continue
        pp = d.get("platePage")
        tp = d.get("textPage")
        for g in d.get("figures", []):
            n = g.get("n")
            if n not in figs:
                figs[n] = {**g, "plate": pp, "src": f}
            elif n not in dup_fig:
                dup_fig.append(n)
        for t in d.get("texts", []):
            n = t.get("n")
            if n not in texts:
                texts[n] = {**t, "plate": pp, "textPage": tp, "src": f}
            elif n not in dup_txt:
                dup_txt.append(n)
    return texts, figs, dup_fig, dup_txt


def merge_english(texts: dict[int, dict]) -> tuple[dict[int, str], dict[int, str], list[int]]:
    """번호별 영어 원문: texts.en → en.json → 앞번호 본문 분할 → 본문 쪽 OCR 분할.
    같은 enStart를 가진 번호들은 같은 문단을 공유한다(부록 A)."""
    en_json: dict[int, str] = {}
    try:
        raw = json.load(open(EN_PATH, encoding="utf-8"))
        for k, v in raw.items():
            try:
                en_json[int(k)] = v.get("en", "") if isinstance(v, dict) else ""
            except ValueError:
                pass
    except (OSError, ValueError) as e:
        print(f"! en.json 없음/손상: {e}")

    final: dict[int, str] = {}
    src: dict[int, str] = {}
    for n in range(1, N_TOTAL + 1):
        t = texts.get(n) or {}
        if isinstance(t.get("en"), str) and t["en"].strip():
            final[n] = t["en"].strip()
            src[n] = "texts.en"
        elif en_json.get(n, "").strip():
            final[n] = en_json[n].strip()
            src[n] = "en.json"

    # enStart 공유 그룹 + 역방향 조회
    groups: dict[str, list[int]] = {}
    grp_of: dict[int, str] = {}
    for n, t in texts.items():
        ens = t.get("enStart")
        if isinstance(ens, str) and ens.strip():
            k = norm(ens)
            groups.setdefault(k, []).append(n)
            grp_of[n] = k

    page_cache: dict[int, str] = {}

    def page_text(pg: int | None) -> str:
        """본문 쪽 OCR 전문(줄을 이어 붙임). 없으면 빈 문자열."""
        if pg is None or pg < 0:
            return ""
        if pg not in page_cache:
            try:
                d = json.load(open(os.path.join(OCR_DIR, f"p{pg:03d}.json"), encoding="utf-8"))
                page_cache[pg] = " ".join(l.get("text", "") for l in d.get("lines", []))
            except (OSError, ValueError):
                page_cache[pg] = ""
        return page_cache[pg]

    missing: list[int] = []
    for n in range(1, N_TOTAL + 1):
        if n in final:
            continue
        t = texts.get(n)
        ens = (t or {}).get("enStart")
        if not t or not isinstance(ens, str) or not ens.strip():
            missing.append(n)
            continue
        g = groups.get(grp_of[n], [n])
        tail, how = None, ""
        prev = final.get(n - 1, "")
        if prev:
            i = find_split(prev, ens)
            if i > 0:
                head = prev[:i].rstrip()
                final[n - 1] = head
                pk = grp_of.get(n - 1)  # 앞 번호가 문단을 공유 중이면 같이 잘라 준다
                if pk:
                    for m in groups[pk]:
                        if m != n - 1 and final.get(m) == prev:
                            final[m] = head
                tail, how = prev[i:].strip(), "앞번호 분할"
            elif i == 0:
                tail, how = prev.strip(), "앞번호 분할"
        if tail is None:  # 본문 쪽 첫머리 문단은 en.json에서 통째로 빠졌을 수 있다 → 쪽 OCR에서
            tp = t.get("textPage")
            for pg in (tp, tp + 2 if isinstance(tp, int) else None):
                ptxt = page_text(pg)
                if ptxt:
                    i = find_split(ptxt, ens)
                    if i >= 0:
                        tail, how = ptxt[i:].strip(), f"p{pg:03d} OCR 분할"
                        break
        if tail:
            for m in g:
                if m not in final:
                    final[m] = tail
                    src[m] = how
        else:
            missing.append(n)
    return final, src, missing


def apply_enfix(texts: dict[int, dict], final: dict[int, str]) -> int:
    """enFix: OCR 오독 치환. 병합이 끝난 뒤 적용한다."""
    cnt = 0
    for n, t in texts.items():
        if n not in final:
            continue
        for fx in t.get("enFix") or []:
            w, r = fx.get("wrong"), fx.get("right")
            if w and isinstance(r, str) and w in final[n]:
                final[n] = final[n].replace(w, r)
                cnt += 1
    return cnt


def clean_png(path: str) -> None:
    """판화 정리: 잡티 제거(중앙값 3) → 대비 → 종이 바탕(밝은 회색)을 흰색으로 → 8단계 회색.
    스캔 결의 잡음이 사라져 장당 약 10KB(원본 약 130KB). Pillow 가 없으면 원본 그대로 둔다."""
    try:
        from PIL import Image, ImageFilter, ImageOps
    except ImportError:
        return
    im = Image.open(path).convert("L")
    im = ImageOps.autocontrast(im.filter(ImageFilter.MedianFilter(3)), cutoff=1)
    im = im.point(lambda v: 255 if v > 200 else v)
    im.quantize(8, dither=Image.Dither.NONE).save(path, "PNG", optimize=True)


def crop_figures(figs: dict[int, dict]) -> tuple[int, int, list[int]]:
    """도판 렌더(쪽당 1회, 200dpi 회색조) 후 정규화 box+6px로 잘라 NNN.png 저장.
    PNG이 JSON보다 새우면 건너뛴다(멱등)."""
    os.makedirs(FIG_DIR, exist_ok=True)
    per_plate: dict[int, list[tuple[int, dict]]] = {}
    for n, g in figs.items():
        per_plate.setdefault(g["plate"], []).append((n, g))
    made = skipped = 0
    bad: list[int] = []
    doc = None
    try:
        doc = pymupdf.open(PDF)
    except Exception as e:  # PDF가 없어도 보고만 하고 진행
        print(f"! PDF 열기 실패: {e}")
    try:
        for pp in sorted(per_plate):
            items = per_plate[pp]
            fresh = all(
                os.path.exists(out := os.path.join(FIG_DIR, f"{n:03d}.png"))
                and os.path.getmtime(out) >= os.path.getmtime(g["src"])
                for n, g in items
            )
            if fresh:
                skipped += len(items)
                continue
            if doc is None or not 0 <= pp < len(doc):
                bad.extend(n for n, _ in items)
                continue
            pix = doc[pp].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
            for n, g in items:
                out = os.path.join(FIG_DIR, f"{n:03d}.png")
                if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(g["src"]):
                    skipped += 1
                    continue
                box = g.get("box")
                if not isinstance(box, list) or len(box) != 4:
                    bad.append(n)
                    continue
                x0, y0, x1, y1 = (float(v) for v in box)
                px0 = max(0, min(pix.width, round(x0 * pix.width) - MARGIN))
                py0 = max(0, min(pix.height, round(y0 * pix.height) - MARGIN))
                px1 = max(0, min(pix.width, round(x1 * pix.width) + MARGIN))
                py1 = max(0, min(pix.height, round(y1 * pix.height) + MARGIN))
                if px1 <= px0 or py1 <= py0:
                    bad.append(n)
                    continue
                irect = pymupdf.IRect(px0, py0, px1, py1)
                dst = pymupdf.Pixmap(pix.colorspace, irect, False)
                dst.copy(pix, irect)
                dst.save(out)
                clean_png(out)
                made += 1
            pix = None  # 쪽 버퍼 해제
    finally:
        if doc is not None:
            doc.close()
    return made, skipped, sorted(set(bad))


def write_catalog(texts: dict[int, dict], figs: dict[int, dict], final: dict[int, str]) -> int:
    arr = []
    for n in range(1, N_TOTAL + 1):
        t, g = texts.get(n), figs.get(n)
        if not t and not g:
            continue
        arr.append({
            "n": n,
            "title": (t or {}).get("titleKo", ""),
            "cat": (t or {}).get("category", ""),
            "ko": (t or {}).get("ko", ""),
            "easy": (t or {}).get("easy", ""),
            "en": final.get(n, ""),
            "plate": (g or t or {}).get("plate"),
        })
    arr.sort(key=lambda e: e["n"])
    os.makedirs(os.path.dirname(CAT_PATH), exist_ok=True)
    with open(CAT_PATH, "w", encoding="utf-8") as f:
        json.dump(arr, f, ensure_ascii=False, indent=1)
    return len(arr)


def ranges(ns: list[int]) -> str:
    """[40,41,42,43] → '40–43' 처럼 묶어 출력."""
    ns = sorted(set(ns))
    if not ns:
        return "없음"
    out, s, p = [], ns[0], ns[0]
    for x in ns[1:]:
        if x == p + 1:
            p = x
            continue
        out.append(str(s) if s == p else f"{s}–{p}")
        s = p = x
    out.append(str(s) if s == p else f"{s}–{p}")
    return ", ".join(out)


def main() -> None:
    if not PLATE_FILES:
        print("! data/mm507/pNNN.json 이 하나도 없습니다")
    texts, figs, dup_fig, dup_txt = load_plates()
    final, src, miss_en = merge_english(texts)
    n_fix = apply_enfix(texts, final)
    made, skipped, bad_fig = crop_figures(figs)
    n_cat = write_catalog(texts, figs, final)

    miss_fig = [n for n in range(1, N_TOTAL + 1) if n not in figs]
    miss_ko = [n for n in range(1, N_TOTAL + 1) if not (texts.get(n) or {}).get("ko", "").strip()]
    cnt = Counter(src.values())
    print()
    print("== 요약 ==")
    print(f"입력: pNNN.json {len(PLATE_FILES)}개, texts {len(texts)}개, figures {len(figs)}개")
    print(f"판화: {N_TOTAL - len(miss_fig)}/{N_TOTAL}  없음: {ranges(miss_fig)}")
    print(f"한글: {N_TOTAL - len(miss_ko)}/{N_TOTAL}  없음: {ranges(miss_ko)}")
    print(f"영어: {N_TOTAL - len(miss_en)}/{N_TOTAL}  없음: {ranges(miss_en)}")
    print(f"중복: figures {ranges(dup_fig)} / texts {ranges(dup_txt)}")
    print("영어 출처: " + (", ".join(f"{k} {v}" for k, v in sorted(cnt.items())) or "없음"))
    print(f"enFix 치환: {n_fix}건")
    print(f"PNG: 새로 {made}장, 최신이라 건너뜀 {skipped}장, 실패 {len(bad_fig)}장"
          + (f" ({ranges(bad_fig)})" if bad_fig else ""))
    print(f"catalog.json: {n_cat}개 → {CAT_PATH}")


if __name__ == "__main__":
    main()
