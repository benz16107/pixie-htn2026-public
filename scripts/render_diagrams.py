"""Render every Mermaid block in docs/ARCHITECTURE.md to docs/diagrams/<name>.svg and .png.

A block is rendered when an HTML comment names it right above the fence:

    <!-- diagram: 01-overview -->
    ```mermaid
    flowchart LR
    ...
    ```

Rendering goes through mermaid.ink (the hosted mermaid renderer), so this needs the network and
nothing installed. The outputs are committed, so the demo and the Devpost post never need it again.
Every render is checked: a file that is empty, is not really a PNG/SVG, or has no dimensions fails
the script with a non-zero exit.

    python3 scripts/render_diagrams.py
"""

from __future__ import annotations

import base64
import re
import struct
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "ARCHITECTURE.md"
OUT = ROOT / "docs" / "diagrams"
UA = {"User-Agent": "Mozilla/5.0 (pixie-docs)"}  # mermaid.ink 403s a bare urllib UA
BLOCK = re.compile(r"<!--\s*diagram:\s*([\w.-]+)\s*-->\s*\n```mermaid\n(.*?)\n```", re.S)


def fetch(url: str, tries: int = 4) -> bytes:
    """mermaid.ink 503s on a big diagram under load; it renders on a retry."""
    import time
    for attempt in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90).read()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("unreachable")


def png_size(data: bytes) -> tuple[int, int]:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError("not a PNG")
    return struct.unpack(">II", data[16:24])


def svg_size(data: bytes) -> tuple[int, int]:
    head = data[:2000].decode("utf-8", "replace")
    if not head.lstrip().startswith("<svg"):
        raise ValueError("not an SVG")
    box = re.search(r'viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"', head)
    if box:
        return int(float(box.group(1))), int(float(box.group(2)))
    w = re.search(r'width="(\d+)', head)
    h = re.search(r'height="(\d+)', head)
    if not (w and h):
        raise ValueError("SVG has no viewBox and no width/height")
    return int(w.group(1)), int(h.group(1))


def main() -> int:
    blocks = BLOCK.findall(SOURCE.read_text())
    if not blocks:
        print(f"no named mermaid blocks in {SOURCE}", file=sys.stderr)
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    failures = []
    for name, code in blocks:
        b64 = base64.urlsafe_b64encode(code.encode()).decode()
        # The PNG width follows the SVG's own aspect ratio, capped so a tall diagram does not come
        # back 13,000 px high: a wide diagram gets 3200 px across, a tall one gets ~5000 px down.
        png_width = 3200
        for kind in ("svg", "png"):
            url = (f"https://mermaid.ink/svg/{b64}?bgColor=FFFFFF" if kind == "svg" else
                   f"https://mermaid.ink/img/{b64}?type=png&bgColor=FFFFFF&width={png_width}&scale=1")
            path = OUT / f"{name}.{kind}"
            try:
                data = fetch(url)
                w, h = (png_size if kind == "png" else svg_size)(data)
                if not data or w < 200 or h < 100:
                    raise ValueError(f"suspicious render: {len(data)} bytes, {w}x{h}")
                if kind == "svg":
                    png_width = max(1000, min(3200, round(5000 * w / h)))
                path.write_bytes(data)
                print(f"{path.relative_to(ROOT)}  {len(data):>8,} bytes  {w}x{h}")
            except Exception as exc:
                failures.append(f"{name}.{kind}: {type(exc).__name__}: {exc}")
    for f in failures:
        print("FAILED " + f, file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
