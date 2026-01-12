#!/usr/bin/env python3
# scripts/generate-icons.py
# 아구몬똥그림.png를 다양한 크기로 최적화하여 생성하는 스크립트

import os
import sys
from PIL import Image

def generate_icons():
    # 경로 설정
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, '../public')
    source_image = os.path.join(public_dir, '아구몬똥그림.png')
    
    # 생성할 아이콘 크기 목록
    icon_sizes = [
        {'size': 16, 'name': 'favicon16.png'},
        {'size': 32, 'name': 'favicon32_agumon.png'},
        {'size': 48, 'name': 'icon48.png'},
        {'size': 192, 'name': 'logo192_agumon.png'},
        {'size': 512, 'name': 'logo512_agumon.png'},
    ]
    
    try:
        # 소스 이미지 확인
        if not os.path.exists(source_image):
            print(f'❌ 소스 이미지를 찾을 수 없습니다: {source_image}')
            sys.exit(1)
        
        print('🖼️  아이콘 생성 시작...')
        print(f'소스: {source_image}\n')
        
        # 원본 이미지 열기
        img = Image.open(source_image)
        
        # 각 크기로 아이콘 생성
        for icon_config in icon_sizes:
            size = icon_config['size']
            name = icon_config['name']
            output_path = os.path.join(public_dir, name)
            
            # 이미지 리사이즈 (고품질 리샘플링)
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # PNG로 저장 (최적화)
            resized.save(output_path, 'PNG', optimize=True, compress_level=9)
            
            # 파일 크기 확인
            file_size = os.path.getsize(output_path)
            file_size_kb = file_size / 1024
            
            print(f'✅ {name} ({size}x{size}) 생성 완료 - {file_size_kb:.2f}KB')
        
        print('\n✨ 모든 아이콘 생성 완료!')
        print('\n생성된 파일:')
        for icon_config in icon_sizes:
            print(f'  - {icon_config["name"]} ({icon_config["size"]}x{icon_config["size"]})')
        
    except ImportError:
        print('❌ PIL (Pillow) 라이브러리가 필요합니다.')
        print('설치 방법: pip3 install Pillow')
        sys.exit(1)
    except Exception as e:
        print(f'❌ 오류 발생: {e}')
        sys.exit(1)

if __name__ == '__main__':
    generate_icons()
