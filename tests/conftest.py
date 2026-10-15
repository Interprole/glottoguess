"""A tiny synthetic CLDF universe (Glottolog + Grambank + WALS) for pipeline tests.

Tree (Glottolog):
    alph1234 Alpha (family, Eurasia)
      nort1234 Alpha-North
        aaaa1234 Aa            (language, Eurasia, in Grambank, 10 Wikipedia names)
        abab1234 Ab            (language, Eurasia)
          abdi1234 Ab-dialect  (dialect; coded in Grambank instead of Ab)
      acac1234 Ac              (language, Africa;Eurasia)
    beta1234 Beta (family, Africa)
      baba1234 Ba              (language, Africa, in WALS + Grambank)
    isol1234 Iso               (isolate, Papunesia)
    sign1234 Sign Language     (pseudo family)
      sgnl1234 Some Sign       (sign language)
    book1234 Bookkeeping       (pseudo family)
      bkbk1234 Junk            (bookkeeping language: excluded)
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

LANG_COLS = ["ID", "Name", "Macroarea", "Latitude", "Longitude", "Glottocode", "ISO639P3code", "Level",
             "Countries", "Family_ID", "Language_ID", "Closest_ISO369P3code",
             "First_Year_Of_Documentation", "Last_Year_Of_Documentation", "Is_Isolate"]


def write_csv(path: Path, cols: list[str], rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: r.get(c, "") for c in cols})


def lang(id, name, level, area="", lat="", lon="", family="", language="", isolate="false", countries=""):
    return dict(ID=id, Name=name, Macroarea=area, Latitude=lat, Longitude=lon, Glottocode=id, Level=level,
                Family_ID=family, Language_ID=language, Is_Isolate=isolate, Countries=countries)


@pytest.fixture()
def raw(tmp_path: Path) -> Path:
    g = tmp_path / "raw" / "glottolog" / "cldf"
    write_csv(g / "languages.csv", LANG_COLS, [
        lang("alph1234", "Alpha", "family", "Eurasia"),
        lang("nort1234", "Alpha-North", "family", "Eurasia", family="alph1234"),
        lang("aaaa1234", "Aa", "language", "Eurasia", "50", "10", "alph1234", countries="DE;FR"),
        lang("abab1234", "Ab", "language", "Eurasia", "51", "11", "alph1234"),
        lang("abdi1234", "Ab-dialect", "dialect", "Eurasia", "51", "11", "alph1234", "abab1234"),
        lang("acac1234", "Ac", "language", "Africa;Eurasia", "30", "30", "alph1234"),
        lang("beta1234", "Beta", "family", "Africa"),
        dict(lang("baba1234", "Ba", "language", "Africa", "0", "20", "beta1234"), ISO639P3code="bba"),
        lang("isol1234", "Iso", "language", "Papunesia", "-5", "140", isolate="true"),
        lang("sign1234", "Sign Language", "family"),
        lang("sgnl1234", "Some Sign", "language", "Eurasia", "45", "5", "sign1234"),
        lang("book1234", "Bookkeeping", "family"),
        lang("bkbk1234", "Junk", "language", "Eurasia", "1", "1", "book1234"),
    ])
    vals = []

    def v(lid, pid, value, source=""):
        vals.append(dict(ID=f"{lid}-{pid}", Language_ID=lid, Parameter_ID=pid, Value=value, Source=source))

    for lid, cat in [("alph1234", "Family"), ("nort1234", "Family"), ("beta1234", "Family"),
                     ("sign1234", "Pseudo_Family"), ("book1234", "Pseudo_Family"),
                     ("aaaa1234", "Spoken_L1_Language"), ("abab1234", "Spoken_L1_Language"),
                     ("acac1234", "Spoken_L1_Language"), ("baba1234", "Spoken_L1_Language"),
                     ("isol1234", "Spoken_L1_Language"), ("sgnl1234", "Sign_Language"),
                     ("bkbk1234", "Bookkeeping"), ("abdi1234", "Dialect")]:
        v(lid, "category", cat)
    for lid, path in [("nort1234", "alph1234"), ("aaaa1234", "alph1234/nort1234"),
                      ("abab1234", "alph1234/nort1234"), ("abdi1234", "alph1234/nort1234/abab1234"),
                      ("acac1234", "alph1234"), ("baba1234", "beta1234"), ("sgnl1234", "sign1234"),
                      ("bkbk1234", "book1234")]:
        v(lid, "classification", path)
    v("aaaa1234", "aes", "1")
    v("aaaa1234", "med", "0", "r2")
    v("aaaa1234", "bib", "True", "r1;r2[12-14];r3;r4")
    write_csv(g / "values.csv", ["ID", "Language_ID", "Parameter_ID", "Value", "Code_ID", "Comment", "Source",
                                 "codeReference"], vals)
    names = [dict(ID=str(i), Language_ID="aaaa1234", Name=f"Aa-{l}", Provider="lexvo", lang=l)
             for i, l in enumerate(["de", "fr", "es", "it", "pl", "nl", "sv", "fi", "cs", "hu"])]
    names += [
        dict(ID="100", Language_ID="aaaa1234", Name="Aa language", Provider="lexvo", lang="en"),
        dict(ID="101", Language_ID="aaaa1234", Name="Аа язык", Provider="lexvo", lang="ru"),
        dict(ID="102", Language_ID="aaaa1234", Name="Old Aa", Provider="multitree", lang=""),
        dict(ID="103", Language_ID="aaaa1234", Name="aa", Provider="multitree", lang=""),
        dict(ID="104", Language_ID="baba1234", Name="not specified", Provider="ruhlen (1987)", lang=""),
    ]
    write_csv(g / "names.csv", ["ID", "Language_ID", "Name", "Provider", "lang"], names)
    (g / "sources.bib").write_text("""@book{r1,
    author = {Smith, John},
    hhtype = {wordlist},
    title = {Aa words},
    year = {1990}
}

@book{r2,
    author = {Doe, Jane and Roe, Rick},
    address = {Leipzig},
    hhtype = {grammar},
    publisher = {Some Press},
    title = {A grammar of {Aa}},
    year = {2001}
}

@article{r3,
    author = {Smith, John},
    hhtype = {grammar_sketch},
    journal = {Journal of Aa},
    title = {Aa sketch},
    volume = {3},
    year = {2010}
}

@book{r4,
    author = {Doe, Jane},
    hhtype = {grammar},
    title = {A grammar of Aa},
    year = {2001}
}

@book{unused,
    title = {Nothing},
    year = {1900}
}
""", encoding="utf-8")

    gb = tmp_path / "raw" / "grambank"
    write_csv(gb / "cldf" / "languages.csv", ["ID", "Name", "Glottocode"], [
        dict(ID="aaaa1234", Name="Aa", Glottocode="aaaa1234"),
        dict(ID="abdi1234", Name="Ab-dialect", Glottocode="abdi1234"),
        dict(ID="baba1234", Name="Ba", Glottocode="baba1234"),
        dict(ID="gone1234", Name="Retired code", Glottocode="gone1234"),
    ])
    desc = "## Q?\n\n## Summary\nThis is about [articles](http://x). Really.\n\n## Procedure\n1. Code 1."
    write_csv(gb / "cldf" / "parameters.csv", ["ID", "Name", "Description"], [
        dict(ID="GB020", Name="Are there definite articles?", Description=desc),
        dict(ID="GB024", Name="What is the order of numeral and noun?", Description=desc),
        dict(ID="GB030", Name="Is there gender in 3rd person pronouns?", Description=""),
    ])
    write_csv(gb / "cldf" / "codes.csv", ["ID", "Parameter_ID", "Name", "Description"], [
        dict(ID="GB020-0", Parameter_ID="GB020", Name="0", Description="absent"),
        dict(ID="GB020-1", Parameter_ID="GB020", Name="1", Description="present"),
        dict(ID="GB024-1", Parameter_ID="GB024", Name="1", Description="Num-N"),
        dict(ID="GB024-2", Parameter_ID="GB024", Name="2", Description="N-Num"),
    ])
    gvals = []
    for lid, vs in [("aaaa1234", ["1", "2", "?"]), ("abdi1234", ["0", "1", "1"]), ("baba1234", ["?", "1", "0"]),
                    ("gone1234", ["1", "1", "1"])]:
        for pid, val in zip(["GB020", "GB024", "GB030"], vs):
            gvals.append(dict(ID=f"{pid}-{lid}", Language_ID=lid, Parameter_ID=pid, Value=val))
    write_csv(gb / "cldf" / "values.csv", ["ID", "Language_ID", "Parameter_ID", "Value"], gvals)
    (gb / "cldf" / "StructureDataset-metadata.json").write_text(json.dumps(
        {"dc:bibliographicCitation": "Skirgård, Hedvig and others (in press). Grambank. Science Advances."}))
    write_csv(gb / "docs" / "feature_groupings" / "feature_grouping_for_analysis.csv",
              ["Feature_ID", "Main_domain", "Finer_grouping"],
              [dict(Feature_ID="GB020", Main_domain="nominal domain", Finer_grouping="deixis")])

    write_csv(tmp_path / "raw" / "wals" / "cldf" / "languages.csv", ["ID", "Name", "Glottocode", "Samples_200"],
              [dict(ID="ba", Name="Ba", Glottocode="baba1234", Samples_200="false"),
               dict(ID="ac", Name="Ac", Glottocode="acac1234", Samples_200="true")])
    lm = tmp_path / "raw" / "linguameta" / "linguameta"
    lm.mkdir(parents=True)
    (lm / "linguameta.tsv").write_text(
        "bcp_47_code\tiso_639_3_code\testimated_number_of_speakers\tis_macrolanguage\tglottocode\n"
        "aa\t\t120000\tFalse\taaaa1234\n"      # by glottocode
        "ab\t\t5000\tFalse\tabdi1234\n"        # dialect code -> lifted to Ab
        "ba\tbba\t300\tFalse\t\n"               # by ISO code
        "mac\tmac\t9999999\tTrue\tbeta1234\n",   # macrolanguage row: ignored
        encoding="utf-8")
    return tmp_path / "raw"
