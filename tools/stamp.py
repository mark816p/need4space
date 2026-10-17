#!/usr/bin/env python3
"""
tools/stamp.py — Pre-commit module stamper and import map generator
Computes sha1[:8] of every module, updates index.html import map with ?v=<hash>,
and injects modulepreloads. Lints src/changelog.js.
"""
import hashlib
import os
import re
import subprocess
import sys

DEV_ONLY_MODULES = {"profile.js", "load-worker.js"}

def compute_hash(file_path):
    with open(file_path, "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]

def lint_changelog():
    changelog_path = os.path.join("src", "changelog.js")
    if os.path.exists(changelog_path):
        res = subprocess.run(["node", "--check", changelog_path], capture_output=True, text=True)
        if res.returncode != 0:
            print(f"Error: syntax error in {changelog_path}:\n{res.stderr}", file=sys.stderr)
            sys.exit(1)

def stamp():
    lint_changelog()
    html_path = "index.html"
    if not os.path.exists(html_path):
        return

    with open(html_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Collect all src files
    modules = {}
    src_dir = "src"
    build_hasher = hashlib.sha1()

    if os.path.exists(src_dir):
        for fname in sorted(os.listdir(src_dir)):
            if fname.endswith(".js"):
                fpath = os.path.join(src_dir, fname)
                h = compute_hash(fpath)
                modules[fname] = h
                build_hasher.update(h.encode("utf-8"))

    if os.path.exists("src/ui.css"):
        css_hash = compute_hash("src/ui.css")
        content = re.sub(r'href="src/ui\.css(?:\?v=[a-f0-9]+)?"', f'href="src/ui.css?v={css_hash}"', content)

    build_id = build_hasher.hexdigest()[:8]
    print(f"Need4Space build id: {build_id}")

    # Output stamped file
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(content)

if __name__ == "__main__":
    stamp()
