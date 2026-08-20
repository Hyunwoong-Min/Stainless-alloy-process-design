#!/usr/bin/env bash
# src/ 의 HTML 셸과 JS 조각을 합쳐 dist/index.html (단일 파일) 을 만든다.
# 외부 요청이 차단된 환경에서도 열리도록 모든 스크립트를 인라인한다.
set -euo pipefail
cd "$(dirname "$0")"

SHELL_HTML="src/index.html"
OUT="dist/index.html"
MARKER='<script src="app.js"></script>'

line=$(grep -n -F "$MARKER" "$SHELL_HTML" | cut -d: -f1)
if [ -z "${line:-}" ]; then
  echo "build: '$MARKER' 를 $SHELL_HTML 에서 찾지 못했습니다." >&2
  exit 1
fi

mkdir -p dist
{
  head -n "$((line - 1))" "$SHELL_HTML"
  echo '<script>'
  cat src/0*.js
  echo '</script>'
  tail -n "+$((line + 1))" "$SHELL_HTML"
} > "$OUT"

echo "build: $OUT ($(wc -c < "$OUT") bytes, JS $(cat src/0*.js | wc -l) lines)"
