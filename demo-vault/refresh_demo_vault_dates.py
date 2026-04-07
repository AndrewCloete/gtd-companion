#!/usr/bin/env python3
"""
Shift GTD date tokens (@d, @s, @v, @b + YYYYMMDD) in this demo vault by
(target_date - anchor_date), then set the anchor to target_date.

The anchor file `.gtd-date-anchor` records which calendar day the vault was last
aligned to (so the app "today" filter matches the demo). Re-run when dates feel stale.

Usage (from anywhere):
  python3 demo-vault/refresh_demo_vault_dates.py
  python3 /path/to/demo-vault/refresh_demo_vault_dates.py --to 20261225
  python3 demo-vault/refresh_demo_vault_dates.py --dry-run

Or from inside this folder:  python3 refresh_demo_vault_dates.py
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

VAULT_ROOT = Path(__file__).resolve().parent

TOKEN_RE = re.compile(r"@([dsbv])(\d{8})\b")


def parse_ymd(s: str) -> date:
    return datetime.strptime(s.strip(), "%Y%m%d").date()


def fmt_ymd(d: date) -> str:
    return d.strftime("%Y%m%d")


def read_anchor(path: Path) -> date:
    if not path.is_file():
        print(f"error: missing anchor file {path}", file=sys.stderr)
        print("  create it with one line YYYYMMDD (last day the vault was tuned for)", file=sys.stderr)
        sys.exit(1)
    line = path.read_text(encoding="utf-8").strip().splitlines()
    if not line:
        print(f"error: empty anchor file {path}", file=sys.stderr)
        sys.exit(1)
    return parse_ymd(line[0])


def shift_text(text: str, delta: timedelta) -> tuple[str, int]:
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        kind, ymd = m.group(1), m.group(2)
        old = parse_ymd(ymd)
        new = old + delta
        count += 1
        return f"@{kind}{fmt_ymd(new)}"

    return TOKEN_RE.sub(repl, text), count


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--root",
        type=Path,
        default=VAULT_ROOT,
        help=f"Vault root (default: this script's directory, {VAULT_ROOT})",
    )
    ap.add_argument(
        "--to",
        dest="to_str",
        metavar="YYYYMMDD",
        default=None,
        help="Align vault to this day (default: local today)",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print changes only; do not write files or update anchor",
    )
    args = ap.parse_args()

    root: Path = args.root.resolve()
    if not root.is_dir():
        print(f"error: not a directory: {root}", file=sys.stderr)
        sys.exit(1)

    anchor_path = root / ".gtd-date-anchor"
    anchor = read_anchor(anchor_path)
    if args.to_str:
        target = parse_ymd(args.to_str)
    else:
        target = date.today()

    delta = target - anchor
    if delta.days == 0:
        print(f"anchor already {fmt_ymd(target)}; nothing to do")
        return

    print(f"anchor {fmt_ymd(anchor)} → target {fmt_ymd(target)} ({delta.days:+d} day(s))")

    md_files = sorted(p for p in root.rglob("*.md") if p.is_file())
    total_tokens = 0
    changed_files: list[Path] = []

    for path in md_files:
        text = path.read_text(encoding="utf-8")
        new_text, n = shift_text(text, delta)
        total_tokens += n
        if new_text != text:
            changed_files.append(path)
            if args.dry_run:
                print(f"would update {path.relative_to(root)} ({n} token(s))")
            else:
                path.write_text(new_text, encoding="utf-8")
                print(f"updated {path.relative_to(root)} ({n} token(s))")

    if total_tokens == 0:
        print("warning: no @d/@s/@v/@b YYYYMMDD tokens found under vault", file=sys.stderr)

    if not args.dry_run:
        anchor_path.write_text(fmt_ymd(target) + "\n", encoding="utf-8")
        print(f"wrote anchor {anchor_path} → {fmt_ymd(target)}")
    elif changed_files:
        print(f"(dry-run) would rewrite anchor → {fmt_ymd(target)}")


if __name__ == "__main__":
    main()
