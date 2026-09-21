#!/usr/bin/env python3
"""Builds an inline SVG sprite with only the icons a page uses.

Brands come from Simple Icons (CC0) and interface icons from Phosphor (MIT), both pinned so a
page never changes by surprise. Usage:

    python3 scripts/icon-sprite.py si:whatsapp si:instagram ph:arrow-right ph-fill:star

Prints a hidden <svg> with one <symbol id="i-<name>"> per icon. Use it in the page as
<svg class="ico" aria-hidden="true"><use href="#i-whatsapp"/></svg>.
"""

import re
import sys
import urllib.request

SIMPLE_ICONS = "https://cdn.jsdelivr.net/npm/simple-icons@15.22.0/icons/{name}.svg"
PHOSPHOR = "https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/{weight}/{file}.svg"
PHOSPHOR_WEIGHTS = {"ph": ("regular", ""), "ph-bold": ("bold", "-bold"), "ph-fill": ("fill", "-fill")}


def fetch(url: str) -> str:
    with urllib.request.urlopen(url, timeout=20) as response:
        return response.read().decode("utf-8")


def source_url(spec: str) -> tuple[str, str]:
    """Returns (symbol name, download url) for a spec like 'si:whatsapp' or 'ph-fill:star'."""
    family, _, name = spec.partition(":")
    if family == "si":
        return name, SIMPLE_ICONS.format(name=name)
    if family in PHOSPHOR_WEIGHTS:
        weight, suffix = PHOSPHOR_WEIGHTS[family]
        return name, PHOSPHOR.format(weight=weight, file=f"{name}{suffix}")
    raise SystemExit(f"unknown icon family in '{spec}': use si, ph, ph-bold or ph-fill")


def to_symbol(name: str, svg: str) -> str:
    view_box = re.search(r'viewBox="([^"]+)"', svg).group(1)
    inner = re.sub(r"^.*?<svg[^>]*>|</svg>\s*$", "", svg, flags=re.S)
    inner = re.sub(r"<title>.*?</title>", "", inner, flags=re.S).strip()
    return f'<symbol id="i-{name}" viewBox="{view_box}">{inner}</symbol>'


def main(specs: list[str]) -> None:
    if not specs:
        raise SystemExit(__doc__)
    symbols = [to_symbol(*_named_svg(spec)) for spec in specs]
    print('<svg width="0" height="0" style="position:absolute" aria-hidden="true">')
    print("  <!-- Icons: brands from Simple Icons (CC0), interface from Phosphor (MIT). -->")
    for symbol in symbols:
        print(f"  {symbol}")
    print("</svg>")


def _named_svg(spec: str) -> tuple[str, str]:
    name, url = source_url(spec)
    return name, fetch(url)


if __name__ == "__main__":
    main(sys.argv[1:])
