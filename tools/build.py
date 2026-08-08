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

REQUIRED_FILES = ["index.html"]
OPTIONAL_FILES = ["README.md"]
DIRS = ["css", "js", "assets/web", "assets/video"]


def main():
    # 1) 먼저 전부 검증한다. 입력이 하나라도 없으면 기존 dist/ 는 손대지 않는다.
    missing = [p for p in REQUIRED_FILES + DIRS if not (ROOT / p).exists()]
    if missing:
        raise SystemExit("필수 입력 없음: " + ", ".join(missing))

    # 2) 임시 디렉터리에 완성한 뒤에야 dist/ 와 교체한다.
    staging = ROOT / "dist.tmp"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir()

    for f in REQUIRED_FILES + OPTIONAL_FILES:
        src = ROOT / f
        if src.exists():
            shutil.copy2(src, staging / src.name)
    for d in DIRS:
        shutil.copytree(ROOT / d, staging / d, dirs_exist_ok=True)

    if DIST.exists():
        shutil.rmtree(DIST)
    staging.replace(DIST)

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    count = sum(1 for p in DIST.rglob("*") if p.is_file())
    print(f"dist/ 생성 완료. 파일 {count}개, {total / 1024 / 1024:.2f}MB")
    print("정적 서버의 루트를 dist/ 로 잡으면 된다.")


if __name__ == "__main__":
    main()
