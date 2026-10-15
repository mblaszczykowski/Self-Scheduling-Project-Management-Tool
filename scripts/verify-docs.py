#!/usr/bin/env python3
"""Check local Markdown links and screenshot references without additional dependencies."""
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
files = subprocess.check_output(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '*.md'], cwd=ROOT, text=True).splitlines()
errors = []
for name in files:
    source = ROOT / name
    if not source.exists():
        continue
    body = re.sub(r'```.*?```', '', source.read_text(), flags=re.S)
    for match in re.finditer(r'!?\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)', body):
        target = match.group(1).strip('<>')
        if re.match(r'^[a-z][a-z\d+.-]*:', target, flags=re.I) or target.startswith('#'):
            continue
        relative = unquote(target.split('#', 1)[0].split('?', 1)[0])
        path = source.parent / relative
        if relative and not path.exists():
            errors.append(f'{name}: missing link {target}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Local links verified in {len(files)} Markdown files.')
