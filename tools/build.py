"""
배포 번들 생성 (build.py)

저장소 루트를 그대로 정적 서버에 올리면 생성 원본(assets/_master, ~9MB)과
개발 도구까지 공개된다. 이 스크립트는 실제로 필요한 것만 dist/ 로 복사한다.

실행: python tools/build.py
결과: docs/ (index.html, css, js, assets/web, assets/video)

docs/ 를 그대로 GitHub Pages 로 서빙한다. 생성 원본(assets/_master)과 도구는 포함하지 않는다.
단일 파일 번들은 tools/build_single.py 가 dist/share/ 에 따로 만든다. 서로 건드리지 않는다.
"""
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "docs"

REQUIRED_FILES = ["index.html"]
OPTIONAL_FILES = ["README.md"]
DIRS = ["css", "js", "assets/web", "assets/video"]


def main():
    # 1) 먼저 전부 검증한다. 입력이 하나라도 없으면 기존 dist/ 는 손대지 않는다.
    missing = [p for p in REQUIRED_FILES + DIRS if not (ROOT / p).exists()]
    if missing:
        raise SystemExit("필수 입력 없음: " + ", ".join(missing))

    # 2) 임시 디렉터리에 완성한 뒤에야 dist/ 와 교체한다.
    staging = ROOT / "_docs.tmp"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)

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
    (DIST / ".nojekyll").write_text("", encoding="utf-8")  # GitHub Pages가 _로 시작하는 경로를 지우지 않게
    print(f"docs/ 생성 완료. 파일 {count}개, {total / 1024 / 1024:.2f}MB")
    print("GitHub Pages 소스를 main 브랜치 /docs 로 잡으면 그대로 서비스된다.")


if __name__ == "__main__":
    main()
