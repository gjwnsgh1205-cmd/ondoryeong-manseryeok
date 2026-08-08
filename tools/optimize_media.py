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
    ffprobe = shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        # ffprobe 없이 진행하면 이미 최적화된 영상을 매 실행마다 재압축해 화질이 깎인다
        raise SystemExit("ffmpeg와 ffprobe가 모두 필요합니다. 설치 후 다시 실행하세요.")

    for src in sorted(VID.glob("doryeong-*.mp4")):
        info = subprocess.run(
            [ffprobe, "-v", "error", "-select_streams", "v:0", "-show_entries",
             "stream=width,codec_name,pix_fmt", "-of", "csv=p=0", str(src)],
            capture_output=True, text=True).stdout.strip().split(",")
        if len(info) == 3:
            codec, w, pix = info[0], info[1], info[2]
            # 폭·코덱·픽셀포맷이 모두 목표치면 재인코딩할 이유가 없다
            if w.isdigit() and int(w) <= VIDEO_WIDTH and codec == "h264" and pix == "yuv420p":
                print(f"{src.name}: 이미 {w}px {codec}/{pix} — 건너뜀")
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


def make_posters():
    """각 mp4의 첫 프레임을 poster용 JPEG로 뽑는다. 영상과 프레이밍이 정확히 같아 재생 전후로 그림이 튀지 않는다."""
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return
    for src in sorted(VID.glob("doryeong-*.mp4")):
        out = src.with_suffix(".jpg")
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(src),
                        "-frames:v", "1", "-q:v", "4", str(out)], check=True)
        print(f"{out.name}: poster {out.stat().st_size // 1024}KB")


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
    make_posters()
    optimize_pngs()
