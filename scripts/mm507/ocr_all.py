"""책의 모든 쪽(13~끝)을 220dpi 로 뽑아 Windows 내장 OCR 로 읽고 data/mm507/ocr/pNNN.json 에 저장한다.
사용: python scripts/mm507/ocr_all.py [시작=13] [끝=137]   (이미 있는 쪽은 건너뜀)
"""
import os
import subprocess
import sys
import tempfile
import warnings

warnings.filterwarnings("ignore")
import pymupdf  # noqa: E402

PDF = "mechanical_movements_507/Mechanical_Movements_507.pdf"
start = int(sys.argv[1]) if len(sys.argv) > 1 else 13
end = int(sys.argv[2]) if len(sys.argv) > 2 else 137
doc = pymupdf.open(PDF)
tmp = tempfile.mkdtemp(prefix="mm507ocr")
for i in range(start, min(end, len(doc) - 1) + 1):
    out = os.path.abspath(f"data/mm507/ocr/p{i:03d}.json")
    if os.path.exists(out):
        continue
    png = os.path.join(tmp, f"p{i:03d}.png")
    doc[i].get_pixmap(dpi=220).save(png)
    r = subprocess.run(
        ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/mm507/ocr_page.ps1", png, out],
        capture_output=True, text=True,
    )
    ok = os.path.exists(out)
    print(f"p{i:03d} {'ok' if ok else 'FAIL ' + r.stderr[-200:]}", flush=True)
    os.remove(png)
print("OCR_DONE")
