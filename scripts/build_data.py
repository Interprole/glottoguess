#!/usr/bin/env python3
"""Build the compact JSON files used by the LangBang frontend.

Reads the CLDF releases downloaded by ``scripts/fetch_data.py`` (in ./raw/) and
writes ``public/data/``:

    core.json        languages + classification tree + macroareas (first load)
    names.json       alternative names for autocomplete (loaded right after start)
    grambank.json    Grambank values as one compact string per language (lazy)
    features.json    Grambank features + human-readable texts (lazy)
    bib/xx.json      a few Glottolog references per language, sharded by
                     the first two letters of the Glottocode (lazy, per card)
    meta.json        dataset versions, citations and build statistics

Only the Python standard library is used: CLDF tables are plain CSV files with
the column names given by the CLDF metadata, which is all we need here.

Usage:
    python scripts/build_data.py [--raw raw] [--out public/data]
"""
from __future__ import annotations

import argparse
import collections
import csv
import io
import json
import math
import random
import re
import statistics
import sys
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Iterator

ROOT = Path(__file__).resolve().parent.parent

csv.field_size_limit(sys.maxsize)

MACROAREAS = ["Africa", "Australia", "Eurasia", "North America", "Papunesia", "South America"]

# Normal-difficulty criterion ("reasonably well-known languages"): a puzzle-
# eligible language qualifies if EITHER
#   (a) it is in the WALS 200-language sample (the canonical typological
#       sample, which favours well-described, often large languages), OR
#   (b) it is documented in Grambank or WALS *and* has Wikipedia articles in at
#       least NORMAL_MIN_WIKI_EDITIONS language editions.  Glottolog ships the
#       Wikipedia-derived names (provider "lexvo"), one per edition; the count
#       is a noisy but reproducible proxy for public recognition (German only
#       has 6 such names, hence (a)).
NORMAL_MIN_WIKI_EDITIONS = 10

# Grambank similarity: compare two languages only on features known (0/1/2/3,
# not "?" and not missing) for both, and only if they share at least this many.
MIN_SHARED_FEATURES = 50

# Non-genealogical Glottolog categories ("pseudo families").
CATEGORY_CODES = {
    "Spoken_L1_Language": "",
    "Sign_Language": "sign",
    "Pidgin": "pidgin",
    "Mixed_Language": "mixed",
    "Artificial_Language": "artificial",
    "Unclassifiable": "unclassifiable",
    "Unattested": "unattested",
    "Speech_Register": "register",
}

FLAG_GRAMBANK, FLAG_WALS, FLAG_NORMAL, FLAG_HARD = 1, 2, 4, 8

HHTYPE_RANK = {
    "grammar": 0,
    "grammar_sketch": 1,
    "dictionary": 2,
    "phonology": 3,
    "specific_feature": 4,
    "text": 5,
    "new_testament": 6,
    "wordlist": 7,
    "comparative": 8,
    "overview": 8,
    "ethnographic": 9,
    "sociolinguistic": 9,
    "dialectology": 9,
    "bibliographical": 10,
    "minimal": 11,
    "unknown": 12,
}
MAX_REFS = 5
ALT_NAME_PROVIDERS_EXCLUDED = {"lexvo"}  # lexvo: only "en" names are used


# --------------------------------------------------------------------------- io

def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def write_json(path: Path, obj) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), sort_keys=False)
    path.write_text(data, encoding="utf-8")
    return len(data.encode("utf-8"))


def fnum(x: str) -> float | None:
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if math.isfinite(v) else None


# -------------------------------------------------------------------- glottolog

@dataclass
class Languoid:
    id: str
    name: str
    level: str
    macroareas: list[str]
    lat: float | None
    lon: float | None
    iso: str
    countries: list[str]
    family_id: str
    language_id: str  # for dialects: the language-level ancestor
    is_isolate: bool
    category: str = ""
    parent: str | None = None
    aes: int | None = None
    med_source: str | None = None
    medovertime_sources: list[str] = field(default_factory=list)
    bib_sources: list[str] = field(default_factory=list)


def split_sources(value: str) -> list[str]:
    """``'123[45-67];890'`` -> ``['123', '890']``"""
    out = []
    for s in (value or "").split(";"):
        s = s.strip()
        if not s:
            continue
        out.append(s.split("[", 1)[0])
    return out


def load_glottolog(gdir: Path) -> dict[str, Languoid]:
    cldf = gdir / "cldf"
    langs: dict[str, Languoid] = {}
    for r in read_csv(cldf / "languages.csv"):
        langs[r["ID"]] = Languoid(
            id=r["ID"],
            name=r["Name"],
            level=r["Level"],
            macroareas=[m for m in r["Macroarea"].split(";") if m],
            lat=fnum(r["Latitude"]),
            lon=fnum(r["Longitude"]),
            iso=r.get("ISO639P3code", "") or "",
            countries=[c for c in r.get("Countries", "").split(";") if c],
            family_id=r.get("Family_ID", "") or "",
            language_id=r.get("Language_ID", "") or "",
            is_isolate=(r.get("Is_Isolate") == "true"),
        )
    for r in read_csv(cldf / "values.csv"):
        lg = langs.get(r["Language_ID"])
        if lg is None:
            continue
        p = r["Parameter_ID"]
        if p == "category":
            lg.category = r["Value"]
        elif p == "classification":
            path = [x for x in r["Value"].split("/") if x]
            lg.parent = path[-1] if path else None
        elif p == "aes":
            try:
                lg.aes = int(r["Value"])
            except ValueError:
                pass
        elif p == "med":
            srcs = split_sources(r["Source"])
            lg.med_source = srcs[0] if srcs else None
        elif p == "medovertime":
            lg.medovertime_sources = split_sources(r["Source"])
        elif p == "bib":
            lg.bib_sources = split_sources(r["Source"])
    return langs


def load_names(gdir: Path, ids: set[str]) -> dict[str, list[str]]:
    """Alternative names: all providers, but of the Wikipedia-derived lexvo names only English ones."""
    alt: dict[str, list[str]] = collections.defaultdict(list)
    for r in read_csv(gdir / "cldf" / "names.csv"):
        gc = r["Language_ID"]
        if gc not in ids:
            continue
        name = r["Name"].strip()
        if not name or name.lower() == "not specified" or len(name) > 60:
            continue
        if r["Provider"] in ALT_NAME_PROVIDERS_EXCLUDED:
            if r["lang"] != "en":
                continue
            name = re.sub(r"\s+language$", "", name, flags=re.I)
        alt[gc].append(name)
    return alt


# ------------------------------------------------------------------- the tree

@dataclass
class Tree:
    languages: dict[str, Languoid]
    families: dict[str, Languoid]
    family_area: dict[str, str]   # top-level family -> dominant macroarea
    language_area: dict[str, str]  # language -> "own" macroarea


def is_genealogical(lg: Languoid, langs: dict[str, Languoid]) -> bool:
    """True if the languoid sits in a real family (not a pseudo-family, not an isolate)."""
    if not lg.family_id:
        return False
    fam = langs.get(lg.family_id)
    return fam is not None and fam.category == "Family"


def build_tree(langs: dict[str, Languoid]) -> Tree:
    languages: dict[str, Languoid] = {}
    families: dict[str, Languoid] = {}
    for lg in langs.values():
        if lg.level != "language" or lg.category == "Bookkeeping":
            continue
        if lg.category not in CATEGORY_CODES:
            continue
        languages[lg.id] = lg
        if not is_genealogical(lg, langs):
            lg.parent = None  # isolates and pseudo-family members stand alone
            continue
        p = lg.parent
        while p:
            fam = langs[p]
            if p in families:
                break
            families[p] = fam
            p = fam.parent

    # dominant macroarea per top-level family (first listed area of each member)
    votes: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    for lg in languages.values():
        if lg.parent and lg.macroareas:
            for m in lg.macroareas:
                votes[lg.family_id][m] += 1 / len(lg.macroareas)
    family_area = {}
    for fid, fam in families.items():
        if fam.parent is None:
            c = votes.get(fid)
            if c:
                # deterministic tie-break: alphabetical
                family_area[fid] = sorted(c.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
            elif fam.macroareas:
                family_area[fid] = fam.macroareas[0]

    language_area = {}
    for lg in languages.values():
        fam_area = family_area.get(lg.family_id) if lg.parent else None
        if fam_area and (fam_area in lg.macroareas or not lg.macroareas):
            language_area[lg.id] = fam_area
        elif lg.macroareas:
            language_area[lg.id] = lg.macroareas[0]
        elif fam_area:
            language_area[lg.id] = fam_area
    return Tree(languages, families, family_area, language_area)


def lineage(gc: str, tree: Tree) -> list[str]:
    """Path from the top-level family down to (and including) the languoid."""
    out = [gc]
    node = tree.languages.get(gc) or tree.families.get(gc)
    while node is not None and node.parent:
        out.append(node.parent)
        node = tree.families.get(node.parent)
    return out[::-1]


def game_path(gc: str, tree: Tree) -> list[str]:
    """Path used by the guessing game: world > macroarea > families... > language.

    Mirrors ``pathTo`` in src/lib/tree.ts.
    """
    lin = lineage(gc, tree)
    top = lin[0]
    area = tree.family_area.get(top) if top in tree.families else tree.language_area.get(gc)
    return ["_world"] + ([f"_area:{area}"] if area else []) + lin


def lowest_common_ancestor(a: list[str], b: list[str]) -> str:
    last = a[0]
    for x, y in zip(a, b):
        if x != y:
            break
        last = x
    return last


# ------------------------------------------------------------------- grambank

def load_grambank(gbdir: Path, langs: dict[str, Languoid]):
    cldf = gbdir / "cldf"
    params = read_csv(cldf / "parameters.csv")
    feature_ids = [p["ID"] for p in params]
    fidx = {f: i for i, f in enumerate(feature_ids)}
    gb_langs = read_csv(cldf / "languages.csv")

    # map Grambank languoids to Glottolog language-level languoids
    mapping: dict[str, str] = {}
    unmapped = []
    direct = set()
    for r in gb_langs:
        gc = r["Glottocode"] or r["ID"]
        lg = langs.get(gc)
        if lg is None:
            unmapped.append(gc)
            continue
        if lg.level == "language":
            mapping[r["ID"]] = gc
            direct.add(gc)
        elif lg.level == "dialect" and lg.language_id:
            mapping[r["ID"]] = lg.language_id
        else:
            unmapped.append(gc)
    # a dialect only stands in for its language if the language itself is absent
    dropped_dialects = 0
    for k, v in list(mapping.items()):
        if k != v and v in direct:
            del mapping[k]
            dropped_dialects += 1
    seen_targets: dict[str, str] = {}
    for k, v in sorted(mapping.items()):
        if v in seen_targets and seen_targets[v] != k:
            del mapping[k]
            dropped_dialects += 1
        else:
            seen_targets[v] = k

    rows: dict[str, list[str]] = {}
    for r in read_csv(cldf / "values.csv"):
        gc = mapping.get(r["Language_ID"])
        if gc is None:
            continue
        row = rows.setdefault(gc, ["-"] * len(feature_ids))
        v = r["Value"].strip()
        row[fidx[r["Parameter_ID"]]] = v if v in {"0", "1", "2", "3", "?"} else "-"
    codes: dict[str, dict[str, str]] = collections.defaultdict(dict)
    for r in read_csv(cldf / "codes.csv"):
        codes[r["Parameter_ID"]][r["Name"]] = r["Description"]

    groupings = {}
    gpath = gbdir / "docs" / "feature_groupings" / "feature_grouping_for_analysis.csv"
    if gpath.exists():
        for r in read_csv(gpath):
            groupings[r["Feature_ID"]] = (r["Main_domain"], r["Finer_grouping"])

    meta = json.loads((cldf / "StructureDataset-metadata.json").read_text(encoding="utf-8"))
    return {
        "params": params,
        "feature_ids": feature_ids,
        "values": {k: "".join(v) for k, v in rows.items()},
        "codes": codes,
        "groupings": groupings,
        "unmapped": unmapped,
        "dropped_dialects": dropped_dialects,
        "citation": meta.get("dc:bibliographicCitation", ""),
    }


def similarity(a: str, b: str, skip: int | None = None, min_shared: int = MIN_SHARED_FEATURES) -> float | None:
    """Share of agreeing values over features known in *both* languages.

    '?' and '-' (missing) are never treated as "absent": such features are
    simply left out of the comparison.  Returns None when fewer than
    ``min_shared`` features are known for both.  Mirrors src/lib/typology.ts.
    """
    shared = agree = 0
    for i, (x, y) in enumerate(zip(a, b)):
        if i == skip or x in "?-" or y in "?-":
            continue
        shared += 1
        if x == y:
            agree += 1
    if shared < min_shared:
        return None
    return agree / shared


def summary_paragraph(description: str) -> str:
    m = re.search(r"## Summary\s*\n(.*?)(\n\s*\n|\n##)", description, flags=re.S)
    text = m.group(1) if m else ""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)  # markdown links -> text
    text = re.sub(r"(\*\*|\*|__)(.+?)\1", r"\2", text)  # emphasis markers
    text = re.sub(r"\s+", " ", text).strip()
    return text


# --------------------------------------------------------------- bibliography

FIELD_RE = re.compile(r"^\s+(\w+) = \{(.*)\},?\s*$")
ENTRY_RE = re.compile(r"^@(\w+)\{([^,]+),\s*$")


def iter_bib(lines: Iterable[str], wanted: set[str]) -> Iterator[tuple[str, str, dict[str, str]]]:
    """Minimal streaming BibTeX reader for Glottolog's normalized sources.bib.

    Only entries whose key is in ``wanted`` are parsed.  Glottolog writes one
    field per line (``    name = {value},``), which is what we rely on.
    """
    key = None
    etype = ""
    fields: dict[str, str] = {}
    for line in lines:
        if key is None:
            if line.startswith("@"):
                m = ENTRY_RE.match(line)
                if m and m.group(2) in wanted:
                    etype, key, fields = m.group(1).lower(), m.group(2), {}
            continue
        if line.startswith("}"):
            yield key, etype, fields
            key = None
            continue
        m = FIELD_RE.match(line)
        if m:
            fields[m.group(1)] = m.group(2)


def clean_tex(s: str) -> str:
    s = re.sub(r"\\[a-zA-Z]+\s*\{([^{}]*)\}", r"\1", s)
    s = s.replace("{", "").replace("}", "").replace("\\&", "&").replace("--", "–")
    return re.sub(r"\s+", " ", s).strip()


def format_authors(s: str) -> str:
    people = [clean_tex(p) for p in re.split(r"\s+and\s+", s) if p.strip()]
    people = [p for p in people if p and p.strip("_ ,") and p != "others"]
    if not people:
        return ""
    if len(people) > 3:
        return f"{people[0]} et al."
    return " & ".join(people)


def format_reference(etype: str, f: dict[str, str]) -> str:
    authors = format_authors(f.get("author", "") or f.get("editor", ""))
    if not f.get("author") and f.get("editor") and authors:
        authors += " (ed.)"
    year = clean_tex(f.get("year", "")) or "n.d."
    title = clean_tex(f.get("title", "")).rstrip(".")
    if authors and not authors.endswith("."):
        authors += "."
    parts = [f"{authors + ' ' if authors else ''}{year}.", f"{title}."]
    if etype == "article" and f.get("journal"):
        j = clean_tex(f["journal"])
        if f.get("volume"):
            j += " " + clean_tex(f["volume"])
        if f.get("pages"):
            j += ": " + clean_tex(f["pages"])
        parts.append(j + ".")
    elif etype in {"incollection", "inproceedings"} and f.get("booktitle"):
        parts.append("In " + clean_tex(f["booktitle"]) + ".")
    elif f.get("school"):
        parts.append(clean_tex(f["school"]) + ".")
    address, publisher = clean_tex(f.get("address", "")), clean_tex(f.get("publisher", ""))
    if address and publisher.startswith(address):
        address = ""
    pub = ": ".join(x for x in (address, publisher) if x)
    if pub and etype != "article":
        parts.append(pub if pub.endswith(".") else pub + ".")
    text = " ".join(p for p in parts if p.strip(". "))
    return text[:400]


def hhtype_of(f: dict[str, str]) -> str:
    raw = f.get("hhtype", "")
    first = re.split(r"[;(]", raw)[0].strip()
    return first or "unknown"


def select_refs(lg: Languoid, entries: dict[str, tuple[str, dict[str, str]]], limit: int = MAX_REFS) -> list[str]:
    """Pick a few informative references: the most extensive description first,
    then grammars > sketches > dictionaries > ..., newest first within a type."""
    chosen: list[str] = []
    if lg.med_source and lg.med_source in entries:
        chosen.append(lg.med_source)
    pool = set(lg.bib_sources) | set(lg.medovertime_sources)
    pool.discard(lg.med_source or "")

    def key(k: str):
        f = entries[k][1]
        m = re.search(r"\d{4}", f.get("year", ""))
        year = int(m.group(0)) if m else 0
        return (HHTYPE_RANK.get(hhtype_of(f), 12), -year, k)

    seen = {title_key(entries[k][1]) for k in chosen}
    for k in sorted((k for k in pool if k in entries), key=key):
        if len(chosen) >= limit:
            break
        tk = title_key(entries[k][1])
        if tk in seen:  # Glottolog often lists the same work from several catalogues
            continue
        seen.add(tk)
        chosen.append(k)
    return chosen


def title_key(f: dict[str, str]) -> str:
    year = re.search(r"\d{4}", f.get("year", ""))
    title = re.sub(r"[^\w]", "", clean_tex(f.get("title", "")).casefold())[:20]
    return f"{year.group(0) if year else ''}:{title}"


def open_bib(gdir: Path) -> Iterator[str]:
    plain = gdir / "cldf" / "sources.bib"
    if plain.exists():
        with plain.open(encoding="utf-8") as f:
            yield from f
        return
    zpath = gdir / "cldf" / "sources.bib.zip"
    if not zpath.exists():
        return
    with zipfile.ZipFile(zpath) as z:
        with z.open("sources.bib") as raw:
            yield from io.TextIOWrapper(raw, encoding="utf-8")


# ----------------------------------------------------------------------- main

def load_wals(wdir: Path) -> tuple[set[str], set[str]]:
    """Glottocodes of all WALS languages and of those in the 200-language sample."""
    path = wdir / "cldf" / "languages.csv"
    if not path.exists():
        return set(), set()
    rows = [r for r in read_csv(path) if r.get("Glottocode")]
    return {r["Glottocode"] for r in rows}, {r["Glottocode"] for r in rows if r.get("Samples_200") == "true"}


def load_speakers(lmdir: Path, langs: dict[str, Languoid]) -> dict[str, int]:
    """Estimated number of speakers from LinguaMeta, keyed by Glottolog language-level Glottocode.

    Rows are matched by Glottocode (dialect codes are lifted to their language),
    falling back to the ISO 639-3 code; macrolanguage rows are skipped.  When
    several rows map to one language the largest estimate is kept.
    """
    path = lmdir / "linguameta" / "linguameta.tsv"
    if not path.exists():
        return {}
    by_iso = {lg.iso: gc for gc, lg in langs.items() if lg.iso and lg.level == "language"}
    out: dict[str, int] = {}
    with path.open(encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f, delimiter="\t"):
            if r.get("is_macrolanguage") == "True" or not r.get("estimated_number_of_speakers"):
                continue
            try:
                n = int(float(r["estimated_number_of_speakers"]))
            except ValueError:
                continue
            gc = r.get("glottocode") or ""
            lg = langs.get(gc)
            if lg is not None and lg.level == "dialect" and lg.language_id:
                gc = lg.language_id
            elif lg is None or lg.level != "language":
                gc = by_iso.get(r.get("iso_639_3_code") or "", "")
            if gc:
                out[gc] = max(n, out.get(gc, 0))
    return out


def wiki_edition_counts(gdir: Path) -> collections.Counter:
    c: collections.Counter = collections.Counter()
    for r in read_csv(gdir / "cldf" / "names.csv"):
        if r["Provider"] == "lexvo":
            c[r["Language_ID"]] += 1
    return c


def load_feature_texts(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    return {e["id"]: e for e in json.loads(path.read_text(encoding="utf-8"))}


def grambank_citation(raw: str) -> str:
    """Grambank's metadata still says '(in press)'; the paper appeared in 2023."""
    c = raw.replace("(in press)", "2023")
    c = re.sub(r"Science Advances\.\s*$", "Science Advances 9(16): eadg6175. https://doi.org/10.1126/sciadv.adg6175", c)
    return c


def build(raw: Path, out: Path, feature_texts_path: Path, with_bib: bool = True, log=print) -> dict:
    datasets = json.loads((ROOT / "scripts" / "datasets.json").read_text(encoding="utf-8"))
    gdir, gbdir, wdir = raw / "glottolog", raw / "grambank", raw / "wals"

    langs = load_glottolog(gdir)
    tree = build_tree(langs)
    gb = load_grambank(gbdir, langs)
    wals, wals200 = load_wals(wdir)
    wiki = wiki_edition_counts(gdir)
    alt = load_names(gdir, set(tree.languages))
    speakers = load_speakers(raw / "linguameta", langs)

    # ------------------------------------------------------------- core.json
    families_out = {}
    for fid, fam in sorted(tree.families.items()):
        row = [fam.name, fam.parent]
        if fam.parent is None:
            row.append(tree.family_area.get(fid))
        families_out[fid] = row

    languages_out = {}
    pools = {"normal": [], "hard": []}
    for gc, lg in sorted(tree.languages.items()):
        flags = 0
        if gc in gb["values"]:
            flags |= FLAG_GRAMBANK
        if gc in wals:
            flags |= FLAG_WALS
        eligible = (
            lg.category == "Spoken_L1_Language"
            and lg.parent is not None
            and not lg.is_isolate
            and lg.lat is not None
            and lg.lon is not None
        )
        if eligible:
            flags |= FLAG_HARD
            pools["hard"].append(gc)
            known = wiki[gc] >= NORMAL_MIN_WIKI_EDITIONS and flags & (FLAG_GRAMBANK | FLAG_WALS)
            if gc in wals200 or known:
                flags |= FLAG_NORMAL
                pools["normal"].append(gc)
        languages_out[gc] = [
            lg.name,
            lg.parent,
            tree.language_area.get(gc),
            round(lg.lat, 3) if lg.lat is not None else None,
            round(lg.lon, 3) if lg.lon is not None else None,
            lg.aes,
            ";".join(lg.countries),
            lg.iso,
            CATEGORY_CODES[lg.category],
            flags,
            speakers.get(gc),
        ]

    sizes = {}
    sizes["core.json"] = write_json(out / "core.json", {
        "format": 1,
        "areas": MACROAREAS,
        "families": families_out,
        "languages": languages_out,
    })

    # ------------------------------------------------------------ names.json
    names_out = {}
    for gc in sorted(alt):
        main = tree.languages[gc].name.casefold()
        seen = {main}
        uniq = []
        for n in alt[gc]:
            k = n.casefold()
            if k not in seen:
                seen.add(k)
                uniq.append(n)
        if uniq:
            names_out[gc] = uniq
    sizes["names.json"] = write_json(out / "names.json", names_out)

    # ---------------------------------------------------------- grambank.json
    gb_values = {gc: v for gc, v in sorted(gb["values"].items()) if gc in tree.languages}
    sizes["grambank.json"] = write_json(out / "grambank.json", {
        "features": gb["feature_ids"],
        "values": gb_values,
    })

    # ---------------------------------------------------------- features.json
    texts = load_feature_texts(feature_texts_path)
    features_out = []
    missing_texts = []
    for p in gb["params"]:
        fid = p["ID"]
        t = texts.get(fid)
        if t is None:
            missing_texts.append(fid)
        domain, finer = gb["groupings"].get(fid, ("", ""))
        features_out.append({
            "id": fid,
            "name": p["Name"],
            "domain": domain,
            "group": finer,
            "values": gb["codes"].get(fid, {}),
            "summary": summary_paragraph(p["Description"]),
            "en": (t or {}).get("en"),
        })
    sizes["features.json"] = write_json(out / "features.json", features_out)

    # -------------------------------------------------------------- bib/*.json
    n_refs = 0
    if with_bib:
        wanted: set[str] = set()
        for lg in tree.languages.values():
            wanted.update(lg.bib_sources)
            wanted.update(lg.medovertime_sources)
            if lg.med_source:
                wanted.add(lg.med_source)
        entries = {k: (t, f) for k, t, f in iter_bib(open_bib(gdir), wanted)}
        shards: dict[str, dict] = collections.defaultdict(dict)
        for gc, lg in sorted(tree.languages.items()):
            refs = select_refs(lg, entries)
            if refs:
                shards[gc[:2]][gc] = [
                    [k, format_reference(entries[k][0], entries[k][1]), hhtype_of(entries[k][1])]
                    for k in refs
                ]
                n_refs += len(refs)
        bibdir = out / "bib"
        if bibdir.exists():
            for old in bibdir.glob("*.json"):
                old.unlink()
        total = 0
        for shard, obj in sorted(shards.items()):
            total += write_json(bibdir / f"{shard}.json", obj)
        sizes["bib/*.json"] = total

    # ------------------------------------------------------------- statistics
    stats = compute_stats(tree, pools, gb_values, gb["feature_ids"], gb)
    stats["references"] = n_refs
    stats["speakers_known"] = sum(1 for gc in tree.languages if gc in speakers)
    stats["speakers_known_normal"] = sum(1 for gc in pools["normal"] if gc in speakers)
    stats["speakers_known_hard"] = sum(1 for gc in pools["hard"] if gc in speakers)
    stats["missing_feature_texts"] = missing_texts
    stats["sizes_bytes"] = sizes

    citations = {k: v["citation"] for k, v in datasets.items()}
    if gb["citation"]:
        citations["grambank"] = grambank_citation(gb["citation"])
    meta = {
        "datasets": {
            k: {"title": v["title"], "tag": v.get("tag") or v["commit"][:10], "repo": v["repo"], "url": v["url"],
                "ref_url": (f"https://github.com/{v['repo']}/releases/tag/{v['tag']}" if v.get("tag")
                            else f"https://github.com/{v['repo']}/tree/{v['commit']}/{v.get('sparse', '')}".rstrip("/")),
                "license": v["license"], "citation": citations[k]}
            for k, v in datasets.items()
        },
        "normal_min_wiki_editions": NORMAL_MIN_WIKI_EDITIONS,
        "min_shared_features": MIN_SHARED_FEATURES,
        "stats": {k: v for k, v in stats.items() if k not in {"missing_feature_texts", "sizes_bytes"}},
    }
    write_json(out / "meta.json", meta)
    log_stats(stats, log)
    return stats


def compute_stats(tree: Tree, pools, gb_values: dict[str, str], feature_ids: list[str], gb) -> dict:
    depths = {k: [len(game_path(gc, tree)) - 1 for gc in v] for k, v in pools.items()}
    fam_depth = [len(lineage(gc, tree)) - 1 for gc in pools["hard"]]
    # Typology: a (feature, value) template is usable if >=1 language has the
    # value and >=3 languages have a different *known* value.
    templates = 0
    answers = 0
    usable_features = 0
    for i, fid in enumerate(feature_ids):
        counts = collections.Counter(v[i] for v in gb_values.values() if v[i] not in "?-")
        total = sum(counts.values())
        ok = False
        for val, n in counts.items():
            if n >= 1 and total - n >= 3:
                templates += 1
                answers += n
                ok = True
        usable_features += ok
    # hard-mode feasibility on a deterministic sample
    rng = random.Random(42)
    langs_sorted = sorted(gb_values)
    feasible = tried = 0
    for _ in range(300):
        i = rng.randrange(len(feature_ids))
        cands = [gc for gc in langs_sorted if gb_values[gc][i] not in "?-"]
        if len(cands) < 4:
            continue
        tgt = rng.choice(cands)
        others = [gc for gc in cands if gb_values[gc][i] != gb_values[tgt][i]]
        sims = [s for gc in others if (s := similarity(gb_values[tgt], gb_values[gc], skip=i)) is not None]
        tried += 1
        feasible += len(sims) >= 3
    return {
        "languages_total": len(tree.languages),
        "families_total": len(tree.families),
        "top_level_families": sum(1 for f in tree.families.values() if f.parent is None),
        "pool_normal": len(pools["normal"]),
        "pool_hard": len(pools["hard"]),
        "tree_depth_max": max(fam_depth) if fam_depth else 0,
        "tree_depth_mean": round(statistics.mean(fam_depth), 2) if fam_depth else 0,
        "game_path_mean_normal": round(statistics.mean(depths["normal"]), 2) if depths["normal"] else 0,
        "game_path_mean_hard": round(statistics.mean(depths["hard"]), 2) if depths["hard"] else 0,
        "grambank_languages": len(gb_values),
        "grambank_unmapped": len(gb["unmapped"]),
        "grambank_dropped_dialects": gb["dropped_dialects"],
        "grambank_features": len(feature_ids),
        "typology_usable_features": usable_features,
        "typology_templates": templates,
        "typology_answer_instances": answers,
        "typology_hard_feasible_share": round(feasible / tried, 3) if tried else 0,
    }


def log_stats(stats: dict, log) -> None:
    log("=" * 64)
    log("LangBang data build — statistics")
    log("=" * 64)
    for k, v in stats.items():
        if k == "missing_feature_texts":
            log(f"{k:32} {len(v)} {v[:8]}{'…' if len(v) > 8 else ''}")
        elif k == "sizes_bytes":
            for f, s in v.items():
                log(f"  size {f:26} {s / 1024:9.1f} KiB")
        else:
            log(f"{k:32} {v}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--raw", type=Path, default=ROOT / "raw")
    ap.add_argument("--out", type=Path, default=ROOT / "public" / "data")
    ap.add_argument("--feature-texts", type=Path, default=ROOT / "data" / "feature_texts.json")
    ap.add_argument("--no-bib", action="store_true", help="skip the (slow) bibliography step")
    args = ap.parse_args()
    for d in ("glottolog", "grambank"):
        if not (args.raw / d / "cldf").exists():
            print(f"missing {args.raw / d}; run scripts/fetch_data.py first", file=sys.stderr)
            return 1
    build(args.raw, args.out, args.feature_texts, with_bib=not args.no_bib)
    return 0


if __name__ == "__main__":
    sys.exit(main())
