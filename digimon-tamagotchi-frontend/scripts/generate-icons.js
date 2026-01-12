// scripts/generate-icons.js
// 아구몬똥그림.png를 다양한 크기로 최적화하여 생성하는 스크립트

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sourceImage = path.join(__dirname, '../public/아구몬똥그림.png');
const outputDir = path.join(__dirname, '../public');

// 생성할 아이콘 크기 목록
const iconSizes = [
  { size: 16, name: 'favicon16.png' },
  { size: 32, name: 'favicon32_agumon.png' },
  { size: 48, name: 'icon48.png' },
  { size: 192, name: 'logo192_agumon.png' },
  { size: 512, name: 'logo512_agumon.png' },
];

async function generateIcons() {
  try {
    // 소스 이미지 확인
    if (!fs.existsSync(sourceImage)) {
      console.error(`❌ 소스 이미지를 찾을 수 없습니다: ${sourceImage}`);
      process.exit(1);
    }

    console.log('🖼️  아이콘 생성 시작...');
    console.log(`소스: ${sourceImage}\n`);

    // 각 크기로 아이콘 생성
    for (const { size, name } of iconSizes) {
      const outputPath = path.join(outputDir, name);
      
      await sharp(sourceImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 } // 투명 배경
        })
        .png({ quality: 90, compressionLevel: 9 })
        .toFile(outputPath);

      const stats = fs.statSync(outputPath);
      const fileSizeKB = (stats.size / 1024).toFixed(2);
      
      console.log(`✅ ${name} (${size}x${size}) 생성 완료 - ${fileSizeKB}KB`);
    }

    console.log('\n✨ 모든 아이콘 생성 완료!');
    console.log('\n생성된 파일:');
    iconSizes.forEach(({ size, name }) => {
      console.log(`  - ${name} (${size}x${size})`);
    });

  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  }
}

generateIcons();
