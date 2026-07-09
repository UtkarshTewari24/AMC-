#!/usr/bin/env python3
"""AMC 10 problem scraper for the AoPS wiki.

Scrapes every AMC 10 problem (2000-2024, contests A and B, including the
single 2000/2001 AMC 10 and the 2021 Fall administration) into
data/problems.json, downloading geometry diagrams into public/diagrams/.

Modes:
  fixtures        Fetch a representative set of raw HTML pages into
                  scripts/fixtures/ (used to develop the parser offline).
  parse-fixtures  Parse the fixture pages offline; no network needed.
  test            Scrape a single contest end-to-end (2015 AMC 10A).
  full            Scrape all 50 contests (~1250 problems, ~1350 requests).

Respects AoPS: 500ms delay between requests, descriptive user agent,
retries with backoff on 429/5xx.
"""

import argparse
import json
import re
import sys
import time
import uuid
from pathlib import Path

try:
    import requests
except ImportError:  # parse-fixtures mode works without requests
    requests = None

from bs4 import BeautifulSoup, NavigableString, Tag

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DIR = ROOT / "scripts" / "fixtures"
DATA_DIR = ROOT / "data"
DIAGRAM_DIR = ROOT / "public" / "diagrams"

WIKI = "https://artofproblemsolving.com/wiki/index.php"
# AoPS's WAF 403s non-browser clients, so we present standard browser
# headers; rate limiting below keeps the crawl polite regardless.
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://artofproblemsolving.com/",
}
REQUEST_DELAY = 0.5

TOPICS = [
    "Algebra", "Geometry", "Number Theory", "Combinatorics", "Probability",
    "Sequences & Series", "Functions", "Trigonometry", "Logic & Word Problems",
]


def contest_list():
    """All AMC 10 administrations: (year, contest_label, wiki_slug)."""
    contests = []
    for year in range(2000, 2025):
        if year in (2000, 2001):
            contests.append((year, "AMC10", f"{year}_AMC_10"))
        else:
            contests.append((year, "AMC10A", f"{year}_AMC_10A"))
            contests.append((year, "AMC10B", f"{year}_AMC_10B"))
        if year == 2021:
            contests.append((2021, "AMC10A Fall", "2021_Fall_AMC_10A"))
            contests.append((2021, "AMC10B Fall", "2021_Fall_AMC_10B"))
    return contests


# ---------------------------------------------------------------- fetching

_session = None
_direct_blocked = False

# The Wayback Machine's "id_" modifier serves the archived page byte-for-byte
# as originally captured (no toolbar or URL rewriting), so parsing is
# identical to a live fetch. Used when AoPS blocks the runner's IP.
WAYBACK_PREFIX = "https://web.archive.org/web/2026id_/"


def _get_session():
    global _session
    if _session is None:
        _session = requests.Session()
        _session.headers.update(BROWSER_HEADERS)
    return _session


def _direct_get(url, attempts=2):
    """Returns a Response, None for 404, or 'blocked' on persistent 403."""
    s = _get_session()
    for attempt in range(attempts):
        time.sleep(REQUEST_DELAY)
        try:
            resp = s.get(url, timeout=45)
        except Exception as exc:
            print(f"    retry ({exc.__class__.__name__}) {url}", flush=True)
            time.sleep(2 ** attempt)
            continue
        if resp.status_code == 200:
            return resp
        if resp.status_code == 404:
            return None
        if resp.status_code == 403:
            return "blocked"
        time.sleep(2 ** attempt)
    return "blocked"


def _wayback_get(url):
    """Fetch the latest archived copy of url; None when never archived."""
    s = _get_session()
    wb_url = WAYBACK_PREFIX + url
    for attempt in range(6):
        time.sleep(REQUEST_DELAY)
        try:
            resp = s.get(wb_url, timeout=90, allow_redirects=True)
        except Exception as exc:
            print(f"    wayback retry ({exc.__class__.__name__}) {url}",
                  flush=True)
            time.sleep(2 ** attempt)
            continue
        if resp.status_code == 200:
            return resp
        if resp.status_code == 404:
            return None
        # 429/5xx: back off — archive.org throttles sustained load
        print(f"    wayback retry (HTTP {resp.status_code}) {url}", flush=True)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f"failed to fetch {url} via wayback")


def http_get(url):
    global _direct_blocked
    if not _direct_blocked:
        resp = _direct_get(url)
        if resp != "blocked":
            return resp
        _direct_blocked = True
        print("  !! direct AoPS access blocked from this network — "
              "falling back to the Wayback Machine", flush=True)
    return _wayback_get(url)


def get_page(slug_page, fixtures_only=False):
    """Return HTML for a wiki page, from fixture cache or network."""
    cache = FIXTURE_DIR / (slug_page.replace("/", "__") + ".html")
    if cache.exists():
        return cache.read_text(encoding="utf-8")
    if fixtures_only:
        return None
    resp = http_get(f"{WIKI}/{slug_page}")
    return resp.text if resp is not None else None


# ---------------------------------------------------------------- parsing

ASY_RE = re.compile(r"^\s*\[asy\]", re.IGNORECASE)


def is_latex_img(img):
    alt = img.get("alt") or ""
    if ASY_RE.match(alt):
        return False
    return alt.startswith("$") or alt.startswith("\\[") or alt.startswith("\\begin")


def node_text(node, diagrams):
    """Flatten a node to text, substituting latex img alts, collecting diagrams."""
    if isinstance(node, NavigableString):
        return str(node)
    if not isinstance(node, Tag):
        return ""
    if node.name == "img":
        alt = node.get("alt") or ""
        src = node.get("src") or ""
        if ASY_RE.match(alt) or (not is_latex_img(node) and src):
            if src:
                diagrams.append(src)
            return ""
        return alt
    if node.name in ("script", "style"):
        return ""
    if node.name == "br":
        return "\n"
    out = "".join(node_text(c, diagrams) for c in node.children)
    if node.name == "p":
        out = out.strip() + "\n\n"
    return out


def _is_heading_tag(tag):
    if tag.name in ("h1", "h2", "h3"):
        return True
    # newer MediaWiki wraps headings: <div class="mw-heading mw-heading2"><h2>…
    return tag.name == "div" and any(
        "mw-heading" in c for c in (tag.get("class") or []))


def heading_node(span):
    """The sibling-level node for a headline span (h2, or its wrapper div)."""
    h = span.find_parent(["h1", "h2", "h3"])
    if h is not None and isinstance(h.parent, Tag) and _is_heading_tag(h.parent):
        return h.parent
    return h


def section_content(heading):
    """All sibling nodes after a heading until the next heading."""
    nodes = []
    for sib in heading.next_siblings:
        if isinstance(sib, Tag) and _is_heading_tag(sib):
            break
        nodes.append(sib)
    return nodes


def clean_text(text):
    text = text.replace("\r", "")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    # drop "Solution"/"Video Solution" stub links that leak into problem text
    return text.strip()


_CMD = r"\\(?:textbf|mathbf|mathrm|text|rm|bf)"


def _marker_re(letter, plain=False):
    if plain:
        return re.compile(r"\(\s*" + letter + r"\s*\)")
    return re.compile(
        r"(?:" + _CMD + r"\s*\{\s*\(\s*" + letter + r"\s*\)[^{}]*\}"   # \textbf{(A) }
        r"|\(\s*" + _CMD + r"\s*\{\s*" + letter + r"\s*\}\s*\)"        # (\text{A})
        r"|" + _CMD + r"\s*\(\s*" + letter + r"\s*\))"                 # \mathrm (A)
    )


MARKERS = {letter: _marker_re(letter) for letter in "ABCDE"}
PLAIN_MARKERS = {letter: _marker_re(letter, plain=True) for letter in "ABCDE"}


def _find_marker_positions(text, markers):
    """Last in-order occurrence of the (A)..(E) markers, or None."""
    positions = {}
    end = len(text)
    for letter in "EDCBA":
        matches = [m for m in markers[letter].finditer(text) if m.start() < end]
        if not matches:
            return None
        m = matches[-1]
        positions[letter] = (m.start(), m.end())
        end = m.start()
    return positions


def split_choices(text):
    """Split question text into (question, [5 choice latex strings]).

    Finds the last in-order occurrence of (A)..(E) style markers.  Returns
    (text, []) when the pattern cannot be found.
    """
    positions = _find_marker_positions(text, MARKERS)
    if positions is None:
        positions = _find_marker_positions(text, PLAIN_MARKERS)
    if positions is None:
        return text, []

    bounds = [positions[c] for c in "ABCDE"]
    pieces = []
    for i, (start, mark_end) in enumerate(bounds):
        stop = bounds[i + 1][0] if i + 1 < len(bounds) else len(text)
        pieces.append(text[mark_end:stop])

    def clean_choice(s):
        s = s.strip()
        s = re.sub(r"^[\\]?[ ~]+", "", s)
        s = re.sub(r"\\q?quad\s*$", "", s.strip())
        s = re.sub(r"^\\ ", "", s)
        s = s.strip()
        s = s.strip("$").strip()
        s = re.sub(r"\\q?quad\s*$", "", s).strip()
        return s

    choices = [clean_choice(p) for p in pieces]
    if any(not c for c in choices):
        return text, []
    question = text[: bounds[0][0]].rstrip()
    question = re.sub(r"\$\s*$", "", question).rstrip()
    return question, choices


TOPIC_RULES = [
    ("Trigonometry", 3, [r"\\sin", r"\\cos", r"\\tan", r"sine", r"cosine",
                         r"tangent of"]),
    ("Probability", 3, [r"probabilit", r"at random", r"randomly", r"\bdice\b",
                        r"\bdie\b", r"coin (?:is )?(?:flip|toss)", r"expected value",
                        r"equally likely", r"\bodds\b"]),
    ("Combinatorics", 2, [r"how many ways", r"in how many", r"arrangement",
                          r"permutation", r"combination", r"committee",
                          r"handshake", r"\bpaths?\b", r"how many (?:\S+ ){0,3}subsets",
                          r"distinguishable", r"orderings", r"seated", r"license plate",
                          r"how many (?:different |distinct |possible )?(?:\d+-digit |four-digit |three-digit )?(?:numbers|integers|codes|sequences|strings|words)"]),
    ("Number Theory", 2, [r"divisible", r"divisor", r"remainder", r"\bprime",
                          r"\bgcd\b", r"greatest common", r"least common multiple",
                          r"\blcm\b", r"\bfactor\b", r"\bdigits?\b", r"integer[s]? (?:less|greater|between)",
                          r"\bmod\b", r"base[- ](?:two|ten|\d)", r"consecutive integers",
                          r"perfect square", r"\bmultiple of"]),
    ("Sequences & Series", 3, [r"sequence", r"arithmetic progression",
                               r"geometric progression", r"\bseries\b",
                               r"\bterms?\b", r"recursiv", r"fibonacci"]),
    ("Functions", 3, [r"function", r"f\(x\)", r"f\(n\)", r"\bf\s*:\s*",
                      r"graph of\s*\$?y", r"polynomial"]),
    ("Geometry", 1, [r"triangle", r"\bcircle", r"square\b", r"rectang",
                     r"\bangle", r"perimeter", r"\barea\b", r"volume",
                     r"polygon", r"diameter", r"radius", r"radii", r"trapezoid",
                     r"hexagon", r"pentagon", r"octagon", r"\bcube\b", r"sphere",
                     r"midpoint", r"diagonal", r"vertex", r"vertices", r"\bline\b",
                     r"\bpoints?\b", r"collinear", r"parallel", r"perpendicular",
                     r"isosceles", r"equilateral", r"quadrilateral", r"\bchord\b",
                     r"cylinder", r"\bcone\b", r"semicircle", r"\bside\b",
                     r"\[asy\]", r"\bplane\b", r"coordinates"]),
    ("Logic & Word Problems", 2, [r"always tells the truth", r"\blie[sd]?\b",
                                  r"knights?", r"liars?", r"statement[s]? (?:is|are) true",
                                  r"whether", r"logic"]),
    ("Algebra", 1, [r"equation", r"solve", r"\bsum\b", r"\bmean\b", r"average",
                    r"percent", r"ratio", r"\brate\b", r"speed", r"\bages?\b",
                    r"\bcost\b", r"dollars", r"\bvalue of", r"real numbers?",
                    r"\bx\b"]),
]


def classify_topic(text):
    """Keyword-heuristic topic tagger.  Returns (topic, confidence)."""
    low = text.lower()
    scores = {}
    for topic, weight, patterns in TOPIC_RULES:
        hits = sum(len(re.findall(p, low)) for p in patterns)
        if hits:
            scores[topic] = hits * weight
    if not scores:
        return "Algebra", "low"
    ranked = sorted(scores.items(), key=lambda kv: -kv[1])
    top, top_score = ranked[0]
    runner = ranked[1][1] if len(ranked) > 1 else 0
    confidence = "high" if top_score >= 4 and top_score >= 2 * runner else "low"
    return top, confidence


def difficulty_for(number):
    if number <= 8:
        return "easy"
    if number <= 17:
        return "medium"
    return "hard"


def parse_answer_key(html):
    soup = BeautifulSoup(html, "html.parser")
    content = soup.select_one("div.mw-parser-output") or soup
    for ol in content.find_all("ol"):
        letters = [li.get_text(strip=True)[:1].upper() for li in ol.find_all("li")]
        letters = [l for l in letters if l in "ABCDE"]
        if len(letters) == 25:
            return letters
    # fallback: "1. D" style lines
    letters = re.findall(r"^\s*\d+\.\s*\(?([A-E])\)?", content.get_text("\n"),
                         re.MULTILINE)
    if len(letters) >= 25:
        return letters[:25]
    return None


def find_problem_headings(soup):
    """Map problem number -> heading tag from a contest Problems page."""
    headings = {}
    for span in soup.select("span.mw-headline"):
        m = re.fullmatch(r"Problem\s+(\d+)", span.get_text(strip=True))
        if m:
            headings[int(m.group(1))] = heading_node(span)
    return headings


def parse_problem_section(heading):
    """Extract (question_text, choices, diagrams) from a problem section."""
    diagrams = []
    text = "".join(node_text(n, diagrams) for n in section_content(heading))
    # strip trailing "Solution" link stubs
    text = re.sub(r"\n\s*(Solution(?:s)?(?: \d+)?|Video Solution.*)\s*$", "",
                  clean_text(text))
    question, choices = split_choices(text)
    return clean_text(question), choices, diagrams


def parse_solution_page(html):
    """Extract the first written solution from a problem page."""
    soup = BeautifulSoup(html, "html.parser")
    best = None
    for span in soup.select("span.mw-headline"):
        title = span.get_text(strip=True)
        if re.match(r"^Solution", title, re.IGNORECASE) and \
                not re.search(r"video|animated", title, re.IGNORECASE):
            heading = heading_node(span)
            diagrams = []
            text = clean_text(
                "".join(node_text(n, diagrams) for n in section_content(heading)))
            # skip stub sections that only link elsewhere
            if len(text) > 40:
                best = text
                break
    return best


def answer_from_solution(solution):
    """Fallback: pull the answer letter out of the solution's \\boxed{...}."""
    if not solution:
        return None
    for m in re.finditer(r"\\boxed\s*\{", solution):
        window = solution[m.end():m.end() + 80]
        letter = re.search(r"\(\s*([A-E])\s*\)", window)
        if letter:
            return letter.group(1)
    m = re.search(r"answer is\s*\$?\\?(?:textbf|mathrm|text)?\s*\{?\s*\(\s*([A-E])\s*\)",
                  solution)
    return m.group(1) if m else None


def problem_id(slug, number):
    return str(uuid.uuid5(uuid.NAMESPACE_URL,
                          f"{WIKI}/{slug}_Problems/Problem_{number}"))


def normalize_img_url(src):
    if src.startswith("//"):
        return "https:" + src
    if src.startswith("/"):
        return "https://artofproblemsolving.com" + src
    return src


def scrape_contest(year, contest, slug, fixtures_only=False,
                   download_diagrams=True):
    """Scrape one contest; returns (problems, issues)."""
    issues = []
    problems = []

    print(f"== {year} {contest} ({slug})", flush=True)
    problems_html = get_page(f"{slug}_Problems", fixtures_only)
    key_html = get_page(f"{slug}_Answer_Key", fixtures_only)
    if problems_html is None:
        issues.append(f"{slug}: problems page missing")
        return problems, issues
    answers = parse_answer_key(key_html) if key_html else None
    if answers is None:
        issues.append(f"{slug}: answer key missing/unparsed")

    soup = BeautifulSoup(problems_html, "html.parser")
    headings = find_problem_headings(soup)

    for number in range(1, 26):
        question, choices, diagrams = "", [], []
        if number in headings:
            question, choices, diagrams = parse_problem_section(headings[number])

        # fetch the per-problem page for the solution (and as a fallback
        # source for the statement when the contest page lacks it)
        prob_page = get_page(f"{slug}_Problems/Problem_{number}", fixtures_only)
        solution = None
        if prob_page:
            psoup = BeautifulSoup(prob_page, "html.parser")
            if not question or not choices:
                for span in psoup.select("span.mw-headline"):
                    if span.get_text(strip=True).lower().startswith("problem"):
                        q2, c2, d2 = parse_problem_section(heading_node(span))
                        if q2 and (not question or (c2 and not choices)):
                            question, choices = q2, c2
                            diagrams = diagrams or d2
                        break
            solution = parse_solution_page(prob_page)

        if not question:
            issues.append(f"{slug} #{number}: no question text")
            continue
        if len(choices) != 5:
            issues.append(f"{slug} #{number}: choices split failed")
        if not solution:
            issues.append(f"{slug} #{number}: no solution")

        answer_letter = answers[number - 1] if answers else None
        if answer_letter is None:
            answer_letter = answer_from_solution(solution)

        diagram_url = None
        if diagrams:
            src = normalize_img_url(diagrams[0])
            fname = f"{slug}_P{number}.png"
            diagram_url = f"/diagrams/{fname}"
            if download_diagrams and not fixtures_only:
                try:
                    resp = http_get(src)
                    if resp is not None:
                        DIAGRAM_DIR.mkdir(parents=True, exist_ok=True)
                        (DIAGRAM_DIR / fname).write_bytes(resp.content)
                    else:
                        diagram_url = src  # keep remote URL if download failed
                except Exception as exc:
                    issues.append(f"{slug} #{number}: diagram fetch failed {exc}")
                    diagram_url = src

        topic, topic_confidence = classify_topic(
            question + " " + " ".join(choices))

        problems.append({
            "id": problem_id(slug, number),
            "year": year,
            "contest": contest,
            "number": number,
            "topic": topic,
            "topic_confidence": topic_confidence,
            "difficulty": difficulty_for(number),
            "question": question,
            "choices": choices,
            "answer": "ABCDE".index(answer_letter) if answer_letter else None,
            "answer_letter": answer_letter,
            "solution": solution,
            "has_diagram": bool(diagrams),
            "diagram_url": diagram_url,
            "aops_url": f"{WIKI}/{slug}_Problems/Problem_{number}",
        })
    return problems, issues


# ---------------------------------------------------------------- modes

FIXTURE_PAGES = [
    "2015_AMC_10A_Problems",
    "2015_AMC_10A_Answer_Key",
    "2015_AMC_10A_Problems/Problem_1",
    "2015_AMC_10A_Problems/Problem_19",
    "2000_AMC_10_Problems",
    "2000_AMC_10_Answer_Key",
    "2000_AMC_10_Problems/Problem_16",
    "2003_AMC_10A_Problems",
    "2003_AMC_10A_Answer_Key",
    "2003_AMC_10A_Problems/Problem_25",
    "2021_Fall_AMC_10B_Problems",
    "2021_Fall_AMC_10B_Answer_Key",
    "2021_Fall_AMC_10B_Problems/Problem_5",
    "2024_AMC_10A_Problems",
    "2024_AMC_10A_Answer_Key",
    "2024_AMC_10A_Problems/Problem_12",
]


def mode_fixtures():
    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    for page in FIXTURE_PAGES:
        out = FIXTURE_DIR / (page.replace("/", "__") + ".html")
        print(f"fetch {page}", flush=True)
        resp = http_get(f"{WIKI}/{page}")
        if resp is None:
            print(f"  !! 404 {page}", flush=True)
            continue
        out.write_text(resp.text, encoding="utf-8")
    print("fixtures saved to scripts/fixtures/", flush=True)


def run_scrape(contests, out_path, fixtures_only=False):
    all_problems, all_issues = [], []
    for year, contest, slug in contests:
        problems, issues = scrape_contest(year, contest, slug,
                                          fixtures_only=fixtures_only)
        all_problems.extend(problems)
        all_issues.extend(issues)
        print(f"   {len(problems)} problems, {len(issues)} issues total so far "
              f"({len(all_problems)} scraped)", flush=True)

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(all_problems, indent=1), encoding="utf-8")

    report = {
        "total_problems": len(all_problems),
        "contests": len(contests),
        "with_choices": sum(1 for p in all_problems if len(p["choices"]) == 5),
        "with_answer": sum(1 for p in all_problems if p["answer"] is not None),
        "with_solution": sum(1 for p in all_problems if p["solution"]),
        "with_diagram": sum(1 for p in all_problems if p["has_diagram"]),
        "low_confidence_topics": sum(
            1 for p in all_problems if p["topic_confidence"] == "low"),
        "issues": all_issues,
    }
    (DATA_DIR / "scrape-report.json").write_text(
        json.dumps(report, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in report.items() if k != "issues"},
                     indent=1), flush=True)
    print(f"{len(all_issues)} issues -> data/scrape-report.json", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["fixtures", "parse-fixtures", "test",
                                       "full"], required=True)
    args = ap.parse_args()

    if args.mode == "fixtures":
        mode_fixtures()
    elif args.mode == "parse-fixtures":
        contests = [(2015, "AMC10A", "2015_AMC_10A"),
                    (2000, "AMC10", "2000_AMC_10"),
                    (2003, "AMC10A", "2003_AMC_10A"),
                    (2021, "AMC10B Fall", "2021_Fall_AMC_10B"),
                    (2024, "AMC10A", "2024_AMC_10A")]
        run_scrape(contests, DATA_DIR / "problems.sample.json",
                   fixtures_only=True)
    elif args.mode == "test":
        run_scrape([(2015, "AMC10A", "2015_AMC_10A")],
                   DATA_DIR / "problems.sample.json")
    else:
        run_scrape(contest_list(), DATA_DIR / "problems.json")


if __name__ == "__main__":
    main()
