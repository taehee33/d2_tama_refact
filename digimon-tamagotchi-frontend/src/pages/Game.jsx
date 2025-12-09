// src/pages/Game.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

import Canvas from "../components/Canvas";
import StatsPanel from "../components/StatsPanel";
import StatsPopup from "../components/StatsPopup";
import FeedPopup from "../components/FeedPopup";
import SettingsModal from "../components/SettingsModal";
import MenuIconButtons from "../components/MenuIconButtons";

import digimonAnimations from "../data/digimonAnimations";
import { initializeStats, applyLazyUpdate } from "../data/stats";
import { digimonDataVer1 } from "../data/digimondata_digitalmonstercolor25th_ver1";
import { evolutionConditionsVer1 } from "../data/evolution_digitalmonstercolor25th_ver1";

// ★ (A) 훈련 로직 (Ver1) import
import { doVer1Training } from "../data/train_digitalmonstercolor25th_ver1";
import TrainPopup from "../components/TrainPopup"; 

// 예시: Ver1 디지몬 목록
const ver1DigimonList = [
  "Digitama",
  "Botamon",
  "Koromon",
  "Agumon",
  "Betamon",
  "Greymon",
  "Ohakadamon1",
  "Ohakadamon2",
];

const perfectStages = ["Perfect","Ultimate","SuperUltimate"];

// 시간 포맷
function formatTimeToEvolve(sec=0){
  const m = Math.floor(sec/60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}
function formatLifespan(sec=0){
  const d = Math.floor(sec/86400);
  const r = sec %86400;
  const mm= Math.floor(r/60);
  const ss= r%60;
  return `${d} day, ${mm} min, ${ss} sec`;
}

function Game(){
  const { slotId } = useParams();
  const navigate= useNavigate();
  const { currentUser, isFirebaseAvailable } = useAuth();

  const [selectedDigimon, setSelectedDigimon]= useState("Digitama");
  const [digimonStats, setDigimonStats]= useState(
    initializeStats("Digitama", {}, digimonDataVer1)
  );

  // 사망확인
  const [showDeathConfirm, setShowDeathConfirm]= useState(false);

  // 슬롯 정보
  const [slotName, setSlotName]= useState("");
  const [slotCreatedAt, setSlotCreatedAt]= useState("");
  const [slotDevice, setSlotDevice]= useState("");
  const [slotVersion, setSlotVersion]= useState("");

  // Canvas/UI
  const [width, setWidth]= useState(300);
  const [height, setHeight]= useState(200);
  const [backgroundNumber, setBackgroundNumber]= useState(162);
  const [currentAnimation, setCurrentAnimation]= useState("idle");

  // 팝업
  const [showStatsPopup, setShowStatsPopup]= useState(false);
  const [showFeedPopup, setShowFeedPopup]= useState(false);
  const [showSettingsModal, setShowSettingsModal]= useState(false);
  const [activeMenu, setActiveMenu]= useState(null);

  const [developerMode, setDeveloperMode]= useState(false);

  // 시간
  const [customTime, setCustomTime]= useState(new Date());
  const [timeSpeed, setTimeSpeed]= useState(1);

  // feed
  const [feedType, setFeedType]= useState(null);
  const [showFood, setShowFood]= useState(false);
  const [feedStep, setFeedStep]= useState(0);
  const [foodSizeScale, setFoodSizeScale]= useState(0.31);

  const meatSprites= ["/images/526.png","/images/527.png","/images/528.png","/images/529.png"];
  const proteinSprites= ["/images/530.png","/images/531.png","/images/532.png"];

  // (A) 청소 애니
  const [showPoopCleanAnimation, setShowPoopCleanAnimation]= useState(false);
  const [cleanStep, setCleanStep]= useState(0);

  // ★ (B) 훈련 팝업
  const [showTrainPopup, setShowTrainPopup]= useState(false);

  // (1) SLOT LOAD - Firestore에서 슬롯 데이터 로드 및 Lazy Update 적용
  useEffect(()=>{
    if(!slotId) return;
    if(!isFirebaseAvailable || !currentUser) {
      navigate("/");
      return;
    }

    const loadSlot = async () => {
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        const slotSnap = await getDoc(slotRef);
        
        if(slotSnap.exists()) {
          const slotData = slotSnap.data();
          
          setSlotName(slotData.slotName || `슬롯${slotId}`);
          setSlotCreatedAt(slotData.createdAt || "");
          setSlotDevice(slotData.device || "");
          setSlotVersion(slotData.version || "Ver.1");

          const savedName = slotData.selectedDigimon || "Digitama";
          let savedStats = slotData.digimonStats || {};
          
          if(Object.keys(savedStats).length === 0){
            const ns = initializeStats("Digitama", {}, digimonDataVer1);
            setSelectedDigimon("Digitama");
            setDigimonStats(ns);
          } else {
            // Lazy Update: 마지막 저장 시간부터 현재까지 경과한 시간 적용
            const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || new Date();
            savedStats = applyLazyUpdate(savedStats, lastSavedAt);
            
            setSelectedDigimon(savedName);
            setDigimonStats(savedStats);
            
            // 업데이트된 스탯을 Firestore에 저장
            await updateDoc(slotRef, {
              digimonStats: savedStats,
              lastSavedAt: savedStats.lastSavedAt,
              updatedAt: new Date(),
            });
          }
        } else {
          const ns = initializeStats("Digitama", {}, digimonDataVer1);
          setSelectedDigimon("Digitama");
          setDigimonStats(ns);
          setSlotName(`슬롯${slotId}`);
        }
      } catch (error) {
        console.error("슬롯 로드 오류:", error);
        const ns = initializeStats("Digitama", {}, digimonDataVer1);
        setSelectedDigimon("Digitama");
        setDigimonStats(ns);
      }
    };

    loadSlot();
  },[slotId, currentUser, navigate, isFirebaseAvailable]);

  // (2) 시계만 업데이트 (스탯은 Lazy Update로 처리)
  useEffect(()=>{
    const clock= setInterval(()=> setCustomTime(new Date()),1000);
    return ()=>{
      clearInterval(clock);
    };
  },[]);

  async function setDigimonStatsAndSave(newStats){
    // Lazy Update 적용: 액션 시점에 경과 시간 반영
    const updatedStats = await applyLazyUpdateBeforeAction();
    const finalStats = { ...updatedStats, ...newStats };
    
    setDigimonStats(finalStats);
    
    // Firestore에 저장 (먹이/훈련 등 액션 시점에 저장)
    if(slotId && currentUser){
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          digimonStats: finalStats,
          lastSavedAt: finalStats.lastSavedAt || new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("스탯 저장 오류:", error);
      }
    }
  }

  // 액션 전에 Lazy Update 적용하는 헬퍼 함수
  // Firestore에서 마지막 저장 시간을 가져와 경과 시간을 계산하여 스탯 업데이트
  async function applyLazyUpdateBeforeAction() {
    if(!slotId || !currentUser) {
      return digimonStats;
    }

    try {
      const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
      const slotSnap = await getDoc(slotRef);
      
      if(slotSnap.exists()) {
        const slotData = slotSnap.data();
        const lastSavedAt = slotData.lastSavedAt || slotData.updatedAt || digimonStats.lastSavedAt;
        const updated = applyLazyUpdate(digimonStats, lastSavedAt);
        
        // 사망 상태 변경 감지
        if(!digimonStats.isDead && updated.isDead){
          setShowDeathConfirm(true);
        }
        
        return updated;
      }
    } catch (error) {
      console.error("Lazy Update 적용 오류:", error);
    }
    
    return digimonStats;
  }
  async function setSelectedDigimonAndSave(name){
    setSelectedDigimon(name);
    if(slotId && currentUser){
      try {
        const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
        await updateDoc(slotRef, {
          selectedDigimon: name,
          updatedAt: new Date(),
        });
      } catch (error) {
        console.error("디지몬 이름 저장 오류:", error);
      }
    }
  }

  // 애니메이션
  let idleAnimId=1, eatAnimId=2, rejectAnimId=3;
  if(selectedDigimon==="Digitama") idleAnimId=90;
  const idleOff= digimonAnimations[idleAnimId]?.frames||[0];
  const eatOff= digimonAnimations[eatAnimId]?.frames||[0];
  const rejectOff= digimonAnimations[rejectAnimId]?.frames||[14];

  let idleFrames= idleOff.map(n=> `${digimonStats.sprite + n}`);
  let eatFramesArr= eatOff.map(n=> `${digimonStats.sprite + n}`);
  let rejectFramesArr= rejectOff.map(n=> `${digimonStats.sprite + n}`);

  if(digimonStats.isDead){
    idleFrames= [ `${digimonStats.sprite+15}` ];
    eatFramesArr= [ `${digimonStats.sprite+15}` ];
    rejectFramesArr= [ `${digimonStats.sprite+15}` ];
  }

  // 진화
  async function handleEvolutionButton(){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    setDigimonStats(updatedStats);
    
    if(updatedStats.isDead && !developerMode) return;
    
    if(developerMode) {
      // 개발자 모드에서는 바로 진화 가능
      const evo= evolutionConditionsVer1[selectedDigimon];
      if(evo && evo.evolution.length > 0){
        await handleEvolution(evo.evolution[0].next);
      }
      return;
    }
    
    const evo= evolutionConditionsVer1[selectedDigimon];
    if(!evo) return;
    for(let e of evo.evolution){
      let test={...updatedStats};
      if(developerMode){
        test.timeToEvolveSeconds=0;
      }
      if(e.condition.check(test)){
        await handleEvolution(e.next);
        return;
      }
    }
  }
  async function handleEvolution(newName){
    if(!digimonDataVer1[newName]){
      console.error(`No data for ${newName} in digimonDataVer1! fallback => Digitama`);
      newName="Digitama";
    }
    const currentStats = await applyLazyUpdateBeforeAction();
    const old={...currentStats};
    const nx= initializeStats(newName, old, digimonDataVer1);
    await setDigimonStatsAndSave(nx);
    await setSelectedDigimonAndSave(newName);
  }

  async function handleDeathConfirm(){
    // 최신 스탯 가져오기
    const currentStats = await applyLazyUpdateBeforeAction();
    
    let ohaka="Ohakadamon1";
    if(perfectStages.includes(currentStats.evolutionStage)){
      ohaka="Ohakadamon2";
    }
    if(!digimonDataVer1[ohaka]){
      console.error(`No data for ${ohaka} in digimonDataVer1!? fallback => Digitama`);
      ohaka="Digitama";
    }
    const old= {...currentStats};
    const nx= initializeStats(ohaka, old, digimonDataVer1);
    await setDigimonStatsAndSave(nx);
    await setSelectedDigimonAndSave(ohaka);
    setShowDeathConfirm(false);
  }

  // 먹이 - Lazy Update 적용 후 Firestore에 저장
  async function handleFeed(type){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.isDead) return;
    
    // 업데이트된 스탯으로 작업
    setDigimonStats(updatedStats);
    const limit= 5+(updatedStats.maxOverfeed||0);
    if(type==="meat"){
      if(updatedStats.fullness>= limit){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    } else {
      if(updatedStats.fullness>=limit && updatedStats.health>=5){
        setCurrentAnimation("foodRejectRefuse");
        setShowFood(false);
        setFeedStep(0);
        setTimeout(()=> setCurrentAnimation("idle"),2000);
        return;
      }
    }
    setFeedType(type);
    setShowFood(true);
    setFeedStep(0);
    eatCycle(0, type);
  }
  async function eatCycle(step,type){
    const frameCount= (type==="protein"?3:4);
    if(step>=frameCount){
      setCurrentAnimation("idle");
      setShowFood(false);
      // 최신 스탯 가져오기
      const currentStats = await applyLazyUpdateBeforeAction();
      setDigimonStatsAndSave(applyEatResult(currentStats, type));
      return;
    }
    setCurrentAnimation("eat");
    setFeedStep(step);
    setTimeout(()=> eatCycle(step+1,type),500);
  }
  function applyEatResult(old,type){
    let s={...old};
    const limit=5+(s.maxOverfeed||0);
    if(type==="meat"){
      if(s.fullness<limit){
        s.fullness++;
        s.weight++;
      }
    } else {
      if(s.fullness<5){
        s.fullness= Math.min(limit, s.fullness+2);
      }
      if(s.health<5){
        s.health++;
      }
      s.weight+=2;
    }
    return s;
  }

  // 똥 청소
  async function handleCleanPoop(){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    if(updatedStats.poopCount<=0){
      return;
    }
    setDigimonStats(updatedStats);
    setShowPoopCleanAnimation(true);
    setCleanStep(0);
    cleanCycle(0);
  }
  async function cleanCycle(step){
    if(step>3){
      setShowPoopCleanAnimation(false);
      setCleanStep(0);
      const now = new Date();
      const updatedStats = {
        ...digimonStats,
        poopCount: 0,
        lastMaxPoopTime: null,
        lastSavedAt: now
      };
      setDigimonStats(updatedStats);
      // Firestore에 저장 (청소 시 저장)
      if(slotId && currentUser){
        try {
          const slotRef = doc(db, 'users', currentUser.uid, 'slots', `slot${slotId}`);
          await updateDoc(slotRef, {
            digimonStats: updatedStats,
            lastSavedAt: now,
            updatedAt: now,
          });
        } catch (error) {
          console.error("청소 상태 저장 오류:", error);
        }
      }
      return;
    }
    setCleanStep(step);
    setTimeout(()=> cleanCycle(step+1), 400);
  }

  // ★ (C) 훈련
  async function handleTrainResult(userSelections){
    // 액션 전 Lazy Update 적용
    const updatedStats = await applyLazyUpdateBeforeAction();
    setDigimonStats(updatedStats);
    
    // userSelections: 길이5의 "U"/"D" 배열
    // doVer1Training -> stats 업데이트
    const result= doVer1Training(updatedStats, userSelections);
    setDigimonStatsAndSave(result.updatedStats);
    // 그냥 콘솔
    console.log("훈련 결과:", result);
  }

  // 리셋
  async function resetDigimon(){
    if(!window.confirm("정말로 초기화?")) return;
    const ns = initializeStats("Digitama", {}, digimonDataVer1);
    await setDigimonStatsAndSave(ns);
    await setSelectedDigimonAndSave("Digitama");
    setShowDeathConfirm(false);
  }

  // evo 버튼 상태 (간단하게 현재 스탯으로 확인, 실제 진화는 클릭 시 Lazy Update 적용)
  const [isEvoEnabled, setIsEvoEnabled] = useState(false);
  
  // 진화 가능 여부 확인 (현재 스탯 기준, 실제 진화 시에는 Lazy Update 적용)
  useEffect(() => {
    if(digimonStats.isDead && !developerMode) {
      setIsEvoEnabled(false);
      return;
    }
    
    if(developerMode) {
      setIsEvoEnabled(true);
      return;
    }
    
    const evo= evolutionConditionsVer1[selectedDigimon];
    if(evo){
      for(let e of evo.evolution){
        if(e.condition.check(digimonStats)){
          setIsEvoEnabled(true);
          return;
        }
      }
    }
    setIsEvoEnabled(false);
  }, [digimonStats, selectedDigimon, developerMode]);

  // 메뉴 클릭 (train 버튼 시)
  const handleMenuClick = (menu)=>{
    setActiveMenu(menu);
    switch(menu){
      case "eat":
        setShowFeedPopup(true);
        break;
      case "status":
        setShowStatsPopup(true);
        break;
      case "bathroom":
        handleCleanPoop();
        break;
      case "train":
        setShowTrainPopup(true);
        break;
      default:
        console.log("menu:", menu);
    }
  };

  // 화면 렌더
  return (
    <div className="flex flex-col items-center min-h-screen p-4 bg-gray-200">
      <h2 className="text-lg font-bold mb-2">
        슬롯 {slotId} - {selectedDigimon}
      </h2>
      <p>슬롯 이름: {slotName}</p>
      <p>생성일: {slotCreatedAt}</p>
      <p>기종: {slotDevice} / 버전: {slotVersion}</p>

      <button onClick={()=> navigate("/select")} className="mb-2 px-3 py-1 bg-gray-400 text-white rounded">
        ← Select 화면
      </button>

      <div style={{position:"relative", width,height, border:"2px solid #555"}}>
        <img
          src={`/images/${backgroundNumber}.png`}
          alt="bg"
          style={{
            position:"absolute",
            top:0,left:0,
            width:"100%",height:"100%",
            imageRendering:"pixelated",
            zIndex:1
          }}
        />
        <Canvas
          style={{ position:"absolute", top:0,left:0, zIndex:2 }}
          width={width}
          height={height}
          currentAnimation={currentAnimation}
          idleFrames={idleFrames}
          eatFrames={eatFramesArr}
          foodRejectFrames={rejectFramesArr}
          showFood={showFood}
          feedStep={feedStep}
          foodSizeScale={foodSizeScale}
          developerMode={developerMode}
          foodSprites={(feedType==="protein")? proteinSprites: meatSprites}
          poopCount={digimonStats.poopCount || 0}
          showPoopCleanAnimation={showPoopCleanAnimation}
          cleanStep={cleanStep}
        />
      </div>

      <button
        onClick={handleEvolutionButton}
        disabled={!isEvoEnabled}
        className={`mt-2 px-4 py-2 text-white rounded ${isEvoEnabled? "bg-green-500":"bg-gray-500"}`}
      >
        Evolution
      </button>

      {showDeathConfirm && (
        <div className="mt-4 bg-red-100 p-2 rounded">
          <p className="text-red-600 font-bold">디지몬이 사망했습니다! 사망 확인?</p>
          <button
            onClick={handleDeathConfirm}
            className="px-3 py-1 bg-gray-700 text-white rounded"
          >
            사망 확인
          </button>
        </div>
      )}

      <div className="mt-2 text-lg">
        <p>Time to Evolve: {formatTimeToEvolve(digimonStats.timeToEvolveSeconds)}</p>
        <p>Lifespan: {formatLifespan(digimonStats.lifespanSeconds)}</p>
        <p>Current Time: {customTime.toLocaleString()}</p>
      </div>

      <div className="flex space-x-4 mt-4">
        <StatsPanel stats={digimonStats} />
        <MenuIconButtons
          width={width}
          height={height}
          activeMenu={activeMenu}
          onMenuClick={handleMenuClick}
        />
      </div>

      <button
        onClick={()=> setShowSettingsModal(true)}
        className="px-4 py-2 bg-yellow-500 text-white rounded mt-4"
      >
        Settings
      </button>

      {showStatsPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <StatsPopup
            stats={digimonStats}
            onClose={()=> setShowStatsPopup(false)}
            devMode={developerMode}
            onChangeStats={(ns)=> setDigimonStatsAndSave(ns)}
          />
        </div>
      )}

      {showFeedPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <FeedPopup
            onClose={()=> setShowFeedPopup(false)}
            onSelect={(foodType)=>{
              setShowFeedPopup(false);
              handleFeed(foodType);
            }}
          />
        </div>
      )}

      {showSettingsModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <SettingsModal
            onClose={()=> setShowSettingsModal(false)}
            developerMode={developerMode}
            setDeveloperMode={setDeveloperMode}
            width={width}
            height={height}
            setWidth={setWidth}
            setHeight={setHeight}
            backgroundNumber={backgroundNumber}
            setBackgroundNumber={setBackgroundNumber}
            timeSpeed={timeSpeed}
            setTimeSpeed={setTimeSpeed}
            customTime={customTime}
            setCustomTime={setCustomTime}
            foodSizeScale={foodSizeScale}
            setFoodSizeScale={setFoodSizeScale}
          />
        </div>
      )}

      <button
        onClick={resetDigimon}
        className="px-4 py-2 bg-red-500 text-white rounded mt-4"
      >
        Reset Digimon
      </button>

      {developerMode && slotVersion==="Ver.1" && (
        <div className="mt-2 p-2 border">
          <label className="mr-1">Dev Digimon Select:</label>
          <select
            onChange={(e)=>{
              const nm= e.target.value;
              if(!digimonDataVer1[nm]){
                console.error(`No data for ${nm}`);
                const fallback= initializeStats("Digitama", digimonStats, digimonDataVer1);
                setDigimonStatsAndSave(fallback);
                setSelectedDigimonAndSave("Digitama");
                return;
              }
              const old= {...digimonStats};
              const nx= initializeStats(nm, old, digimonDataVer1);
              setDigimonStatsAndSave(nx);
              setSelectedDigimonAndSave(nm);
            }}
            defaultValue={selectedDigimon}
          >
            {ver1DigimonList.map(d=>(
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {/* ★ (D) 훈련 팝업 */}
      {showTrainPopup && (
        <TrainPopup
          onClose={()=> setShowTrainPopup(false)}
          digimonStats={digimonStats}
          setDigimonStatsAndSave={setDigimonStatsAndSave}
          onTrainResult={handleTrainResult}
        />
      )}
    </div>
  );
}

export default Game;