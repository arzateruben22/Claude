#!/usr/bin/env python3
"""Derive the artifact-publishable variant of index.html.

The repo copy is a full standalone document. The claude.ai artifact pipeline
wraps published files in its own skeleton, so the published page must be
head-less: <title> + metas + fonts link + <style> first, then the body
content. index.html keeps the strict discipline documented in SPEC.md, so
this transform is mechanical.

Usage: python3 make_artifact.py index.html > page.artifact.html
"""
import re
import sys

src = open(sys.argv[1], encoding="utf-8").read()

head = re.search(r"<head[^>]*>(.*?)</head>", src, re.S)
body = re.search(r"<body[^>]*>(.*?)</body>", src, re.S)
if not (head and body):
    sys.exit("index.html missing head/body")

keep = []
for m in re.finditer(
    r"<title>.*?</title>|<meta name=\"claude:[^\"]+\"[^>]*>|"
    r"<link[^>]*fonts\.googleapis\.com[^>]*>|<style[^>]*>.*?</style>",
    head.group(1), re.S,
):
    keep.append(m.group(0).strip())

sys.stdout.write("\n".join(keep) + "\n" + body.group(1).strip() + "\n")
