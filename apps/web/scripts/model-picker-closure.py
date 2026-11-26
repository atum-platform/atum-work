#!/usr/bin/env python3
"""Walks the runtime imports of the model picker and prints its closure.

Usage, from apps/web:
  python3 scripts/model-picker-closure.py components/chat/ProviderModelPicker.tsx \
    components/chat/ComposerModelEffort.tsx [--stop=state/server.ts ...]

Follows `~/` and relative specifiers under src/, skips `import type`, and stops at each
`--stop=` path (relative to src/). Prints the local files and lines reached, then the external
packages. See docs/internals/shared-model-picker.md.
"""

import os
import re
import sys
from pathlib import Path

ROOT = (Path(__file__).resolve().parent.parent / "src").resolve()
IMPORT = re.compile(r"""(import|export)\s+(type\s+)?([^;]*?)\s*from\s+["']([^"']+)["']""", re.S)
BARE = re.compile(r"""^import\s+["']([^"']+)["']""", re.M)


def resolve(base: Path, spec: str):
    if spec.startswith("~/"):
        path = ROOT / spec[2:]
    elif spec.startswith("."):
        path = base.parent / spec
    else:
        return None
    for candidate in (path, Path(f"{path}.ts"), Path(f"{path}.tsx"), path / "index.ts", path / "index.tsx"):
        if candidate.is_file():
            return candidate.resolve()
    return None


def main() -> int:
    args = sys.argv[1:]
    stops = {arg.removeprefix("--stop=") for arg in args if arg.startswith("--stop=")}
    stack = [(ROOT / arg).resolve() for arg in args if not arg.startswith("--stop=")]
    seen: dict[Path, int] = {}
    stopped: set[str] = set()
    external: dict[str, set[str]] = {}
    while stack:
        file = stack.pop()
        if file in seen:
            continue
        rel = os.path.relpath(file, ROOT)
        if rel in stops:
            stopped.add(rel)
            continue
        if file.suffix not in (".ts", ".tsx"):
            seen[file] = 0
            continue
        source = file.read_text()
        seen[file] = source.count("\n")
        specs = [m.group(4) for m in IMPORT.finditer(source) if not m.group(2)]
        specs += BARE.findall(source)
        for spec in specs:
            target = resolve(file, spec)
            if target is not None:
                stack.append(target)
            elif not spec.startswith((".", "~/")):
                package = "/".join(spec.split("/")[:2]) if spec.startswith("@") else spec.split("/")[0]
                external.setdefault(package, set()).add(rel)
    print(f"local files {len(seen)}, lines {sum(seen.values())}")
    for file, lines in sorted(seen.items(), key=lambda item: -item[1]):
        print(f"{lines:7} {os.path.relpath(file, ROOT)}")
    print("stopped:", ", ".join(sorted(stopped)) or "none")
    print("external packages:")
    for package, users in sorted(external.items()):
        print(f"  {package} ({len(users)} files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
