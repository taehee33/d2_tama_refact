// src/components/AdBanner.jsx
// Google AdSense 광고 배너 컴포넌트

import React, { useEffect, useRef } from 'react';
import { GOOGLE_ADSENSE_CLIENT_ID } from "../constants/ads";

const ADSENSE_SCRIPT_ID = "google-adsense-script";

const loadAdSenseScript = () => {
  const existingScript = document.getElementById(ADSENSE_SCRIPT_ID);

  if (existingScript) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${GOOGLE_ADSENSE_CLIENT_ID}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const AdBanner = () => {
  const adRef = useRef(null);
  const isAdLoaded = useRef(false);

  useEffect(() => {
    let isMounted = true;

    // 이미 광고가 로드되었으면 다시 로드하지 않음
    if (isAdLoaded.current || !adRef.current) {
      return undefined;
    }

    const requestAd = () => {
      try {
        if (!isMounted || !adRef.current || isAdLoaded.current) {
          return;
        }

        // 광고 요소가 DOM에 있고 아직 처리되지 않았을 때만 요청
        if (!adRef.current.hasAttribute('data-adsbygoogle-status')) {
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
          isAdLoaded.current = true;
        }
      } catch (e) {
        console.error("AdSense error:", e);
      }
    };

    loadAdSenseScript()
      .then(requestAd)
      .catch((e) => {
        console.error("AdSense script load error:", e);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{ textAlign: 'center', margin: '20px 0', minHeight: '100px' }}>
      <ins 
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={GOOGLE_ADSENSE_CLIENT_ID}
        data-ad-slot="auto"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdBanner;
