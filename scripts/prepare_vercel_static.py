from __future__ import annotations

import shutil
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT_DIR / "frontend"
PUBLIC_DIR = ROOT_DIR / "public"


def main() -> None:
    if PUBLIC_DIR.exists():
        shutil.rmtree(PUBLIC_DIR)
    shutil.copytree(
        SOURCE_DIR,
        PUBLIC_DIR,
        ignore=shutil.ignore_patterns("*.out", "*.err", "*.log"),
    )


if __name__ == "__main__":
    main()
