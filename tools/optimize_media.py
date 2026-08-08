"""
웹 배포용 미디어 최적화 (optimize_media.py)

- assets/video/*.mp4 : 캐릭터 폭에 맞춰 축소 + CRF 재인코딩 + faststart (재생 즉시 시작)
- assets/web/*.png   : 표시 크기의 2배 폭으로 리사이즈 (원본은 1500px 넘어 과하다)

실행: python tools/optimize_media.py   (ffmpeg 필요)
"""
import shutil
import subprocess
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
VID = ROOT / "assets" / "video"
WEB = ROOT / "assets" / "web"

VIDEO_WIDTH = 480    # 표시 폭 210px의 약 2배 + 여유
PNG_WIDTH = 520      # poster/폴백용


def optimize_videos():
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        print("ffmpeg 없음 — 영상 최적화 건너뜀")
        return
    for src in sorted(VID.glob("doryeong-*.mp4")):
        if src.stem.endswith(".min"):
            continue
        tmp = src.with_suffix(".tmp.mp4")
        before = src.stat().st_size
        subprocess.run([
            ffmpeg, "-v", "error", "-y", "-i", str(src),
            "-vf", f"scale={VIDEO_WIDTH}:-2:flags=lanczos",
            "-c:v", "libx264", "-profile:v", "high", "-crf", "26",
            "-preset", "slow", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-an", str(tmp),
        ], check=True)
        tmp.replace(src)
        print(f"{src.name}: {before // 1024}KB -> {src.stat().st_size // 1024}KB")


def optimize_pngs():
    for src in sorted(WEB.glob("doryeong-*.png")):
        img = Image.open(src)
        if img.width <= PNG_WIDTH:
            continue
        before = src.stat().st_size
        h = round(img.height * PNG_WIDTH / img.width)
        img.resize((PNG_WIDTH, h), Image.LANCZOS).save(src, optimize=True)
        print(f"{src.name}: {before // 1024}KB -> {src.stat().st_size // 1024}KB")


if __name__ == "__main__":
    optimize_videos()
    optimize_pngs()
