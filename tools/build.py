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

# deep.html 이 여기 같이 있었다. 19,800원짜리 심층 풀이 상세페이지였는데,
# 값을 한 번 4,900원 하나로 합치면서 파는 물건이 아니게 되어 지웠다.
# 필수 목록에 남겨두면 빌드가 "필수 입력 없음" 으로 멈춘다.
REQUIRED_FILES = ["index.html", "story.html"]
OPTIONAL_FILES = ["README.md"]
DIRS = ["css", "js", "assets/web", "assets/video"]
# 컷 앵커. **webp 만 올린다** — png 원본은 15.5MB 인데 webp 는 1.1MB 다.
# assets/concept(184MB, 컨셉 고르기용 60장)은 배포에 넣지 않는다. 고르고 나면 쓸모가 없다.
GLOB_ONLY = {"assets/scene": ("*.webp",)}
LOOSE_FILES = ["assets/og.jpg"]


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
    for d, pats in GLOB_ONLY.items():
        dst = staging / d
        dst.mkdir(parents=True, exist_ok=True)
        for pat in pats:
            for f in (ROOT / d).glob(pat):
                shutil.copy2(f, dst / f.name)
    for f in LOOSE_FILES:
        src = ROOT / f
        if src.exists():
            (staging / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, staging / f)

    # 스크립트·스타일에 내용 해시를 붙인다.
    # GitHub Pages 는 캐시를 오래 물고 있어서, 이걸 안 하면 index.html 만 새로 받고
    # app.js 는 옛것을 쓰는 상태가 된다 (개발 중에 실제로 겪었다).
    stamp_assets(staging)

    if DIST.exists():
        shutil.rmtree(DIST)
    staging.replace(DIST)

    total = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    count = sum(1 for p in DIST.rglob("*") if p.is_file())
    (DIST / ".nojekyll").write_text("", encoding="utf-8")  # GitHub Pages가 _로 시작하는 경로를 지우지 않게
    print(f"docs/ 생성 완료. 파일 {count}개, {total / 1024 / 1024:.2f}MB")
    print("GitHub Pages 소스를 main 브랜치 /docs 로 잡으면 그대로 서비스된다.")



def stamp_assets(staging):
    """index.html 안의 로컬 js/css 참조에 ?v=<내용해시8> 를 붙인다."""
    import hashlib, re
    for page in ("index.html", "story.html"):
        _stamp_one(staging, page)


def _stamp_one(staging, page):
    import hashlib, re
    html_path = staging / page
    if not html_path.exists():
        return
    html = html_path.read_text(encoding="utf-8")

    def digest(rel):
        f = staging / rel
        if not f.exists():
            return None
        return hashlib.sha256(f.read_bytes()).hexdigest()[:8]

    def sub(m):
        attr, rel = m.group(1), m.group(2)
        h = digest(rel)
        if h is None:
            print(f"  ! 참조된 파일이 없다: {rel}")
            return m.group(0)
        return f'{attr}="{rel}?v={h}"'

    html, n = re.subn(r'(src|href)="((?:js|css)/[^"?]+)"', sub, html)
    html_path.write_text(html, encoding="utf-8")
    print(f"  cache bust: {page} - {n} hashed refs")


if __name__ == "__main__":
    main()

