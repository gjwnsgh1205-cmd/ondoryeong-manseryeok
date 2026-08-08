"""
배포 번들 생성 (build.py)

저장소 루트를 그대로 정적 서버에 올리면 생성 원본(assets/_master, ~9MB)과
개발 도구까지 공개된다. 이 스크립트는 실제로 필요한 것만 dist/ 로 복사한다.

실행: python tools/build.py
결과: dist/ (index.html, css, js, assets/web, assets/video)
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

FILES = ["index.html", "README.md"]
DIRS = ["css", "js", "assets/web", "assets/video"]


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    for f in FILES:
        src = ROOT / f
        if src.exists():
            shutil.copy2(src, DIST / src.name)

    missing = []
    for d in DIRS:
        src = ROOT / d
        if not src.exists():
            missing.append(d)
            continue
        shutil.copytree(src, DIST / d, dirs_exist_ok=True)

    if missing:
        raise SystemExit("필수 디렉터리 없음: " + ", ".join(missing))

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    count = sum(1 for p in DIST.rglob("*") if p.is_file())
    print(f"dist/ 생성 완료. 파일 {count}개, {total / 1024 / 1024:.2f}MB")
    print("정적 서버의 루트를 dist/ 로 잡으면 된다.")


if __name__ == "__main__":
    main()
