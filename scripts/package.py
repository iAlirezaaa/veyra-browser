#!/usr/bin/env python3
"""Build a reproducible, unpacked-Chromium install ZIP from the repository root."""
from pathlib import Path
from hashlib import sha256
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))['version']
output = root / 'dist'
output.mkdir(exist_ok=True)
filename = f'veyra-v{version}-chrome.zip'
files = sorted([root / 'manifest.json'] + [p for p in (root / 'src').rglob('*') if p.is_file() and not p.name.startswith('.')] + [root / f'assets/icon{size}.png' for size in (16, 48, 128)])
required = ['manifest.json', 'src/ui/newtab.html', 'src/ui/popup.html', 'src/ui/appearance.js', 'assets/icon16.png', 'assets/icon48.png', 'assets/icon128.png']
for required_name in required:
    if not (root / required_name).is_file():
        raise SystemExit(f'Missing extension file: {required_name}')
with zipfile.ZipFile(output / filename, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for path in files:
        # Stable timestamps, file mode and sorted order keep the package reproducible.
        info = zipfile.ZipInfo(path.relative_to(root).as_posix(), date_time=(2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
with zipfile.ZipFile(output / filename) as archive:
    if archive.testzip():
        raise SystemExit('ZIP archive validation failed')
    names = set(archive.namelist())
    if not all(path in names for path in required):
        raise SystemExit('Install package missing required files')
digest = sha256((output / filename).read_bytes()).hexdigest()
(output / 'SHA256SUMS.txt').write_text(f'{digest}  {filename}\n', encoding='utf-8')
print(f'Packaged {output / filename} ({len(files)} files; SHA256 {digest})')
