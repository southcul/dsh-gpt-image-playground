"""Build the distributable artifacts for this plugin.

    python tools/pack.py

Produces, under dist/:
  dsh-gpt-image-playground-<version>.tgz   npm-style tarball (package/…)
  gpt-image-playground-<version>.zip       folder with install.ps1 for friends

The file list comes from package.json's `files`, plus the always-shipped
metadata. Nothing else (tests, tools, preview) is included.
"""

from __future__ import annotations

import fnmatch
import io
import json
import os
import re
import sys
import tarfile
import time
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, "dist")
ALWAYS = [
    "package.json",
    "README.md",
    "LICENSE",
    "THIRD-PARTY-NOTICES.md",
    "install.ps1",
]


def load_manifest() -> dict:
    with open(os.path.join(ROOT, "package.json"), encoding="utf-8") as handle:
        return json.load(handle)


def glob_to_regex(pattern: str) -> re.Pattern:
    """npm-style glob: `**/` matches zero or more directories, `*` never crosses `/`."""
    out = []
    index = 0
    while index < len(pattern):
        character = pattern[index]
        if pattern.startswith("**/", index):
            out.append("(?:[^/]+/)*")
            index += 3
        elif pattern.startswith("**", index):
            out.append(".*")
            index += 2
        elif character == "*":
            out.append("[^/]*")
            index += 1
        elif character == "?":
            out.append("[^/]")
            index += 1
        else:
            out.append(re.escape(character))
            index += 1
    return re.compile("^" + "".join(out) + "$")


def collect(patterns: list[str]) -> list[str]:
    compiled = [glob_to_regex(pattern) for pattern in patterns]
    selected: set[str] = set()
    for base, dirs, names in os.walk(ROOT):
        relative_base = os.path.relpath(base, ROOT).replace("\\", "/")
        dirs[:] = [name for name in dirs if not name.startswith(".") and name not in ("dist", "node_modules", "preview", "tools", "framework", "upstream", "plugin-dev")]
        if relative_base == ".":
            relative_base = ""
        if relative_base.startswith("dist") or relative_base.startswith(".git"):
            continue
        for name in names:
            relative = name if relative_base == "" else f"{relative_base}/{name}"
            if relative in ALWAYS:
                selected.add(relative)
                continue
            if any(matcher.match(relative) for matcher in compiled):
                selected.add(relative)
    return sorted(selected)


def build_tgz(version: str, files: list[str]) -> str:
    target = os.path.join(DIST, f"dsh-gpt-image-playground-{version}.tgz")
    with tarfile.open(target, "w:gz", format=tarfile.PAX_FORMAT) as archive:
        for relative in files:
            source = os.path.join(ROOT, relative)
            info = archive.gettarinfo(source, arcname=f"package/{relative}")
            info.mtime = int(time.time())
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            with open(source, "rb") as handle:
                archive.addfile(info, handle)
    return target


def build_zip(version: str, files: list[str]) -> str:
    target = os.path.join(DIST, f"gpt-image-playground-{version}.zip")
    prefix = f"dsh-gpt-image-playground-{version}"
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in files:
            source = os.path.join(ROOT, relative)
            archive.write(source, f"{prefix}/{relative}")
        archive.writestr(
            f"{prefix}/INSTALL-FIRST.txt",
            "GPT Image Playground - DeepSeek Harness plugin\n"
            "==============================================\n\n"
            "1. Unzip this folder anywhere (not inside the DSH install dir)\n"
            "2. Right-click install.ps1 -> 'Run with PowerShell'\n"
            "   (or: powershell -ExecutionPolicy Bypass -File .\\install.ps1)\n"
            "3. Refresh DSH; a camera icon 'image workbench' appears in the left rail\n\n"
            "Uninstall: node install.mjs --uninstall\n"
            "See README.md and THIRD-PARTY-NOTICES.md.\n",
        )
    return target


def main() -> int:
    manifest = load_manifest()
    version = manifest["version"]
    files = collect(manifest.get("files", []))
    if not any(item.startswith("vendor-app/") for item in files):
        print("vendor-app is missing — run tools/vendor-dist.mjs first", file=sys.stderr)
        return 1
    os.makedirs(DIST, exist_ok=True)
    tgz = build_tgz(version, files)
    zip_path = build_zip(version, files)
    for path in (tgz, zip_path):
        print(f"{os.path.basename(path):<52} {os.path.getsize(path) / 1024 / 1024:6.2f} MB")
    print(f"{len(files)} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
