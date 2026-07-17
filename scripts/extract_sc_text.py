from __future__ import annotations

import re
import sys
from pathlib import Path
from zipfile import ZipFile

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="ignore")


def extract_pdf(path: Path, page_limit: int = 20) -> str:
    import pypdf

    reader = pypdf.PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages[:page_limit])


def extract_docx(path: Path) -> str:
    with ZipFile(path) as archive:
        xml = archive.read("word/document.xml").decode("utf-8", "ignore")
    return " ".join(re.findall(r"<w:t[^>]*>(.*?)</w:t>", xml))


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "usage: extract_sc_text.py <pdf|docx> <path> [limit] [max_chars]",
            file=sys.stderr,
        )
        return 2
    kind = sys.argv[1]
    path = Path(sys.argv[2])
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 20
    max_chars = int(sys.argv[4]) if len(sys.argv) > 4 else 20000
    if kind == "pdf":
        text = extract_pdf(path, limit)
        print(text if max_chars < 0 else text[:max_chars])
        return 0
    if kind == "docx":
        text = extract_docx(path)
        print(text if max_chars < 0 else text[:max_chars])
        return 0
    print(f"unknown kind: {kind}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
