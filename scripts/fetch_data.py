#!/usr/bin/env python3
"""Download the CLDF datasets used by LangBang into ./raw/ (git-ignored).

Each dataset is fetched as a shallow git clone of a *release tag* so that the
data are exactly those of a published, citable release (the same content that
is archived on Zenodo).  Versions are pinned in scripts/datasets.json; bump the
tag there to update.

Usage:
    python scripts/fetch_data.py            # fetch everything missing
    python scripts/fetch_data.py --force    # re-download
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
DATASETS = json.loads((ROOT / "scripts" / "datasets.json").read_text(encoding="utf-8"))


def fetch(name: str, spec: dict, force: bool) -> None:
    target = RAW / name
    marker = target / ".langbang-tag"
    if target.exists() and not force:
        if marker.exists() and marker.read_text().strip() == spec["tag"]:
            print(f"[fetch] {name} {spec['tag']} already present")
            return
        print(f"[fetch] {name}: present but not {spec['tag']}, re-downloading")
    if target.exists():
        shutil.rmtree(target)
    RAW.mkdir(exist_ok=True)
    url = f"https://github.com/{spec['repo']}"
    print(f"[fetch] cloning {url} @ {spec['tag']}")
    subprocess.run(
        ["git", "-c", "advice.detachedHead=false", "clone", "--quiet", "--depth", "1",
         "--branch", spec["tag"], url, str(target)],
        check=True,
        env={"GIT_LFS_SKIP_SMUDGE": "1", **__import__("os").environ},
    )
    marker.write_text(spec["tag"] + "\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    try:
        for name, spec in DATASETS.items():
            fetch(name, spec, args.force)
    except subprocess.CalledProcessError as exc:  # pragma: no cover - network dependent
        print(f"[fetch] FAILED: {exc}. See README for manual download instructions.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
