from pathlib import Path

script_path=Path('.github/scripts/patch_box_flow.py')
src=script_path.read_text()
old="""def rep(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'Could not find block: {label}')
    text = text.replace(old, new, 1)
"""
new="""def rep(old, new, label):
    global text
    if old in text:
        text = text.replace(old, new, 1)
    elif new in text:
        print(f'Already applied: {label}')
    else:
        raise SystemExit(f'Could not find block: {label}')
"""
if old not in src:
    raise SystemExit('Could not patch rep helper')
src=src.replace(old,new,1)
exec(compile(src,str(script_path),'exec'))
