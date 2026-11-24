"""OCR 결과(data/mm507/ocr/pNNN.json)에서 본문 쪽을 골라 번호별 영어 원문으로 나눈다.
출력: data/mm507/en.json  { "<번호>": {"en": "...", "page": 쪽} }  + 빠진 번호 보고
사용: python scripts/mm507/segment_text.py
"""
import glob
import json
import re

pages = {}
for f in sorted(glob.glob("data/mm507/ocr/p*.json")):
    idx = int(re.search(r"p(\d+)\.json", f).group(1))
    pages[idx] = json.load(open(f, encoding="utf-8"))


def words_of(p):
    return sum(len(l["words"]) for l in p["lines"])


text_pages = [i for i, p in sorted(pages.items()) if words_of(p) > 120]
plate_pages = [i for i, p in sorted(pages.items()) if words_of(p) <= 120]

out = {}
expected = 1
start_re = re.compile(r"^[\.\s·:,]*(\d{1,3})\s*[\.,]\s*(.*)$")
for idx in text_pages:
    p = pages[idx]
    mid = p["width"] / 2
    # OCR 이 두 단을 한 줄로 합쳐 읽는 일이 있어, 낱말 단위로 단을 나눈 뒤 줄을 다시 만든다
    cols = {0: [], 1: []}
    for l in p["lines"]:
        for w in l["words"]:
            cx = w["x"] + w["w"] / 2
            cols[0 if cx < mid else 1].append(w)
    lines = []
    for col, ws in cols.items():
        ws.sort(key=lambda w: (w["y"] + w["h"] / 2, w["x"]))
        row = []
        for w in ws:
            cy = w["y"] + w["h"] / 2
            if row and abs(cy - row_y) > max(14, w["h"] * 0.6):
                row.sort(key=lambda t: t["x"])
                lines.append((col, row_y, row[0]["x"], " ".join(t["t"] for t in row)))
                row = []
            if not row:
                row_y = cy
            row.append(w)
        if row:
            row.sort(key=lambda t: t["x"])
            lines.append((col, row_y, row[0]["x"], " ".join(t["t"] for t in row)))
    hdr = re.compile(r"MECHANICAL|MOVEMENTS\.?|MECHANICAL MOVEMENTS\.?|\d{1,3}")
    lines = [t for t in lines if not (hdr.fullmatch(t[3].strip()) and t[1] < p["height"] * 0.24)]
    lines.sort()
    cur = None
    for col, y, x, txt in lines:
        m = start_re.match(txt)
        n = int(m.group(1)) if m else None
        # 기대 번호(다음 번호 또는 조금 건너뜀)일 때만 새 항목 시작
        if n is not None and expected <= n <= expected + 8 and n <= 507:
            cur = n
            out[cur] = {"en": m.group(2), "page": idx}
            expected = n + 1
        elif cur is not None:
            out[cur]["en"] += " " + txt
for n, e in out.items():
    t = e["en"]
    t = re.sub(r"(\w)- (\w)", r"\1\2", t)  # 줄바꿈 하이픈 잇기
    t = re.sub(r"\s+", " ", t).strip()
    e["en"] = t
missing = [n for n in range(1, 508) if n not in out]
json.dump({str(k): v for k, v in sorted(out.items())}, open("data/mm507/en.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("text pages", len(text_pages), "plate pages", len(plate_pages))
print("found", len(out), "missing", len(missing), missing[:80])
print("first text page", text_pages[:3], "last", text_pages[-3:])
