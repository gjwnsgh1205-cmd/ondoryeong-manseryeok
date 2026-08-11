#!/bin/bash
# 장면 앵커 한 장. M07 을 레퍼런스로 물려 표정·손짓만 바꾼다.
# 인자: <키> <표정·손짓 지시>
cd "$(dirname "$0")/../.."
KEY="$1"; shift
ACT="$*"
OUT="assets/scene/${KEY}.png"
[ -f "$OUT" ] && { echo "SKIP $KEY"; exit 0; }

read -r -d '' P <<EOF
Redraw the attached character illustration and save the result to exactly this path: ${OUT}

LOCKED — copy these from the reference with no deviation:
the character's face and facial features, hair and hairstyle, skin tone, body proportions and shoulder width,
the black robe with red cord and gold ornaments, the red glowing paper talismans,
the dark navy-and-crimson color grading, the cel-shaded Korean manhwa merchandise-quality rendering,
the 9:16 vertical full-bleed framing, and the character's scale within the frame.
This must read as the SAME PERSON in the SAME outfit in the SAME room.

CHANGE ONLY THIS: ${ACT}

He looks STRAIGHT AT THE VIEWER — direct eye contact with the camera. This is essential.

COMPOSITION: character occupies the upper two thirds. The BOTTOM THIRD must be dark, empty and uncluttered — speech bubbles and text will be placed there. Do not put the character's hands or any talisman in the bottom third.

CONTENT: fully clothed, no exposure below the collarbone, suitable for a general teen audience.

FORBIDDEN: no text, no letters, no numbers, no logos, no watermark, no border, no signature.
EOF

printf '%s' "$P" | codex exec --skip-git-repo-check -i assets/concept/M07.png - >/dev/null 2>&1
[ -f "$OUT" ] && echo "OK   $KEY" || echo "FAIL $KEY"
