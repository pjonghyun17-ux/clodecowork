# TIFF 시험 파일

`regression.js` 의 TIFF 검사가 쓴다. 모두 같은 40×30 무늬(`pattern.png`)를 libtiff(ImageMagick 6.9 / LIBTIFF 4.5)로 저장한 것이다 —
이 도구의 해독기와 상관없는 쪽에서 만든 파일이어야 검사가 의미가 있다.

무늬: 왼쪽 위 빨강 (0..19, 0..14) · 오른쪽 위 초록 (20..39, 0..14) · 왼쪽 아래 파랑 (0..19, 15..29) ·
가운데 아래 노랑 (20..29, 15..29) · 오른쪽 아래 흰색 (30..39, 15..29)

| 파일 | 형식 |
|---|---|
| rgb-none / rgb-lzw / rgb-lzw-pred / rgb-zip-pred / rgb-packbits | RGB 8비트, 압축 없음·LZW·LZW+예측·ZIP+예측·PackBits |
| rgb16-lzw-pred | RGB 16비트 LZW+예측 |
| rgb-planar-lzw | RGB 평면 저장(PlanarConfiguration 2) |
| rgb-tiled-zip | 16×16 타일 |
| rgb-jpeg | JPEG 압축 TIFF |
| rgba-lzw | 투명(오른쪽 절반 50%) |
| cmyk-none / cmyk-lzw | CMYK 8비트 |
| palette-lzw | 팔레트 4비트 |
| gray8-none | 흑백 8비트 |
| bilevel-packbits | 흑백 4비트 (문턱 60%) |
| bilevel1-none | 흑백 1비트 |
| rgb-orient6 | 방향 태그 6 (90° 돌려 보여야 함 → 30×40) |
| bilevel-g4 | 팩스(CCITT G4) 압축 — **변환 못 함**: 까닭을 알리고 넣지 않아야 한다 |

`ref/*.png` 는 같은 TIFF 를 libtiff 로 풀어 sRGB 8비트로 저장한 기준 그림이다(방향 꼬리표 적용).
검사는 도구가 바꾼 그림과 기준 그림을 화소마다 견준다 (JPEG 압축 TIFF 만 차이 24 까지 봐준다).

다시 만들기 (ImageMagick 6 + libtiff):

```bash
T="-alpha off -type TrueColor -depth 8"
convert -size 40x30 xc:white -fill '#ff0000' -draw "rectangle 0,0 19,14" -fill '#00ff00' -draw "rectangle 20,0 39,14" \
  -fill '#0000ff' -draw "rectangle 0,15 19,29" -fill '#ffff00' -draw "rectangle 20,15 29,29" +antialias pattern.png
convert pattern.png $T -compress None rgb-none.tif            # LZW · RLE(PackBits) · Zip 도 같은 꼴
convert pattern.png $T -compress LZW -define tiff:predictor=2 rgb-lzw-pred.tif
convert pattern.png -alpha off -colorspace CMYK -type ColorSeparation -depth 8 -compress LZW cmyk-lzw.tif
convert pattern.png -alpha off -type TrueColor -depth 16 -compress LZW -define tiff:predictor=2 rgb16-lzw-pred.tif
convert pattern.png $T -interlace Plane -compress LZW rgb-planar-lzw.tif
convert pattern.png $T -define tiff:tile-geometry=16x16 -compress Zip rgb-tiled-zip.tif
convert pattern.png $T -compress JPEG -quality 95 rgb-jpeg.tif
convert pattern.png -alpha off -type Palette -depth 8 -compress LZW palette-lzw.tif
convert pattern.png -alpha off -colorspace Gray -type Grayscale -depth 8 -compress None gray8-none.tif
convert pattern.png -alpha off -colorspace Gray -threshold 60% -type Bilevel -depth 1 -compress None bilevel1-none.tif
convert pattern.png -alpha set -channel A -fx 'i<20?1:0.5' +channel -type TrueColorAlpha -depth 8 -compress LZW rgba-lzw.tif
convert pattern.png $T -orient RightTop -compress None rgb-orient6.tif
convert pattern.png -alpha off -colorspace Gray -threshold 60% -type Bilevel -compress Group4 bilevel-g4.tif
for f in *.tif; do convert "$f[0]" -auto-orient -colorspace sRGB -depth 8 "ref/${f%.tif}.png"; done
```
