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
    lines = []
    for l in p["lines"]:
        if not l["words"]:
            continue
        x = l["words"][0]["x"]
        y = l["words"][0]["y"]
        txt = l["text"].strip()
        # 머리말(쪽 제목·쪽 번호) 제외
        if re.fullmatch(r"MECHANICAL|MOVEMENTS\.?|MECHANICAL MOVEMENTS\.?|\d{1,3}", txt) and y < p["height"] * 0.24:
            continue
        lines.append((0 if x < mid - 20 else 1, y, x, txt))
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
