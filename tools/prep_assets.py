"""
캐릭터 에셋 후처리 (prep_assets.py)

gpt-image-2는 "transparent background"를 요청해도 마젠타 크로마키나
흰 배경/체커보드 무늬로 내보내는 경우가 있다. 이 스크립트가 그걸 정리한다.

  1) assets/web/*.png   — 배경 제거 + 프린지(마젠타 끼) 제거 + 여백 트림한 투명 PNG (웹용)
  2) assets/video/*.png — 위 결과를 앱 먹색 배경 위에 얹은 9:16 프레임 (i2v 시작 프레임용)

실행: python tools/prep_assets.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets" / "_master"   # gpt-image-2 원본 (마젠타 크로마키 상태)
WEB = ROOT / "assets" / "web"
VID = ROOT / "assets" / "video"

INK_TOP = (26, 22, 16)      # 앱 배경 먹색 (css --ink 계열)
INK_BOTTOM = (13, 11, 8)


def _magenta_mask(a: np.ndarray) -> np.ndarray:
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (r > 190) & (b > 190) & (g < 140)


def remove_background(img: Image.Image) -> Image.Image:
    """마젠타 크로마키 우선, 없으면 모서리 시드 플러드필로 밝은 배경 제거."""
    img = img.convert("RGBA")
    a = np.array(img)

    mask = _magenta_mask(a.astype(np.int16))
    if mask.sum() < a[..., 0].size * 0.02:
        # 크로마키가 아니다 — 모서리에서 플러드필로 배경을 마젠타로 칠한 뒤 동일 처리
        rgb = img.convert("RGB")
        d = ImageDraw.floodfill
        w, h = rgb.size
        for seed in ((1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2)):
            px = rgb.getpixel(seed)
            if sum(px) / 3 > 180:  # 밝은 배경일 때만
                d(rgb, seed, (255, 0, 255), thresh=70)
        a = np.dstack([np.array(rgb), np.array(img)[..., 3]])
        mask = _magenta_mask(a.astype(np.int16))

    a = a.astype(np.int16)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    al = np.where(mask, 0, al)

    # 알파 1px 침식 — 배경과 섞인 경계 픽셀을 잘라낸다
    solid = al > 0
    er = solid.copy()
    er[1:, :] &= solid[:-1, :]
    er[:-1, :] &= solid[1:, :]
    er[:, 1:] &= solid[:, :-1]
    er[:, :-1] &= solid[:, 1:]
    al = np.where(er, al, 0)

    # 디스필: (R+B)/2 가 G보다 높은 픽셀 = 마젠타 끼. 살색·금색·청록은 이 조건에 안 걸린다
    spill = ((r + b) // 2) - g
    hot = (al > 0) & (spill > 0)
    k = np.where(hot, spill, 0)
    r = np.clip(r - k, 0, 255)
    b = np.clip(b - k, 0, 255)

    out = np.stack([r, g, b, al], axis=-1).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def trim(img: Image.Image, pad: int = 10) -> Image.Image:
    bbox = img.getchannel("A").point(lambda v: 255 if v > 12 else 0).getbbox()
    if not bbox:
        return img
    l, t, r, b = bbox
    return img.crop((max(0, l - pad), max(0, t - pad),
                     min(img.width, r + pad), min(img.height, b + pad)))


def on_ink(img: Image.Image, size=(720, 1280), scale=0.88) -> Image.Image:
    w, h = size
    grad = np.zeros((h, w, 3), dtype=np.uint8)
    for y in range(h):
        t = y / max(1, h - 1)
        grad[y, :] = [int(INK_TOP[i] + (INK_BOTTOM[i] - INK_TOP[i]) * t) for i in range(3)]
    bg = Image.fromarray(grad, "RGB").convert("RGBA")

    ch = int(h * scale)
    cw = max(1, int(img.width * ch / img.height))
    if cw > int(w * 0.94):
        cw = int(w * 0.94)
        ch = max(1, int(img.height * cw / img.width))

    bg.alpha_composite(img.resize((cw, ch), Image.LANCZOS), ((w - cw) // 2, h - ch))
    return bg.convert("RGB")


def main():
    WEB.mkdir(parents=True, exist_ok=True)
    VID.mkdir(parents=True, exist_ok=True)

    for src in sorted(SRC.glob("doryeong-*.png")):
        img = trim(remove_background(Image.open(src)))
        img.save(WEB / src.name, optimize=True)
        on_ink(img).save(VID / src.name, quality=95)

        opaque = (np.array(img)[..., 3] > 12).mean()
        print(f"{src.name}: {img.width}x{img.height}, 캐릭터 점유 {opaque:.1%}")


if __name__ == "__main__":
    main()
