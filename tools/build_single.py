"""
단일 파일 번들 (build_single.py)

앱 전체(HTML/CSS/JS + 캐릭터 이미지·영상)를 HTML 파일 하나로 합친다.
외부 요청이 전혀 없으므로 링크로 건네주거나, 파일째 보내거나,
CSP가 엄격한 곳에 올려도 그대로 동작한다.

출력
  dist/share/온도령-만세력-상담소.html   완전한 문서 (더블클릭해도 열린다)
  dist/share/_artifact-body.html          <head> 없이 본문만 (아티팩트 게시용)

실행: python tools/build_single.py
"""
import base64
import mimetypes
import re
import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "share"
MEDIA = OUT / "_media"          # 번들 전용 경량 사본

# 인라인할 스크립트 (index.html의 로드 순서와 같아야 한다)
SCRIPTS = [
    "js/vendor/astronomy.browser.min.js",
    "js/manseryeok.js",
    "js/counsel.js",
    "js/doryeong.js",
    "js/app.js",
]

# 링크 하나로 통째로 실어 보내야 하므로 배포본보다 더 줄인다.
# 480px/CRF26 → 420px/CRF28 로 낮춰도 표시 크기(약 225px)에서는 차이가 보이지 않는다.
VIDEO_WIDTH, VIDEO_CRF = 420, 28
FALLBACK_PNG_WIDTH = 320        # 마스크 미지원 브라우저에서만 쓰이는 그림


def data_uri(path: Path) -> str:
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def prepare_media():
    """번들용 경량 사본을 만든다 (배포본 assets/ 는 건드리지 않는다)."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise SystemExit("ffmpeg가 필요합니다.")
    if MEDIA.exists():
        shutil.rmtree(MEDIA)
    MEDIA.mkdir(parents=True)

    for src in sorted((ROOT / "assets" / "video").glob("*.mp4")):
        subprocess.run([
            ffmpeg, "-v", "error", "-y", "-i", str(src),
            "-vf", f"scale={VIDEO_WIDTH}:-2:flags=lanczos",
            "-c:v", "libx264", "-crf", str(VIDEO_CRF), "-preset", "veryslow",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
            str(MEDIA / src.name),
        ], check=True)

    for src in sorted((ROOT / "assets" / "video").glob("*.jpg")):
        shutil.copy2(src, MEDIA / src.name)

    for src in sorted((ROOT / "assets" / "web").glob("*.png")):
        im = Image.open(src)
        h = round(im.height * FALLBACK_PNG_WIDTH / im.width)
        (im.convert("RGBA")
           .resize((FALLBACK_PNG_WIDTH, h), Image.LANCZOS)
           .quantize(colors=255, method=Image.FASTOCTREE)
           .save(MEDIA / src.name, optimize=True))


def collect_assets():
    """(첫 페인트용 = poster·폴백 PNG, 나중에 붙일 = 영상) 두 묶음으로 나눈다."""
    first, videos = {}, {}
    for f in sorted(MEDIA.glob("*")):
        if f.suffix == ".mp4":
            videos[f.stem.replace("doryeong-", "")] = data_uri(f)
        elif f.suffix == ".jpg":
            first[f"assets/video/{f.name}"] = data_uri(f)
        elif f.suffix == ".png":
            first[f"assets/web/{f.name}"] = data_uri(f)
    return first, videos


def js_object(name: str, table: dict) -> str:
    rows = ",\n".join(f'  "{k}": "{v}"' for k, v in table.items())
    return f"const {name} = {{\n" + rows + "\n};"


def build():
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    title_m = re.search(r"<title>(.*?)</title>", html, re.S)
    title = title_m.group(1).strip() if title_m else "온도령 만세력 상담소"

    body_m = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not body_m:
        raise SystemExit("index.html에서 <body>를 찾지 못했습니다.")
    body = body_m.group(1)
    body = re.sub(r'\s*<script src="[^"]*"></script>', "", body)  # 외부 스크립트 태그 제거

    css = (ROOT / "css" / "style.css").read_text(encoding="utf-8")

    prepare_media()
    first, videos = collect_assets()
    if not first or not videos:
        raise SystemExit("인라인할 미디어를 만들지 못했습니다. tools/optimize_media.py 를 먼저 실행하세요.")

    js_parts = [js_object("DR_ASSETS", first)]
    for s in SCRIPTS:
        p = ROOT / s
        if not p.exists():
            raise SystemExit(f"필수 스크립트 없음: {s}")
        js_parts.append(f"/* ==== {s} ==== */\n" + p.read_text(encoding="utf-8"))
    js = "\n\n".join(js_parts)

    # 영상은 별도 스크립트로 뒤에 둔다. 앱이 먼저 그려지고 poster가 보인 뒤 영상이 붙는다.
    js_video = js_object("DR_VIDEOS", videos) + "\nDoryeong.attachVideos(DR_VIDEOS);"

    # 스크립트는 반드시 본문 뒤에 온다. app.js가 즉시 실행되며 DOM을 찾기 때문이다.
    inner = (
        f"<title>{title}</title>\n"
        f"<style>\n{css}\n</style>\n"
        f"{body}\n"
        f"<script>\n{js}\n</script>\n"
        f"<script defer>\n{js_video}\n</script>\n"
    )

    doc = (
        "<!DOCTYPE html>\n"
        '<html lang="ko">\n'
        "<head>\n"
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
        '<meta name="color-scheme" content="dark">\n'
        '<meta name="description" content="생년월일시로 사주 명식을 세우고 심리·생애주기 상담의 언어로 풀어주는 온도령 만세력 상담소">\n'
        f"<title>{title}</title>\n"
        f"<style>\n{css}\n</style>\n"
        "</head>\n"
        "<body>\n"
        f"{body}\n"
        f"<script>\n{js}\n</script>\n"
        f"<script>\n{js_video}\n</script>\n"
        "</body>\n</html>\n"
    )

    OUT.mkdir(parents=True, exist_ok=True)
    full = OUT / "온도령-만세력-상담소.html"
    frag = OUT / "_artifact-body.html"
    full.write_text(doc, encoding="utf-8")
    frag.write_text(inner, encoding="utf-8")

    for f in (full, frag):
        print(f"{f.name}: {f.stat().st_size / 1024 / 1024:.2f}MB")
    head_kb = len(inner.split("<script defer>")[0].encode()) / 1024
    print(f"첫 페인트까지 {head_kb / 1024:.2f}MB, 영상은 그 뒤에 붙음")
    print(f"인라인 에셋 {len(first) + len(videos)}개, 외부 요청 0건")


if __name__ == "__main__":
    build()
