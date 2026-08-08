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
    ffprobe = shutil.which("ffprobe")
    for src in sorted(VID.glob("doryeong-*.mp4")):
        if ffprobe:
            # 이미 목표 폭이면 건너뛴다 — 반복 실행 시 재압축으로 화질이 깎이는 걸 막는다
            w = subprocess.run([ffprobe, "-v", "error", "-select_streams", "v:0",
                                "-show_entries", "stream=width", "-of", "csv=p=0", str(src)],
                               capture_output=True, text=True).stdout.strip()
            if w.isdigit() and int(w) <= VIDEO_WIDTH:
                print(f"{src.name}: 이미 {w}px — 건너뜀")
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
    """리사이즈 + 255색 팔레트 양자화. 셀셰이딩 일러스트라 색 손실이 눈에 띄지 않고 용량은 1/5 이하가 된다."""
    for src in sorted(WEB.glob("doryeong-*.png")):
        img = Image.open(src)
        if img.width <= PNG_WIDTH and img.mode == "P":
            print(f"{src.name}: 이미 최적화됨 — 건너뜀")
            continue
        before = src.stat().st_size
        if img.width > PNG_WIDTH:
            h = round(img.height * PNG_WIDTH / img.width)
            img = img.resize((PNG_WIDTH, h), Image.LANCZOS)
        img.convert("RGBA").quantize(colors=255, method=Image.FASTOCTREE).save(src, optimize=True)
        print(f"{src.name}: {before // 1024}KB -> {src.stat().st_size // 1024}KB")


if __name__ == "__main__":
    optimize_videos()
    optimize_pngs()
