#!/bin/bash
# 컨셉 이미지 한 장. 인자: <ID> <프롬프트 본문>
# codex exec 내장 image_gen 경로만 쓴다. OpenAI REST 금지(과금 사고 전력).
ID="$1"; shift
CORE="$*"
OUT="assets/concept/${ID}.png"
[ -f "$OUT" ] && { echo "SKIP $ID"; exit 0; }

read -r -d '' P <<EOF
Generate one illustration and save it to exactly this path: ${OUT}

Vertical 9:16 character KEY VISUAL. Clean cel-shaded Korean manhwa / webtoon style at official merchandise quality: crisp confident linework, bold readable silhouette, rich saturated color, dramatic lighting. Must look good printed on a desk mat, an acrylic standee, and a keyring.

CHARACTER: ${CORE}

STYLE RULES: Striking and beautiful — a face people would want on merchandise. Expressive eyes are the focal point. Strong distinct silhouette. One signature prop or motif.

CONTENT RATING: Attractive and alluring but fully clothed and dignified. No exposure below the collarbone. No nudity, no suggestive posing. Suitable for a general teen audience.

COMPOSITION: Full-bleed vertical, character in the upper two thirds, darker uncluttered space in the bottom third for text overlay.

FORBIDDEN: no text, no letters, no logos, no watermark, no border, no frame, no signature.
EOF

printf '%s' "$P" | codex exec --skip-git-repo-check - >/dev/null 2>&1
[ -f "$OUT" ] && echo "OK   $ID" || echo "FAIL $ID"
