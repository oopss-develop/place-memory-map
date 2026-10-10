import json, math
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
out = root / '_review'
out.mkdir(exist_ok=True)
for start in range(0, len(manifest['files']), 24):
    batch = manifest['files'][start:start+24]
    sheet = Image.new('RGB', (1360, math.ceil(len(batch)/4)*130), '#dddddd')
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(batch):
        x, y = (index % 4)*340, (index//4)*130
        with Image.open(root / item['filename']) as gif:
            item['frameCount'] = gif.n_frames
            draw.text((x+4,y+3), f"{item['id']} ({gif.n_frames} frames)", fill='black')
            for k, ratio in enumerate([0, .33, .66, 1]):
                gif.seek(round((gif.n_frames-1)*ratio))
                frame = gif.convert('RGBA')
                bg = Image.new('RGBA', frame.size, 'white')
                bg.alpha_composite(frame)
                thumb = ImageOps.contain(bg.convert('RGB'), (82,100))
                sheet.paste(thumb, (x+k*84+3+(82-thumb.width)//2,y+24+(100-thumb.height)//2))
    sheet.save(out / f'sheet-{start//24+1:02}.jpg', quality=93)
(out / 'items.json').write_text(json.dumps(manifest['files'], ensure_ascii=False, indent=2), encoding='utf-8')
print(f"Rendered {len(manifest['files'])} GIFs into {math.ceil(len(manifest['files'])/24)} sheets")
