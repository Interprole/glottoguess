import json
from pathlib import Path

import build_data as bd


def test_split_sources():
    assert bd.split_sources("12[3-4];56;; 78[x]") == ["12", "56", "78"]
    assert bd.split_sources("") == []


def test_tree_structure(raw: Path):
    langs = bd.load_glottolog(raw / "glottolog")
    tree = bd.build_tree(langs)
    # bookkeeping and dialects are excluded, pseudo-family members and isolates stand alone
    assert set(tree.languages) == {"aaaa1234", "abab1234", "acac1234", "baba1234", "isol1234", "sgnl1234"}
    assert tree.languages["sgnl1234"].parent is None
    assert tree.languages["isol1234"].parent is None
    assert set(tree.families) == {"alph1234", "nort1234", "beta1234"}
    # Alpha: votes Eurasia 3.5 vs Africa 0.5
    assert tree.family_area == {"alph1234": "Eurasia", "beta1234": "Africa"}
    # Ac is listed as Africa;Eurasia - it gets its family's area since that is among its own
    assert tree.language_area["acac1234"] == "Eurasia"
    assert tree.language_area["isol1234"] == "Papunesia"


def test_game_path_and_lca(raw: Path):
    tree = bd.build_tree(bd.load_glottolog(raw / "glottolog"))
    aa = bd.game_path("aaaa1234", tree)
    ab = bd.game_path("abab1234", tree)
    ac = bd.game_path("acac1234", tree)
    ba = bd.game_path("baba1234", tree)
    iso = bd.game_path("isol1234", tree)
    sign = bd.game_path("sgnl1234", tree)
    assert aa == ["_world", "_area:Eurasia", "alph1234", "nort1234", "aaaa1234"]
    assert bd.lowest_common_ancestor(aa, ab) == "nort1234"
    assert bd.lowest_common_ancestor(aa, ac) == "alph1234"
    assert bd.lowest_common_ancestor(aa, ba) == "_world"
    assert iso == ["_world", "_area:Papunesia", "isol1234"]
    # a sign language in Eurasia shares only the (non-genealogical) macroarea with Aa
    assert bd.lowest_common_ancestor(aa, sign) == "_area:Eurasia"
    assert bd.lowest_common_ancestor(aa, aa) == "aaaa1234"


def test_grambank_mapping_and_missing_values(raw: Path):
    langs = bd.load_glottolog(raw / "glottolog")
    gb = bd.load_grambank(raw / "grambank", langs)
    # the dialect stands in for its language; the retired code is reported
    assert set(gb["values"]) == {"aaaa1234", "abab1234", "baba1234"}
    assert gb["unmapped"] == ["gone1234"]
    # '?' is kept as '?', never converted into 0
    assert gb["values"]["aaaa1234"] == "12?"
    assert gb["values"]["baba1234"] == "?10"
    assert gb["groupings"]["GB020"] == ("nominal domain", "deixis")


def test_similarity_ignores_unknowns():
    a = "1100?-"
    b = "10?0-1"
    # comparable positions: 0 (1/1 agree), 1 (1/0 disagree), 3 (0/0 agree)
    assert bd.similarity(a, b, min_shared=3) == 2 / 3
    assert bd.similarity(a, b, min_shared=4) is None
    # skipping the asked feature removes it from the comparison
    assert bd.similarity(a, b, skip=1, min_shared=2) == 1.0
    # all-unknown languages are never "similar" (and never treated as all-0)
    assert bd.similarity("????", "0000", min_shared=1) is None


def test_summary_paragraph():
    d = "## Q?\n\n## Summary\nAn [article](http://x) is a marker.\nSecond line.\n\n## Procedure\n1."
    assert bd.summary_paragraph(d) == "An article is a marker. Second line."
    assert bd.summary_paragraph("") == ""
    assert bd.summary_paragraph("## Summary\nSay *I don't* or **no**.\n\n") == "Say I don't or no."


def test_bib_reader_and_reference_selection(raw: Path):
    langs = bd.load_glottolog(raw / "glottolog")
    aa = langs["aaaa1234"]
    entries = {k: (t, f) for k, t, f in bd.iter_bib(bd.open_bib(raw / "glottolog"), {"r1", "r2", "r3", "r4"})}
    assert set(entries) == {"r1", "r2", "r3", "r4"}
    refs = bd.select_refs(aa, entries)
    # most extensive description first, duplicate r4 (same year + title) dropped, then sketch, then wordlist
    assert refs == ["r2", "r3", "r1"]
    txt = bd.format_reference(*entries["r2"])
    assert txt == "Doe, Jane & Roe, Rick. 2001. A grammar of Aa. Leipzig: Some Press."
    assert bd.format_reference(*entries["r3"]) == "Smith, John. 2010. Aa sketch. Journal of Aa 3."


def test_speakers(raw: Path):
    langs = bd.load_glottolog(raw / "glottolog")
    sp = bd.load_speakers(raw / "linguameta", langs)
    assert sp == {"aaaa1234": 120000, "abab1234": 5000, "baba1234": 300}


def test_names(raw: Path):
    alt = bd.load_names(raw / "glottolog", {"aaaa1234", "baba1234"})
    assert "Aa" in alt["aaaa1234"]          # lexvo en name with ' language' stripped
    assert "Old Aa" in alt["aaaa1234"]
    assert "Aa-de" not in alt["aaaa1234"]   # other lexvo languages are not used
    assert "Аа язык" not in alt["aaaa1234"]
    assert "baba1234" not in alt            # 'not specified' is dropped


def test_full_build(raw: Path, tmp_path: Path):
    out = tmp_path / "out"
    texts = tmp_path / "feature_texts.json"
    texts.write_text(json.dumps([{"id": "GB020", "en": {"has": "has articles"}, "ru": {"has": "есть артикли"}}]))  # ru is not shipped
    logs = []
    stats = bd.build(raw, out, texts, log=logs.append)
    core = json.loads((out / "core.json").read_text())
    assert core["languages"]["aaaa1234"][:3] == ["Aa", "nort1234", "Eurasia"]
    assert core["families"]["alph1234"] == ["Alpha", None, "Eurasia"]
    assert core["families"]["nort1234"] == ["Alpha-North", "alph1234"]
    flags = {gc: row[9] for gc, row in core["languages"].items()}
    # Aa: Grambank + 10 Wikipedia names -> Normal
    assert flags["aaaa1234"] == bd.FLAG_GRAMBANK | bd.FLAG_NORMAL | bd.FLAG_HARD
    # Ba: in WALS, but neither in the 200-sample nor with enough Wikipedia names
    assert flags["baba1234"] == bd.FLAG_GRAMBANK | bd.FLAG_WALS | bd.FLAG_HARD
    # Ac: in the WALS 200-language sample -> Normal
    assert flags["acac1234"] == bd.FLAG_WALS | bd.FLAG_NORMAL | bd.FLAG_HARD
    # isolates and sign languages are never puzzle targets
    assert not flags["isol1234"] & bd.FLAG_HARD
    assert not flags["sgnl1234"] & bd.FLAG_HARD
    assert core["languages"]["sgnl1234"][8] == "sign"
    assert core["languages"]["aaaa1234"][10] == 120000
    assert core["languages"]["acac1234"][10] is None
    assert stats["pool_normal"] == 2 and stats["pool_hard"] == 4
    assert stats["tree_depth_max"] == 2

    gbj = json.loads((out / "grambank.json").read_text())
    assert gbj["features"] == ["GB020", "GB024", "GB030"]
    feats = {f["id"]: f for f in json.loads((out / "features.json").read_text())}
    assert feats["GB020"]["en"] == {"has": "has articles"}
    assert "ru" not in feats["GB020"] and "ru" not in core
    assert feats["GB020"]["summary"] == "This is about articles. Really."
    assert feats["GB024"]["values"] == {"1": "Num-N", "2": "N-Num"}
    assert stats["missing_feature_texts"] == ["GB024", "GB030"]

    bib = json.loads((out / "bib" / "aa.json").read_text())
    assert [r[0] for r in bib["aaaa1234"]] == ["r2", "r3", "r1"]

    meta = json.loads((out / "meta.json").read_text())
    assert meta["datasets"]["glottolog"]["tag"].startswith("v")
    assert "2023" in meta["datasets"]["grambank"]["citation"]
    assert any("pool_normal" in line for line in logs)
