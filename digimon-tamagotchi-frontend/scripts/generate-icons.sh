#!/bin/bash
# scripts/generate-icons.sh
# 아구몬똥그림.png를 다양한 크기로 최적화하여 생성하는 스크립트 (macOS sips 사용)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$SCRIPT_DIR/../public"
SOURCE_IMAGE="$PUBLIC_DIR/아구몬똥그림.png"

# 생성할 아이콘 크기 목록
declare -a SIZES=(16 32 48 192 512)
declare -a NAMES=("favicon16.png" "favicon32_agumon.png" "icon48.png" "logo192_agumon.png" "logo512_agumon.png")

# 색상 출력
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🖼️  아이콘 생성 시작..."
echo "소스: $SOURCE_IMAGE"
echo ""

# 소스 이미지 확인
if [ ! -f "$SOURCE_IMAGE" ]; then
    echo -e "${RED}❌ 소스 이미지를 찾을 수 없습니다: $SOURCE_IMAGE${NC}"
    exit 1
fi

# 각 크기로 아이콘 생성
for i in "${!SIZES[@]}"; do
    SIZE="${SIZES[$i]}"
    NAME="${NAMES[$i]}"
    OUTPUT_PATH="$PUBLIC_DIR/$NAME"
    
    # sips로 리사이즈
    sips -z $SIZE $SIZE "$SOURCE_IMAGE" --out "$OUTPUT_PATH" > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        FILE_SIZE=$(stat -f%z "$OUTPUT_PATH" 2>/dev/null || stat -c%s "$OUTPUT_PATH" 2>/dev/null)
        FILE_SIZE_KB=$(echo "scale=2; $FILE_SIZE / 1024" | bc)
        echo -e "${GREEN}✅ $NAME (${SIZE}x${SIZE}) 생성 완료 - ${FILE_SIZE_KB}KB${NC}"
    else
        echo -e "${RED}❌ $NAME 생성 실패${NC}"
    fi
done

echo ""
echo -e "${GREEN}✨ 모든 아이콘 생성 완료!${NC}"
echo ""
echo "생성된 파일:"
for i in "${!SIZES[@]}"; do
    echo "  - ${NAMES[$i]} (${SIZES[$i]}x${SIZES[$i]})"
done
