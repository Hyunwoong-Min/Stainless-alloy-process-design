#!/usr/bin/env bash
# src/ 의 HTML 셸과 JS 조각을 합쳐 단일 파일 앱을 만든다.
# 외부 요청이 차단된 환경에서도 열리도록 모든 스크립트를 인라인한다.
#
# 산출물 2곳 (내용 동일):
#   dist/index.html  — 로컬 실행·배포용
#   docs/index.html  — GitHub Pages (main 브랜치 /docs 서빙) 용
#                      docs/.nojekyll 도 함께 보장한다
set -euo pipefail
cd "$(dirname "$0")"

SHELL_HTML="src/index.html"
DIST="dist/index.html"
DOCS="docs/index.html"
MARKER='<script src="app.js"></script>'

line=$(grep -n -F "$MARKER" "$SHELL_HTML" | cut -d: -f1)
if [ -z "${line:-}" ]; then
  echo "build: '$MARKER' 를 $SHELL_HTML 에서 찾지 못했습니다." >&2
  exit 1
fi

mkdir -p "$(dirname "$DIST")" "$(dirname "$DOCS")"
{
  head -n "$((line - 1))" "$SHELL_HTML"
  echo '<script>'
  cat src/0*.js
  echo '</script>'
  tail -n "+$((line + 1))" "$SHELL_HTML"
} > "$DIST"

cp "$DIST" "$DOCS"

# Pages 가 Jekyll 로 전처리하지 않도록 (없으면 생성, 있으면 그대로 둔다)
[ -f docs/.nojekyll ] || : > docs/.nojekyll

# 두 산출물이 실제로 동일한지 확인 — 다르면 배포본이 어긋난 것이므로 실패 처리
if ! cmp -s "$DIST" "$DOCS"; then
  echo "build: $DIST 와 $DOCS 내용이 다릅니다." >&2
  exit 1
fi

bytes=$(wc -c < "$DIST")
echo "build: $DIST, $DOCS ($bytes bytes, JS $(cat src/0*.js | wc -l) lines)"
