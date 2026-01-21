// src/components/KakaoAd.jsx
// 카카오 애드핏 광고 컴포넌트

import React, { useEffect } from 'react';

const KakaoAd = () => {
  useEffect(() => {
    // 카카오 애드핏 스크립트가 이미 로드되었는지 확인
    if (window.kakao && window.kakao.adfit) {
      window.kakao.adfit.start();
      return;
    }

    // 광고 스크립트 동적 로드
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = '//t1.daumcdn.net/kas/static/ba.min.js';
    script.async = true;
    document.body.appendChild(script);

    // 스크립트 로드 완료 후 광고 시작
    script.onload = () => {
      if (window.kakao && window.kakao.adfit) {
        window.kakao.adfit.start();
      }
    };

    return () => {
      // 컴포넌트 언마운트 시 스크립트 제거 (선택 사항)
      const adScript = document.querySelector('script[src="//t1.daumcdn.net/kas/static/ba.min.js"]');
      if (adScript && document.body.contains(adScript)) {
        // 다른 컴포넌트에서 사용 중일 수 있으므로 제거하지 않음
      }
    };
  }, []);

  return (
    <div className="kakao-ad-container" style={{ textAlign: 'center', margin: '20px 0', minHeight: '100px' }}>
      <ins 
        className="kakao_ad_area"
        style={{ display: 'none' }}
        data-ad-unit="DAN-0fsXktyAFRy6EuoF"
        data-ad-width="320"
        data-ad-height="100"
      ></ins>
    </div>
  );
};

export default KakaoAd;
