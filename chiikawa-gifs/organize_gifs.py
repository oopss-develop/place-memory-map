import csv, hashlib, json, re
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parent
manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))

# Reviewed visually using four frames per GIF, with enlarged ambiguous scenes.
groups = {
    '우사기': '249 219 181 269 228 197 230 719 217 245 246 235 628 2186 2085 215 233 2101 227 195 606 610 714 222 2188 661 225 619 588 2095 665 695 575 608',
    '하치와레': '243 261 255 260 192 203 214 199 239 645 218 213 201 207 253 580 643 262 236 247 709 614 229 204 701 620 658 657 630 616 656 597 673 679 599 705 693 644 633 582 206 609 612 700 638 611 179 2107 596 576 2117 592 685 678 641 622 621 2119',
    '모몽가': '259 212 220 189 2090 618 2091 2096',
    '쿠리만쥬': '2088 2087 2084 2185 2086 2083 2089 2103',
    '랏코': '2118 2116 2122 2112',
    '시사': '2092 2102 2098 2097 2093 2099 2104',
    '카니': '2115 2108 2121 2109 2105 2106 2114 2120 2111 2113',
    '세이렌': '2184 2238 2239 2236 2231 2240 2232 2242 2235 2233 2237 2234 2241',
    '아노코': '2382 2380 2379 2378 2381',
    '검은별': '659 650 604 623',
    '기타': '713 626',
}
characters = {}
for character, ids in groups.items():
    for identifier in map(int, ids.split()):
        assert identifier not in characters
        characters[identifier] = [character]

duos = {
    '치이카와+하치와레': '244 716 202 267 221 190 242 263 185 198 196 578 187 648 579 698 676 593',
    '우사기+하치와레': '722 265 725 631 724 625 572 603',
    '치이카와+우사기': '640 674 662',
    '치이카와+하치와레+우사기': '241 254 258 177 223 216 718 707',
    '세이렌+치이카와+하치와레+우사기': '2187',
    '랏코+갑옷씨': '2110',
    '쿠리만쥬+모몽가': '2100',
}
for joined, ids in duos.items():
    for identifier in map(int, ids.split()):
        assert identifier not in characters
        characters[identifier] = joined.split('+')

overrides = {
    249:'깡총깡총 뛰기', 243:'엎드려 꼬리 흔들기', 254:'벽 뒤에서 셋이 빼꼼',
    211:'불붙은 마시멜로 들고 달리기', 230:'돌아서 꼬리 흔들기', 256:'택배 상자 들고 달리기',
    201:'웅크려 꼬리 흔들기', 177:'택배 상자 들고 달리기', 253:'눈 감고 활짝 웃기',
    200:'뒤돌아 손 흔들기', 210:'택배 상자 들고 넘어지기', 185:'나란히 웃으며 달리기',
    206:'혀 내밀기', 179:'깡총깡총 뛰기', 725:'하치와레 옆에서 걷기',
    238:'나무 뒤에서 빼꼼', 646:'버섯 모자 쓰고 포자 뿜기', 587:'풀밭에 누워 쉬기',
    2188:'모몽가 옷 입고 밤하늘 날기', 670:'간식 들고 그늘에서 돌아보기',
    697:'문 앞에서 빼꼼 나오기', 2184:'커다란 얼굴로 간식 먹기',
    2187:'친구들 앞에서 노래하고 눈빛 바꾸기', 2110:'갑옷씨 옆에서 가시 갑옷 입기',
    2093:'노란 갑옷 입고 웃기', 2097:'책 들고 폴짝 뛰기', 2107:'꽃게 머리띠 쓰고 웃기',
    2117:'꽃게 머리띠 쓰고 뒤돌아보기', 2119:'꽃게 머리띠 쓰고 미소',
    2108:'책 들고 떨며 뒤돌아보기', 2113:'꽃게 머리띠 쓰고 뒤돌아보기',
    626:'꽃 캐릭터가 주먹 쥐고 응원', 685:'뒤돌아 꼬리 흔들기',
    612:'진지하게 팬케이크 먹기', 611:'풀밭에 엎드려 돌아보기',
    2100:'모몽가 옆에서 뒤돌아 간식 먹기', 707:'친구들 사이에서 식탁 앞 긴장',
    603:'탁자에 엎드린 우사기와 하치와레', 593:'카메라 앞에서 하치와레 포즈',
    579:'가방 메고 함께 걷기', 676:'옆에 친구 두고 신나게 걷기',
}

manifest['organization'] = {
    'method': 'Visual review of four sampled frames per GIF; ambiguous scenes enlarged. Characters appearing together are grouped under 함께_등장.',
    'naming': '캐릭터_동작_원본ID.gif',
    'aliases': {'랏코':'해달', '쿠리만쥬':'밤만쥬', '카니':'고서점·후루혼야', '세이렌':'세이레ーン'},
}
planned = []
for item in manifest['files']:
    identifier = item['id']
    cast = characters.get(identifier, ['치이카와'])
    folder = '함께_등장' if len(cast) > 1 else cast[0]
    title = overrides.get(identifier, item['title'])
    if not title:
        raise ValueError(f'Missing description: {identifier}')
    if identifier not in overrides:
        title = re.sub(r'(치이카와|하치와레|우사기|모몽가|모몬가|밤만쥬|쿠리만쥬|해달|랏코|시사|카니|가르마|세이렌|아노코)(?:들이|들|가|이|의|를|와|과)?', '', title)
        title = re.sub(r'GIF|움짤|리액션|귀여운|귀엽게|사랑스러운|치이카와 시리즈|시리즈|캐릭터|모습의|모습|得意하게', '', title, flags=re.I)
        title = re.sub(r'^[\s,]+|[\s,]+$', '', title)
    description = re.sub(r'[\s,]+', '_', title)
    description = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', description).strip('_.')
    filename = f"{'-'.join(cast)}_{description}_{identifier:04d}.gif"
    relative = Path(folder) / filename
    source = root / item['filename']
    destination = root / relative
    assert source.resolve().is_relative_to(root.resolve()) and destination.resolve().is_relative_to(root.resolve())
    assert source.is_file(), source
    assert not destination.exists(), destination
    assert hashlib.sha256(source.read_bytes()).hexdigest() == item['sha256'], source
    planned.append((item, source, destination, relative, cast, description))

(root / 'manifest.before-organization.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
for item, source, destination, relative, cast, description in planned:
    destination.parent.mkdir(exist_ok=True)
    source.rename(destination)
    item['originalFilename'] = item['filename']
    item['filename'] = relative.as_posix()
    item['characters'] = cast
    item['description'] = description.replace('_', ' ')
    item['visualReview'] = 'four_frames_and_enlarged_ambiguous_scenes'
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == item['sha256']
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
with (root / '분류목록.csv').open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.writer(stream)
    writer.writerow(['원본ID','폴더','캐릭터','설명','새파일경로','원래파일명','원본URL'])
    for item in manifest['files']:
        writer.writerow([item['id'],Path(item['filename']).parent.as_posix(),'+'.join(item['characters']),item['description'],item['filename'],item['originalFilename'],item['url']])
counts = Counter(Path(item['filename']).parent.as_posix() for item in manifest['files'])
print(json.dumps(dict(sorted(counts.items())), ensure_ascii=False, indent=2))
print(f"Verified {len(planned)} files: original SHA-256 hashes unchanged")
