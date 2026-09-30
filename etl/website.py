import re
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse

import requests

from stats import Stats

MAX_CHARS_PER_PAGE = 6000
UA = "Mozilla/5.0 (compatible; cafe-nyc-etl/0.1)"
SKIP_TAGS = {"script", "style", "noscript", "svg", "template"}


@dataclass
class Page:
    url: str
    text: str


class _Extractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts: list[str] = []
        self.links: list[tuple[str, str]] = []
        self._skip = 0
        self._href: str | None = None
        self._anchor: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag in SKIP_TAGS:
            self._skip += 1
        elif tag == "a":
            self._href = dict(attrs).get("href")
            self._anchor = []

    def handle_endtag(self, tag):
        if tag in SKIP_TAGS and self._skip:
            self._skip -= 1
        elif tag == "a" and self._href:
            self.links.append((self._href, " ".join(self._anchor)))
            self._href = None

    def handle_data(self, data):
        if self._skip:
            return
        data = data.strip()
        if data:
            self.parts.append(data)
            if self._href is not None:
                self._anchor.append(data)


def _get(url: str, stats: Stats) -> tuple[str, _Extractor] | None:
    stats.web_fetches += 1
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=10)
    except requests.RequestException:
        return None
    if not r.ok or "html" not in r.headers.get("content-type", "").lower():
        return None
    parser = _Extractor()
    try:
        parser.feed(r.text[:1_000_000])
    except Exception:
        return None
    return r.url, parser


def _text(parser: _Extractor) -> str:
    return re.sub(r"\s+", " ", " ".join(parser.parts))[:MAX_CHARS_PER_PAGE]


def _menu_link(base_url: str, parser: _Extractor) -> str | None:
    host = urlparse(base_url).netloc.removeprefix("www.")
    for href, anchor in parser.links:
        if "menu" not in href.lower() and "menu" not in anchor.lower():
            continue
        url = urljoin(base_url, href)
        u = urlparse(url)
        if u.scheme in ("http", "https") and u.netloc.removeprefix("www.") == host \
                and not u.path.lower().endswith(".pdf") and url.rstrip("/") != base_url.rstrip("/"):
            return url
    return None


def fetch_site(website: str | None, stats: Stats) -> list[Page]:
    """Homepage plus at most one same-site menu page."""
    if not website:
        return []
    home = _get(website, stats)
    if not home:
        return []
    url, parser = home
    pages = [Page(url, _text(parser))]
    menu_url = _menu_link(url, parser)
    if menu_url:
        menu = _get(menu_url, stats)
        if menu:
            pages.append(Page(menu[0], _text(menu[1])))
    return [p for p in pages if p.text]
