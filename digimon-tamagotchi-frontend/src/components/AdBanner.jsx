// src/components/AdBanner.jsx
// Google AdSense 광고 배너 컴포넌트

import React, { useEffect, useRef } from 'react';

const AdBanner = () => {
  const adRef = useRef(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    // 이미 광고가 로드되었으면 다시 로드하지 않음
    if (isAdLoaded.current || !adRef.current) {
      return;
    }

    try {
      // adsbygoogle이 이미 설정되어 있는지 확인
      if (window.adsbygoogle && window.adsbygoogle.loaded) {
        // 이미 로드된 경우 스킵
        isAdLoaded.current = true;
        return;
      }

      // 광고 요소가 DOM에 있는지 확인
      if (adRef.current && !adRef.current.hasAttribute('data-adsbygoogle-status')) {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
        isAdLoaded.current = true;
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div style={{ textAlign: 'center', margin: '20px 0', minHeight: '100px' }}>
      <ins 
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-2364187848393035"
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdBanner;
