#!/usr/bin/env python3
"""Moves a page from the Google Fonts stylesheet to fonts served by this site.

The Google Fonts <link> blocks rendering and costs two extra connections on a slow phone. This
script downloads the woff2 files the stylesheet points to (latin and latin-ext only), saves them
in assets/fonts/ and swaps the <link> for an inline @font-face block with the same rules.

    scripts/fontes-locais.py index.html demos/bar/index.html ...
    scripts/fontes-locais.py --preload "Anton:400" --preload "Inter Tight:400" index.html

--preload adds <link rel="preload"> for the latin file of that family and weight. Use it only for
the one or two fonts that paint the first screen, or it competes with the main image.
Running it again on a page that no longer has the Google Fonts link does nothing.
"""
import argparse
import hashlib
import pathlib
import re
import sys
import urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
FONTS_DIR = REPO / "assets" / "fonts"
PUBLIC_PREFIX = "/assets/fonts/"
KEPT_SUBSETS = ("latin", "latin-ext")
# A current desktop Chrome, so Google answers with woff2 and unicode-range splits.
BROWSER_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36")

STYLESHEET_LINK = re.compile(r'[ \t]*<link[^>]*href="(https://fonts\.googleapis\.com/css2\?[^"]+)"[^>]*>\n?')
PRECONNECT_LINK = re.compile(r'[ \t]*<link rel="preconnect" href="https://fonts\.(?:googleapis|gstatic)\.com"[^>]*>\n?')
FACE_BLOCK = re.compile(r"/\* ([a-z-]+) \*/\s*(@font-face \{.*?\})", re.S)


def fetch(url, binary=False):
    request = urllib.request.Request(url, headers={"User-Agent": BROWSER_UA})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = response.read()
    return data if binary else data.decode("utf-8")


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def face_field(block, name):
    match = re.search(rf"{name}:\s*([^;]+);", block)
    return match.group(1).strip() if match else ""


def localize_face(block, subset):
    remote = re.search(r"url\((https://fonts\.gstatic\.com/[^)]+\.woff2)\)", block).group(1)
    family = face_field(block, "font-family").strip("'\"")
    digest = hashlib.sha1(remote.encode()).hexdigest()[:8]
    filename = f"{slug(family)}-{subset}-{digest}.woff2"
    target = FONTS_DIR / filename
    if not target.exists():
        target.write_bytes(fetch(remote, binary=True))
    local_block = block.replace(remote, PUBLIC_PREFIX + filename)
    return family, face_field(block, "font-weight"), face_field(block, "font-style"), filename, local_block


def weight_matches(declared, wanted):
    parts = declared.split()
    if len(parts) == 2:
        return int(parts[0]) <= wanted <= int(parts[1])
    return int(parts[0]) == wanted


def build_font_css(stylesheet_url, preload_specs):
    css = fetch(stylesheet_url)
    blocks, preloads = [], []
    for subset, block in FACE_BLOCK.findall(css):
        if subset not in KEPT_SUBSETS:
            continue
        family, weight, style, filename, local_block = localize_face(block, subset)
        blocks.append(f"  /* {family} {weight} {style}, {subset} */\n  " + " ".join(local_block.split()))
        for wanted_family, wanted_weight in preload_specs:
            is_match = (subset == "latin" and style == "normal" and family == wanted_family
                        and weight_matches(weight, wanted_weight) and filename not in preloads)
            if is_match:
                preloads.append(filename)
    return blocks, preloads


def convert_page(page, preload_specs):
    html = page.read_text(encoding="utf-8")
    match = STYLESHEET_LINK.search(html)
    if not match:
        return f"{page}: sem link do Google Fonts, nada a fazer"
    blocks, preloads = build_font_css(match.group(1).replace("&amp;", "&"), preload_specs)
    indent = re.match(r"[ \t]*", match.group(0)).group(0)
    preload_tags = "".join(
        f'{indent}<link rel="preload" href="{PUBLIC_PREFIX}{name}" as="font" type="font/woff2" crossorigin>\n'
        for name in preloads)
    style_tag = f"{indent}<style id=\"fontes\">\n" + "\n".join(blocks) + f"\n{indent}</style>\n"
    html = html[:match.start()] + preload_tags + style_tag + html[match.end():]
    html = PRECONNECT_LINK.sub("", html)
    page.write_text(html, encoding="utf-8")
    return f"{page}: {len(blocks)} @font-face, preload {preloads or 'nenhum'}"


def parse_preload(spec):
    family, _, weight = spec.rpartition(":")
    return family, int(weight)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pages", nargs="+", type=pathlib.Path)
    parser.add_argument("--preload", action="append", default=[], type=parse_preload,
                        help='family and weight, e.g. "Inter Tight:400"')
    args = parser.parse_args()
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    for page in args.pages:
        print(convert_page(page.resolve(), args.preload))
    return 0


if __name__ == "__main__":
    sys.exit(main())
