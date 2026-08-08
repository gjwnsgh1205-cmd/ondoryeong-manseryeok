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

# 인라인할 목록은 여기 적지 않는다. 손으로 베껴 적으면 스크립트가 늘 때마다
# 조용히 어긋나기 때문이다 (실제로 content/report/topics/consult/sky 가 빠진 채
# 번들이 나가서 "Report is not defined" 로 죽었다).
# index.html 의 로드 순서가 곧 의존 순서이니, 매번 거기서 읽는다.
# tools/build.py 가 붙이는 ?v=해시 가 달려 있어도 견디게 쿼리스트링을 허용한다.
SCRIPT_TAG = re.compile(
    r'[^\S\n]*<script\b[^>]*\bsrc\s*=\s*"([^"]*)"[^>]*>\s*</script>\n?', re.I)
STYLE_TAG = re.compile(
    r'[^\S\n]*<link\b(?=[^>]*\brel\s*=\s*"stylesheet")[^>]*\bhref\s*=\s*"([^"]*)"[^>]*>\n?', re.I)

# 소스맵 주석이 남으면 개발자도구가 없는 .map 을 찾아 나선다. 외부 요청 0건이 목표다.
# (korean-lunar.min.js 는 개행 없이 이 주석으로 끝난다)
SOURCEMAP = re.compile(r'^[^\S\n]*//[#@]\s*sourceMappingURL=.*$', re.M)

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


def local_ref(url: str):
    """인라인할 수 있는 참조면 저장소 기준 경로를, 외부 참조면 None 을 준다."""
    if not url or url.startswith(("http://", "https://", "//", "data:", "#")):
        return None
    return url.split("?", 1)[0].split("#", 1)[0]


def read_refs(html: str, pattern: re.Pattern, what: str) -> list:
    """index.html 이 적어둔 순서 그대로 돌려준다. 순서가 곧 의존 순서다."""
    refs = []
    for url in pattern.findall(html):
        rel = local_ref(url)
        if rel is None:
            continue
        if not (ROOT / rel).exists():
            raise SystemExit(f"index.html 이 가리키는 {what} 없음: {rel}")
        refs.append(rel)
    if not refs:
        raise SystemExit(f"index.html 에서 {what}를 하나도 찾지 못했습니다.")
    return refs


def strip_inlined(html: str, pattern: re.Pattern) -> str:
    """인라인한 태그만 지운다. 외부 참조는 지우면 기능이 사라지므로 남겨 둔다."""
    return pattern.sub(lambda m: "" if local_ref(m.group(1)) else m.group(0), html)


def inline_text(rel: str) -> str:
    return SOURCEMAP.sub("", (ROOT / rel).read_text(encoding="utf-8")).strip()


def script_tag(label: str, code: str) -> str:
    """파일마다 <script> 를 따로 둔다. index.html 과 실행 단위가 같아져야
    'use strict' 범위나 세미콜론 생략에 걸려 뒷 파일이 통째로 먹히지 않는다."""
    return f"<script>\n/* ==== {label} ==== */\n{code}\n</script>"


def external_refs(doc: str) -> list:
    """data:/앵커를 뺀 src·href 는 전부 네트워크를 타는 참조다.
    인라인한 <script> 속은 마크업이 아니라 코드라 검사에서 뺀다 — doryeong.js 는
    data URI 를 런타임에 끼워 넣는 `src="${mp4}"` 같은 템플릿을 들고 있다.
    다만 src 가 달린 <script> 는 남긴다. 그게 바로 잡아내려는 대상이다."""
    markup = re.sub(r'<script\b(?![^>]*\bsrc\s*=)[^>]*>.*?</script>', "", doc,
                    flags=re.S | re.I)
    return sorted({m.group(0) for m in re.finditer(r'\b(?:src|href)="([^"]*)"', markup)
                   if local_ref(m.group(1)) is not None})


def build():
    html = (ROOT / "index.html").read_text(encoding="utf-8")

    title_m = re.search(r"<title>(.*?)</title>", html, re.S)
    title = title_m.group(1).strip() if title_m else "온도령 만세력 상담소"

    desc_m = re.search(r'<meta name="description" content="([^"]*)"', html, re.I)
    desc = desc_m.group(1) if desc_m else ""

    # <link> 는 <head> 에 있으므로 문서 전체에서 읽는다.
    scripts = read_refs(html, SCRIPT_TAG, "스크립트")
    styles = read_refs(html, STYLE_TAG, "스타일시트")

    body_m = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not body_m:
        raise SystemExit("index.html에서 <body>를 찾지 못했습니다.")
    body = strip_inlined(strip_inlined(body_m.group(1), SCRIPT_TAG), STYLE_TAG).strip("\n")

    css = "\n".join(inline_text(rel) for rel in styles)

    prepare_media()
    first, videos = collect_assets()
    if not first or not videos:
        raise SystemExit("인라인할 미디어를 만들지 못했습니다. tools/optimize_media.py 를 먼저 실행하세요.")

    # DR_ASSETS 는 doryeong.js 보다 먼저 있어야 한다 (경로→data URI 표를 그때 읽는다).
    js_parts = [script_tag("bundle: 첫 페인트용 에셋", js_object("DR_ASSETS", first))]
    js_parts += [script_tag(rel, inline_text(rel)) for rel in scripts]
    js = "\n".join(js_parts)

    # 영상은 별도 스크립트로 뒤에 둔다. 앱이 먼저 그려지고 poster가 보인 뒤 영상이 붙는다.
    js_video = script_tag(
        "bundle: 영상",
        js_object("DR_VIDEOS", videos) + "\nDoryeong.attachVideos(DR_VIDEOS);")

    # 스크립트는 반드시 본문 뒤에 온다. app.js가 즉시 실행되며 DOM을 찾기 때문이다.
    inner = (
        f"<title>{title}</title>\n"
        f"<style>\n{css}\n</style>\n"
        f"{body}\n"
        f"{js}\n"
        f"{js_video}\n"
    )

    doc = (
        "<!DOCTYPE html>\n"
        '<html lang="ko">\n'
        "<head>\n"
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">\n'
        '<meta name="color-scheme" content="dark">\n'
        f'<meta name="description" content="{desc}">\n'
        f"<title>{title}</title>\n"
        f"<style>\n{css}\n</style>\n"
        "</head>\n"
        "<body>\n"
        f"{body}\n"
        f"{js}\n"
        f"{js_video}\n"
        "</body>\n</html>\n"
    )

    OUT.mkdir(parents=True, exist_ok=True)
    full = OUT / "온도령-만세력-상담소.html"
    frag = OUT / "_artifact-body.html"
    full.write_text(doc, encoding="utf-8")
    frag.write_text(inner, encoding="utf-8")

    for f in (full, frag):
        print(f"{f.name}: {f.stat().st_size / 1024 / 1024:.2f}MB")
    first_paint = (len(inner.encode()) - len(js_video.encode())) / 1024 / 1024
    print(f"첫 페인트까지 {first_paint:.2f}MB, 영상은 그 뒤에 붙음")
    print(f"인라인: 스타일 {len(styles)}개, 스크립트 {len(scripts)}개, "
          f"에셋 {len(first) + len(videos)}개")
    for rel in styles + scripts:
        print(f"    {rel}")

    # 링크 하나로 끝나야 하는 파일이다. 빠뜨린 참조가 있으면 여기서 잡는다.
    left = external_refs(doc)
    if left:
        raise SystemExit("인라인되지 않은 외부 참조가 남았습니다: " + ", ".join(left))
    print("외부 요청 0건")


if __name__ == "__main__":
    build()
