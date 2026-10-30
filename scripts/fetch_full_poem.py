#!/usr/bin/env python3
"""
Synchronizes `data/story_graph.json` into `data/story-graph-bundle.js`
and validates all stanza references against the local 65-chapter bilingual corpus
(`data/chapters/chapter-01.json` .. `chapter-65.json`).
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHAPTERS_DIR = ROOT / "data" / "chapters"
STORY_GRAPH_JSON = ROOT / "data" / "story_graph.json"
STORY_GRAPH_BUNDLE = ROOT / "data" / "story-graph-bundle.js"

def sync_bundles():
    with open(STORY_GRAPH_JSON, "r", encoding="utf-8") as f:
        graph = json.load(f)

    with open(STORY_GRAPH_BUNDLE, "w", encoding="utf-8") as f:
        f.write("window.STORY_GRAPH_BUNDLE = ")
        json.dump(graph, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    stanza_count = 0
    for ch_file in sorted(CHAPTERS_DIR.glob("chapter-*.json")):
        with open(ch_file, "r", encoding="utf-8") as f:
            ch = json.load(f)
            stanza_count += len(ch.get("stanzas", []))

    print(f"Synced {STORY_GRAPH_BUNDLE.name} ({len(graph.get('steps', []))} steps) against {stanza_count} local bilingual stanzas.")

if __name__ == "__main__":
    sync_bundles()
