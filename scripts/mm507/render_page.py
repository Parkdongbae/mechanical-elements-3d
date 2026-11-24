"""책 PDF의 한 쪽을 PNG로 뽑는다(전사·도판 좌표 작업용).
사용: python scripts/mm507/render_page.py <쪽 번호(0부터)> <출력.png> [dpi=110]
"""
import sys
import warnings

warnings.filterwarnings("ignore")
import pymupdf  # noqa: E402

PDF = "mechanical_movements_507/Mechanical_Movements_507.pdf"
idx = int(sys.argv[1])
out = sys.argv[2]
dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 110
doc = pymupdf.open(PDF)
pix = doc[idx].get_pixmap(dpi=dpi)
pix.save(out)
print(f"page {idx}/{len(doc) - 1} -> {out} {pix.width}x{pix.height}")
