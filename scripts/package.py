#!/usr/bin/env python3
from pathlib import Path
import zipfile
root=Path(__file__).resolve().parents[1]
out=root.parent
for name,paths in {
    'veyra-chrome-extension.zip':['manifest.json','assets','src'],
    'veyra-browser-source.zip':['manifest.json','assets','src','docs','tests','scripts','README.md','README.fa.md','LICENSE','THIRD_PARTY_NOTICES.md','AGENTS.md','package.json','.github','.gitignore']
}.items():
    with zipfile.ZipFile(out/name,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for x in paths:
            p=root/x
            if p.is_file(): z.write(p,p.relative_to(root));continue
            for child in p.rglob('*'):
                if child.is_file() and not any(part == '.git' for part in child.relative_to(root).parts):
                    z.write(child,child.relative_to(root))
    print(out/name)
