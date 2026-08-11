"""
sheet.py — 컨셉 60장을 한눈에 보는 판으로 붙인다.

왜 만드나.
60장을 하나씩 열어보면 앞에 본 걸 잊는다. 고르는 일은 **나란히 놓고 보는 일**이라
비교가 안 되면 판단이 안 선다.

한 판에 너무 많이 넣으면 얼굴이 뭉개져서 매력을 못 본다 — 고르는 기준이 얼굴인데.
그래서 한 판 6장(3×2)으로 크게 간다. 남녀 각 5판씩 열 판.

쓰는 법:  python tools/concept/sheet.py
결과:     assets/concept/_sheet/M-1.png … F-5.png
"""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SRC = ROOT / "assets" / "concept"
OUT = SRC / "_sheet"
OUT.mkdir(parents=True, exist_ok=True)

COLS, ROWS = 3, 2
TW = 560                      # 썸네일 가로. 얼굴이 읽히는 최소선에서 잡았다
TH = round(TW * 1672 / 941)   # 원본 비율 그대로
PAD, LABEL, MARGIN = 16, 46, 24

# 이름표. 그림만 보면 어느 컨셉인지 몰라 고른 뒤에 못 찾는다.
NAMES = {
    "M01": "붉은 저승사자", "M02": "검은 저승사자", "M03": "명부 판관", "M04": "삼도천 뱃사공",
    "M05": "박수무당", "M06": "작두", "M07": "부적술사", "M08": "칠성",
    "M09": "월하노인", "M10": "신선", "M11": "용왕", "M12": "이무기",
    "M13": "도깨비", "M14": "백호", "M15": "삼족오", "M16": "그림자",
    "M17": "목(木)", "M18": "화(火)", "M19": "토(土)", "M20": "금(金)",
    "M21": "수(水)", "M22": "무관", "M23": "서생", "M24": "악사",
    "M25": "남여우", "M26": "뱀(巳)", "M27": "말(午)", "M28": "호랑이(寅)",
    "M29": "용(辰)", "M30": "소년 도깨비",
    "F01": "구미호", "F02": "붉은 저승사자", "F03": "명부 서기", "F04": "나루의 여인",
    "F05": "만신", "F06": "신딸", "F07": "작두무녀", "F08": "선녀",
    "F09": "직녀", "F10": "달의 여인", "F11": "서왕모 시녀", "F12": "청조",
    "F13": "백사", "F14": "물귀신", "F15": "이무기", "F16": "목(木)",
    "F17": "화(火)", "F18": "토(土)", "F19": "금(金)", "F20": "수(水)",
    "F21": "무희", "F22": "여검객", "F23": "규수", "F24": "점바치",
    "F25": "여우소녀", "F26": "뱀(巳)", "F27": "토끼(卯)", "F28": "닭(酉)",
    "F29": "쥐(子)", "F30": "흑막",
}


def font(size):
    """한글이 나오는 서체를 찾는다. 못 찾으면 네모만 뜨는 기본 서체가 돼서 이름표가 무용지물이다."""
    for p in (r"C:\Windows\Fonts\malgunbd.ttf", r"C:\Windows\Fonts\malgun.ttf",
              r"C:\Windows\Fonts\gulim.ttc"):
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


F_LABEL = font(28)


def build(ids, path):
    w = MARGIN * 2 + COLS * TW + (COLS - 1) * PAD
    h = MARGIN * 2 + ROWS * (TH + LABEL) + (ROWS - 1) * PAD
    sheet = Image.new("RGB", (w, h), (18, 18, 22))
    d = ImageDraw.Draw(sheet)

    for n, cid in enumerate(ids):
        src = SRC / f"{cid}.png"
        if not src.exists():
            continue
        col, row = n % COLS, n // COLS
        x = MARGIN + col * (TW + PAD)
        y = MARGIN + row * (TH + LABEL + PAD)
        im = Image.open(src).convert("RGB").resize((TW, TH), Image.LANCZOS)
        sheet.paste(im, (x, y))
        d.text((x + 4, y + TH + 8), f"{cid}  {NAMES.get(cid, '')}",
               font=F_LABEL, fill=(228, 222, 210))

    sheet.save(path, "PNG", optimize=True)
    return path


made = []
for sex in ("M", "F"):
    ids = [f"{sex}{i:02d}" for i in range(1, 31)]
    per = COLS * ROWS
    for k in range(0, len(ids), per):
        p = OUT / f"{sex}-{k // per + 1}.png"
        build(ids[k:k + per], p)
        made.append(p)

for p in made:
    print(p.relative_to(ROOT), f"{p.stat().st_size / 1024:.0f}KB")
