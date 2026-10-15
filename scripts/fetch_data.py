#!/usr/bin/env python3
"""Download the CLDF datasets used by LangBang into ./raw/ (git-ignored).

Each dataset is fetched as a shallow git clone of a *release tag* so that the
data are exactly those of a published, citable release (the same content that
is archived on Zenodo).  LinguaMeta has no releases, so it is pinned to a
commit.  Versions are pinned in scripts/datasets.json; bump them there to
update.

Usage:
    python scripts/fetch_data.py            # fetch everything missing
    python scripts/fetch_data.py --force    # re-download
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "raw"
DATASETS = json.loads((ROOT / "scripts" / "datasets.json").read_text(encoding="utf-8"))


def git(*args: str, cwd: Path | None = None) -> None:
    subprocess.run(["git", "-c", "advice.detachedHead=false", *args], check=True, cwd=cwd,
                   env={"GIT_LFS_SKIP_SMUDGE": "1", **os.environ})


def fetch(name: str, spec: dict, force: bool) -> None:
    """Shallow-clone a release tag, or (for datasets without releases) a pinned commit,
    optionally restricted to a sub-directory (``sparse``)."""
    ref = spec.get("tag") or spec["commit"]
    target = RAW / name
    marker = target / ".fetched-ref"
    if target.exists() and not force:
        if marker.exists() and marker.read_text().strip() == ref:
            print(f"[fetch] {name} {ref} already present")
            return
        print(f"[fetch] {name}: present but not {ref}, re-downloading")
    if target.exists():
        shutil.rmtree(target)
    RAW.mkdir(exist_ok=True)
    url = f"https://github.com/{spec['repo']}"
    print(f"[fetch] {url} @ {ref}")
    if "tag" in spec:
        git("clone", "--quiet", "--depth", "1", "--branch", spec["tag"], url, str(target))
    else:
        target.mkdir()
        git("init", "--quiet", cwd=target)
        git("remote", "add", "origin", url, cwd=target)
        if spec.get("sparse"):
            git("sparse-checkout", "set", spec["sparse"], cwd=target)
        git("fetch", "--quiet", "--depth", "1", "--filter=blob:none", "origin", spec["commit"], cwd=target)
        git("checkout", "--quiet", "FETCH_HEAD", cwd=target)
    marker.write_text(ref + "\n")


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
