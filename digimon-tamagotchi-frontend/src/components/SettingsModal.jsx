import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const SettingsModal = ({
  onClose,
  // 기본 상태들
  foodSizeScale, setFoodSizeScale,
  developerMode, setDeveloperMode,
  width, height, setWidth, setHeight,
  backgroundNumber, setBackgroundNumber,
  digimonSizeScale, setDigimonSizeScale,
  timeMode, setTimeMode,
  timeSpeed, setTimeSpeed,
  customTime, setCustomTime
}) => {
  const navigate = useNavigate();
  const { logout, isFirebaseAvailable, currentUser } = useAuth();
  
  // PWA 설치 관련
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  
  // 로컬 상태
  const [localWidth, setLocalWidth] = useState(width);
  const [localHeight, setLocalHeight] = useState(height);
  const [localUniform, setLocalUniform] = useState(Math.min(width, height));
  const [localDevMode, setLocalDevMode] = useState(developerMode);
  const [uniformScale, setUniformScale] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(height / width); // 초기 비율 저장

  // 초기값
  useEffect(() => {
    setLocalWidth(width);
    setLocalHeight(height);
    setLocalUniform(Math.min(width, height));
    setLocalDevMode(developerMode);
    setAspectRatio(height / width); // 비율 업데이트
  }, [width, height, developerMode]);

  // PWA 설치 프롬프트 감지
  useEffect(() => {
    // iOS 감지
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);
    
    // 이미 설치되었는지 확인
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = window.navigator.standalone === true;
    
    if (isStandalone || isIOSStandalone) {
      setIsInstalled(true);
      return;
    }

    // beforeinstallprompt 이벤트 감지 (Android Chrome 등)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // appinstalled 이벤트 감지 (설치 완료)
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Width/Height 변경
  const handleLocalWidthChange = (e) => {
    const val = parseInt(e.target.value) || 100;
    setLocalWidth(val);
    
    // Uniform Scale이 켜져 있으면 비율에 맞춰 height 자동 조정
    if (uniformScale) {
      const newHeight = Math.round(val * aspectRatio);
      setLocalHeight(newHeight);
    }
  };
  
  const handleLocalHeightChange = (e) => {
    const val = parseInt(e.target.value) || 100;
    setLocalHeight(val);
    
    // Uniform Scale이 켜져 있으면 비율에 맞춰 width 자동 조정
    if (uniformScale) {
      const newWidth = Math.round(val / aspectRatio);
      setLocalWidth(newWidth);
    }
  };

  // Uniform Scale 체크박스 토글
  const handleUniformScaleToggle = (e) => {
    const isChecked = e.target.checked;
    setUniformScale(isChecked);
    
    // 체크박스를 켤 때 현재 비율을 기준점으로 설정
    if (isChecked) {
      setAspectRatio(localHeight / localWidth);
    }
  };

  // Uniform scale 변경 (기존 슬라이더)
  const handleUniformChange = (e) => {
    const val = parseInt(e.target.value) || 100;
    setLocalUniform(val);
    // Uniform → Width, Height 함께 변경
    setLocalWidth(val);
    setLocalHeight(val);
    // 비율도 업데이트 (1:1)
    setAspectRatio(1);
  };
  
  // Reset Size 버튼
  const handleResetSize = () => {
    const defaultWidth = 300;
    const defaultHeight = 200;
    setLocalWidth(defaultWidth);
    setLocalHeight(defaultHeight);
    setLocalUniform(Math.min(defaultWidth, defaultHeight));
    setAspectRatio(defaultHeight / defaultWidth);
    // 즉시 적용
    setWidth(defaultWidth);
    setHeight(defaultHeight);
  };

  // Dev Mode toggle
  const toggleDevMode = () => {
    setLocalDevMode(!localDevMode);
  };

  // Save
  const handleSave = () => {
    setWidth(localWidth);
    setHeight(localHeight);
    setDeveloperMode(localDevMode);
    // TODO: timeMode, timeSpeed, customTime 등도 저장 로직
    onClose();
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      if (isFirebaseAvailable && currentUser) {
        await logout();
        navigate("/");
      }
    } catch (error) {
      console.error("로그아웃 오류:", error);
      alert("로그아웃에 실패했습니다.");
    }
  };

  // PWA 설치 처리
  const handleInstall = async () => {
    if (isIOS) {
      // iOS는 수동 안내
      setShowIOSInstructions(true);
      return;
    }

    if (!deferredPrompt) {
      alert("이 브라우저에서는 설치가 지원되지 않습니다.");
      return;
    }

    try {
      // 프롬프트 표시
      await deferredPrompt.prompt();
      
      // 사용자 선택 대기
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA 설치 승인됨');
        setIsInstalled(true);
      } else {
        console.log('PWA 설치 거부됨');
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    } catch (error) {
      console.error('PWA 설치 오류:', error);
      alert('설치 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-96" modal-mobile>
        <h2 className="text-xl mb-4">Settings</h2>

        {/* Dev Mode */}
        <div className="mb-4">
          <label className="block font-semibold">Developer Mode</label>
          <button
            className={`px-3 py-1 rounded mt-1 ${localDevMode ? "bg-green-500" : "bg-gray-500"} text-white`}
            onClick={toggleDevMode}
          >
            {localDevMode ? "ON" : "OFF"}
          </button>
        </div>

        {/* Size Settings */}
        <div className="mb-4">
          <h3 className="font-semibold mb-2">Size Settings</h3>
          
          {/* Uniform Scale 체크박스 */}
          <div className="mb-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={uniformScale}
                onChange={handleUniformScaleToggle}
                className="mr-2"
              />
              <span>Uniform Scale (비율 고정)</span>
            </label>
          </div>
          
          {/* Width */}
          <div className="mb-2">
            <label>Width: {localWidth}px</label>
            <input
              type="range"
              min="100"
              max="600"
              value={localWidth}
              onChange={handleLocalWidthChange}
              className="w-full"
            />
            <input
              type="number"
              min="100"
              max="600"
              value={localWidth}
              onChange={handleLocalWidthChange}
              className="w-full p-1 border rounded mt-1"
            />
          </div>
          
          {/* Height */}
          <div className="mb-2">
            <label>Height: {localHeight}px</label>
            <input
              type="range"
              min="100"
              max="600"
              value={localHeight}
              onChange={handleLocalHeightChange}
              className="w-full"
            />
            <input
              type="number"
              min="100"
              max="600"
              value={localHeight}
              onChange={handleLocalHeightChange}
              className="w-full p-1 border rounded mt-1"
            />
          </div>
          
          {/* Reset Size 버튼 */}
          <div className="mt-3">
            <button
              onClick={handleResetSize}
              className="w-full px-4 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded"
            >
              Reset Size
            </button>
          </div>
        </div>

        {/* PWA 설치 */}
        <div className="mb-4 pt-4 border-t border-gray-300">
          <h3 className="font-semibold mb-2">홈화면에 추가</h3>
          {isInstalled ? (
            <div className="p-3 bg-green-100 border border-green-400 rounded text-sm">
              <p className="text-green-800">✅ 앱이 설치되어 있습니다!</p>
            </div>
          ) : isInstallable || isIOS ? (
            <div className="space-y-2">
              <button
                onClick={handleInstall}
                className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-semibold"
              >
                {isIOS ? "📱 iOS 설치 안내" : "📱 홈화면에 추가"}
              </button>
              {showIOSInstructions && (
                <div className="p-3 bg-blue-50 border border-blue-300 rounded text-sm">
                  <p className="font-semibold mb-2">iOS Safari 설치 방법:</p>
                  <ol className="list-decimal list-inside space-y-1 text-gray-700">
                    <li>하단 공유 버튼(□↑) 탭</li>
                    <li>"홈 화면에 추가" 선택</li>
                    <li>"추가" 버튼 탭</li>
                  </ol>
                  <button
                    onClick={() => setShowIOSInstructions(false)}
                    className="mt-2 text-blue-600 hover:text-blue-800 underline text-xs"
                  >
                    닫기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-gray-100 border border-gray-300 rounded text-sm">
              <p className="text-gray-600">이 브라우저에서는 설치가 지원되지 않습니다.</p>
              <p className="text-xs text-gray-500 mt-1">
                Chrome, Edge, Safari 등 최신 브라우저에서 사용 가능합니다.
              </p>
            </div>
          )}
        </div>

        {/* 디스코드 링크 */}
        <div className="mb-4 pt-4 border-t border-gray-300">
          <p className="text-base font-bold text-gray-800 mb-3">💬 디스코드 (버그리포트, Q&A 등)</p>
          <a
            href="https://discord.gg/BWXFtSCnGt"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors text-sm break-all shadow-md hover:shadow-lg"
          >
            🔗 https://discord.gg/BWXFtSCnGt
          </a>
        </div>

        {/* Save / Cancel */}
        <div className="flex justify-end space-x-2 mt-4">
          <button className="px-4 py-2 bg-gray-300 rounded" onClick={onClose}>
            Cancel
          </button>
          <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;