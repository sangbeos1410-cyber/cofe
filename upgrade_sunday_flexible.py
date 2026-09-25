# Cheng Coffee - Sunday update v2. No triple-quoted strings.
from pathlib import Path
from datetime import datetime
import base64
import hashlib
import json
import re
import shutil
import zlib

ROOT = Path(__file__).resolve().parent
PAYLOAD = (
    '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'
)
EXPECTED_SHA256 = '42f4098921e99c2123e19cfe23060d86d570ab846c7f37b186f567987ff29d15'

def main():
    if hashlib.sha256(PAYLOAD.encode()).hexdigest() != EXPECTED_SHA256:
        raise SystemExit("Noi dung script bi thieu. Hay sao chep lai toan bo file.")
    data = json.loads(zlib.decompress(base64.b64decode(PAYLOAD)))
    files = data["files"]
    required =     required = [
        "firebase.json",
        "public/index.html",
        "public/admin.html",
        "public/admin-themes.js",
        "public/season-themes.js",
        "functions/pricing-v5.js",
        "firestore.rules",
    ]

    for name in required:
        if not (ROOT / name).is_file():
            raise SystemExit(
                "Thieu " + name
                + ". Dat script canh firebase.json, khong dat trong public."
            )

    rules = (ROOT / "firestore.rules").read_text(encoding="utf-8-sig")

    for before, after in data["patches"]:
        if after in rules:
            continue
        if before not in rules:
            raise SystemExit(
                "firestore.rules khac cau truc du kien. Chua thay doi file nao."
            )
        rules = rules.replace(before, after, 1)

    files["firestore.rules"] = rules

    for name in ["public/index.html", "public/admin.html"]:
        html = (ROOT / name).read_text(encoding="utf-8-sig")

        for script in [
            "pricing-v5.js",
            "admin-themes.js",
            "season-themes.js",
        ]:
            pattern = r'(src="' + re.escape(script) + r')(?:\?[^" ]*)?"'
            html = re.sub(
                pattern,
                lambda m: m.group(1) + '?v=sunday-flex2"',
                html,
            )

        if name == "public/index.html" and "sunday-message.css" not in html:
            if "</head>" not in html:
                raise SystemExit(
                    "Khong tim thay </head>. Chua thay doi file nao."
                )
            html = html.replace(
                "</head>",
                '<link rel="stylesheet" href="sunday-message.css?v=2">\n</head>',
                1,
            )

        files[name] = html

    backup = (
        ROOT
        / "cheng-backups"
        / datetime.now().strftime("sunday-v2-%Y%m%d-%H%M%S-%f")
    )

    manifest = {}
    for name in files:
        target = ROOT / name
        if target.exists() and not target.is_file():
            raise SystemExit("Duong dan phai la file: " + name)
        manifest[name] = target.is_file()

    backup.mkdir(parents=True)

    for name, existed in manifest.items():
        if existed:
            saved = backup / name
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, saved)

    (backup / "manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )

    try:
        for name, content in files.items():
            target = ROOT / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
    except Exception:
        for name, existed in manifest.items():
            target = ROOT / name
            if existed:
                shutil.copy2(backup / name, target)
            elif target.is_file():
                target.unlink()
        raise

    print("THANH CONG: da them banner tu viet va lua chon Mon bat ky.")
    print("Sao luu: " + str(backup))


if __name__ == "__main__":
    main()