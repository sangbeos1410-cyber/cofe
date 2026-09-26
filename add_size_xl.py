from pathlib import Path
from datetime import datetime
import re
import shutil

ROOT = Path(__file__).resolve().parent
names = ['public/admin.html', 'public/admin.js', 'public/admin-v5.js']
files = {}
for name in names:
    path = ROOT / name
    if not path.is_file():
        raise SystemExit('Thiếu ' + name + '. Đặt script cạnh firebase.json.')
    files[name] = path.read_text(encoding='utf-8-sig')

html = files['public/admin.html']
if 'id="sizeXL"' not in html:
    pattern = r'(<div>\s*<label\s+for="sizeL"[\s\S]*?</div>)'
    block = '<div><label for="sizeXL">Size XL</label><input id="sizeXL" type="number" min="0" step="1000" placeholder="Giá bán XL"></div>'
    html, count = re.subn(pattern, lambda m: m.group(1) + '\n' + block, html, count=1)
    if count != 1:
        raise SystemExit('Không tìm thấy ô size L. Chưa sửa file nào.')

js = files['public/admin.js']
if '["XL", $("sizeXL").value]' not in js:
    pattern = r'\["L",\s*\$\("sizeL"\)\.value\]'
    js, count = re.subn(pattern, lambda m: m.group() + ',\n    ["XL", $("sizeXL").value]', js, count=1)
    if count != 1:
        raise SystemExit('Không tìm thấy danh sách size. Chưa sửa file nào.')
if '$("sizeXL").value = "";' not in js:
    js, count = re.subn(r'\$\("sizeL"\)\.value\s*=\s*"";', lambda m: m.group() + '\n    $("sizeXL").value = "";', js, count=1)
    if count != 1:
        raise SystemExit('Không tìm thấy phần xóa giá size cũ. Chưa sửa file nào.')

extra = files['public/admin-v5.js']
extra, count = re.subn(r"\[\s*(['\"])S\1\s*,\s*(['\"])M\2\s*,\s*(['\"])L\3\s*\]", "['S','M','L','XL']", extra)
if count == 0 and "['S','M','L','XL']" not in extra:
    raise SystemExit('Không tìm thấy phần giá vốn. Chưa sửa file nào.')
html = re.sub(r'(src="admin(?:-v5)?\.js)(?:\?[^" ]*)?"', lambda m: m.group(1) + '?v=size-xl1"', html)
files.update({'public/admin.html': html, 'public/admin.js': js, 'public/admin-v5.js': extra})
backup = ROOT / 'cheng-backups' / datetime.now().strftime('size-xl-%Y%m%d-%H%M%S-%f')
for name in files:
    saved = backup / name
    saved.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / name, saved)
for name, content in files.items():
    (ROOT / name).write_text(content, encoding='utf-8')
print('Đã thêm size XL và giá vốn XL. Sao lưu: ' + str(backup))
