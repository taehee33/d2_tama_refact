import React, { useEffect, useRef } from "react";
import { getFridgeRenderPolicy } from "./fridgeRenderPolicy";
import { recordRuntimeMetric } from "../utils/runtimeMetrics";
import { normalizeSleepStatusForDisplay } from "../utils/callStatusUtils";

const poopSprite= "/images/533.png";  // 똥 스프라이트
const cleanSprite= "/images/534.png"; // 청소(빗자루 등) 스프라이트
const zzzSprites= ["/images/535.png", "/images/536.png", "/images/537.png", "/images/538.png"]; // Zzz 스프라이트
const injurySprites= ["/images/541.png", "/images/542.png"]; // 부상 스프라이트
const skullSprites= ["/images/543.png", "/images/544.png"]; // 해골 스프라이트 (죽음 상태)
const fridgeSprites= ["/images/552.png", "/images/553.png", "/images/554.png", "/images/555.png"]; // 냉장고 스프라이트 (냉장고, 냉장고 안, 덮개1, 덮개2)
const DIGIMON_WIDTH_RATIO = 0.4;
const DIGIMON_HEIGHT_RATIO = 0.4;
const IDLE_MOTION_COORDINATE_GRID = 80;
const IDLE_MOTION_STEP_MS = 700;
const SLEEPING_LIKE_VISUAL_STATUSES = new Set([
  "NAPPING",
  "SLEEPING",
  "SLEEPING_LIGHT_ON",
]);

// 배치 (8,6,4,2)위치가 top row, (7,5,3,1)이 bottom row
// #1 => bottom-right
// #2 => top-right
// #3 => bottom-2 from right
// #4 => top-2 from right
// ...
// 여기서는 xRatio(오른쪽->왼쪽), yRatio(아래->위)
const poopPositions = [
  { xRatio:0.75, yRatio:0.75 }, // #1 bottom-right
  { xRatio:0.75, yRatio:0.25 }, // #2 top-right
  { xRatio:0.55, yRatio:0.75 }, // #3
  { xRatio:0.55, yRatio:0.25 }, // #4
  { xRatio:0.35, yRatio:0.75 }, // #5
  { xRatio:0.35, yRatio:0.25 }, // #6
  { xRatio:0.15, yRatio:0.75 }, // #7
  { xRatio:0.15, yRatio:0.25 }, // #8
];

function getDigimonSpriteKey(frameName) {
  return `digimon:${frameName}`;
}

function getIdleMotionTimelineKey(idleMotionTimeline) {
  return idleMotionTimeline
    .map((step) =>
      [
        step?.f ?? "",
        step?.spriteNumber ?? "",
        step?.x ?? "",
        step?.y ?? "",
        step?.flip ? 1 : 0,
      ].join(":")
    )
    .join("|");
}

function getDefaultDigimonDrawState(width, height, currentAnimation) {
  const digiW = width * DIGIMON_WIDTH_RATIO;
  const digiH = height * DIGIMON_HEIGHT_RATIO;
  let digiX = (width - digiW) / 2;

  if (currentAnimation === "eat") {
    digiX = width * 0.6 - digiW / 2;
  }

  return {
    digiW,
    digiH,
    digiX,
    digiY: (height - digiH) / 2,
    flip: false,
  };
}

function getIdleMotionDrawState(width, height, step) {
  const digiW = width * DIGIMON_WIDTH_RATIO;
  const digiH = height * DIGIMON_HEIGHT_RATIO;
  const maxX = width - digiW;
  const maxY = height - digiH;

  // 외부 편집기 좌표계(0~80)를 현재 Canvas 크기로 변환
  const digiX = Math.max(0, Math.min(maxX, (width * step.x) / IDLE_MOTION_COORDINATE_GRID));
  const digiY = Math.max(0, Math.min(maxY, (height * step.y) / IDLE_MOTION_COORDINATE_GRID));

  return {
    digiW,
    digiH,
    digiX,
    digiY,
    flip: Boolean(step.flip),
  };
}

function drawDigimonImage(ctx, image, drawState) {
  if (drawState.flip) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(
      image,
      -drawState.digiX - drawState.digiW,
      drawState.digiY,
      drawState.digiW,
      drawState.digiH
    );
    ctx.restore();
    return;
  }

  ctx.drawImage(
    image,
    drawState.digiX,
    drawState.digiY,
    drawState.digiW,
    drawState.digiH
  );
}

const Canvas = ({
  style={},
  width=300,
  height=200,
  // frames
  idleFrames=[],
  idleMotionTimeline=[],
  eatFrames=[],
  foodRejectFrames=[],
  digimonImageBase="/images", // v2는 /Ver2_Mod_Kor
  currentAnimation="idle",
  showFood=false,
  feedStep=0,
  foodSizeScale=0.31,
  foodSprites=[],
  developerMode=false,

  // ★ (1) poop
  poopCount=0,
  // ★ (2) 청소 애니메이션
  showPoopCleanAnimation=false,
  cleanStep=0,
  // ★ (3) 수면 상태 (Zzz 애니메이션)
  sleepStatus="AWAKE", // 'AWAKE' | 'FALLING_ASLEEP' | 'NAPPING' | 'SLEEPING' | 'SLEEPING_LIGHT_ON' | 'AWAKE_INTERRUPTED'
  // ★ (4) 거절 상태 (오버피드)
  isRefused=false, // 고기 거절 상태
  // ★ (5) 사망 상태
  isDead=false, // 사망 여부
  // ★ (6) 부상 상태
  isInjured=false, // 부상 여부
  // ★ (7) 선택된 디지몬 (디지타마 수면 상태 체크용)
  selectedDigimon="", // 선택된 디지몬 이름
  // ★ (8) 냉장고 상태
  isFrozen=false, // 냉장고 보관 여부
  frozenAt=null, // 냉장고에 넣은 시간 (timestamp)
  takeOutAt=null, // 냉장고에서 꺼낸 시간 (timestamp, 꺼내기 애니메이션용)
}) => {
  const visibleSleepStatus = normalizeSleepStatusForDisplay(sleepStatus);
  const isSleepingLikeVisualState = SLEEPING_LIKE_VISUAL_STATUSES.has(
    visibleSleepStatus
  );
  const canvasRef= useRef(null);
  const spriteCache= useRef({});
  const animationID= useRef(null);
  const idleFramesKey = idleFrames.join("|");
  const idleMotionTimelineKey = getIdleMotionTimelineKey(idleMotionTimeline);
  const eatFramesKey = eatFrames.join("|");
  const foodRejectFramesKey = foodRejectFrames.join("|");
  const foodSpritesKey = foodSprites.join("|");

  useEffect(()=>{
    const initImages = () => {
      const canvas= canvasRef.current;
      if(!canvas) return;
      const ctx= canvas.getContext("2d");
      canvas.style.imageRendering= "pixelated";

      let frames=[];
      if(currentAnimation==="eat"){
        frames= eatFrames;
      } else if(currentAnimation==="foodRejectRefuse"){
        frames= foodRejectFrames.length>0 ? foodRejectFrames : ["14"];
      } else if(currentAnimation==="pain2"){
        // 죽음 상태: 모션 15번(아픔2) - 스프라이트 14만 표시
        frames= idleFrames; // 이미 [sprite+14]로 설정됨
      } else {
        frames= idleFrames;
      }
      if(!frames || frames.length===0) frames=["210"]; // fallback

      recordRuntimeMetric("canvas_initImages_calls", {
        currentAnimation,
        frameCount: frames.length,
        width,
        height,
      });

      // ★ (3) 로드할 이미지들 (v2 디지몬은 digimonImageBase가 /Ver2_Mod_Kor)
      const imageSources={};
      const digimonSpriteNames = new Set(frames.map((fn) => String(fn)));
      const shouldLoadIdleMotionFrames =
        currentAnimation === "idle" &&
        idleMotionTimeline.length > 0 &&
        !isInjured &&
        !isSleepingLikeVisualState &&
        !isFrozen &&
        !takeOutAt;

      if (shouldLoadIdleMotionFrames) {
        idleMotionTimeline.forEach((step) => {
          digimonSpriteNames.add(String(step.spriteNumber));
        });
      }
      digimonSpriteNames.forEach((fn)=>{
        imageSources[getDigimonSpriteKey(fn)] = `${digimonImageBase}/${fn}.png`;
      });
      foodSprites.forEach((src,idx)=>{
        imageSources[`food${idx}`]= src;
      });

      // poop, clean
      imageSources["poop"]= poopSprite;    // "/images/533.png"
      imageSources["clean"]= cleanSprite;  // "/images/534.png"
      
      // Zzz 스프라이트 (실제 수면 상태일 때만, 사망 상태가 아닐 때만, 디지타마 제외, 냉장고 상태 제외)
      if(
        isSleepingLikeVisualState &&
        !isDead &&
        !isFrozen &&
        selectedDigimon !== "Digitama"
      ){
        zzzSprites.forEach((src, idx)=>{
          imageSources[`zzz${idx}`]= src;
        });
      }
      
      // 부상 스프라이트 (부상 상태일 때, 사망 상태가 아닐 때만)
      if(isInjured && !isDead){
        injurySprites.forEach((src, idx)=>{
          imageSources[`injury${idx}`]= src;
        });
      }
      
      // 해골 스프라이트 (죽음 상태일 때)
      if(isDead){
        skullSprites.forEach((src, idx)=>{
          imageSources[`skull${idx}`]= src;
        });
      }
      
      // 냉장고 스프라이트 (냉장고 상태일 때 또는 꺼내기 애니메이션 중일 때)
      if(isFrozen || takeOutAt){
        fridgeSprites.forEach((src, idx)=>{
          imageSources[`fridge${idx}`]= src;
        });
      }

      let loaded=0;
      const total= Object.keys(imageSources).length;
      if(total===0){
        startAnimation(ctx, frames);
        return;
      }

      Object.keys(imageSources).forEach(key=>{
        const img= new Image();
        img.src= imageSources[key];
        img.onload= ()=>{
          loaded++;
          if(loaded=== total){
            startAnimation(ctx, frames);
          }
        };
        img.onerror= ()=>{
          console.warn("Fail to load:", imageSources[key]);
          loaded++;
          if(loaded=== total){
            startAnimation(ctx, frames);
          }
        };
        spriteCache.current[key]= img;
      });
    };

    if(animationID.current){
      cancelAnimationFrame(animationID.current);
      animationID.current= null;
    }
    initImages();
    return ()=>{
      if(animationID.current){
        cancelAnimationFrame(animationID.current);
      }
    };
    // startAnimation은 같은 렌더 스코프의 상태를 읽는 로컬 함수로 관리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[
    width,height,
    idleFramesKey,idleMotionTimelineKey,eatFramesKey,foodRejectFramesKey,
    digimonImageBase,
    currentAnimation,showFood,feedStep,
    foodSizeScale,foodSpritesKey,developerMode,
    poopCount,showPoopCleanAnimation,cleanStep,
    sleepStatus,isSleepingLikeVisualState,isRefused,isDead,isInjured,selectedDigimon,isFrozen,frozenAt,takeOutAt
  ]);

  function startAnimation(ctx, frames){
    let frame=0;
    const speed=25;
    let animationStartedAt = null;

    function animate(timestamp){
      const nowTimestamp = typeof timestamp === "number" ? timestamp : performance.now();
      if(animationStartedAt === null){
        animationStartedAt = nowTimestamp;
      }

      const fridgeRenderPolicy = getFridgeRenderPolicy({
        isFrozen,
        frozenAt,
        takeOutAt,
        now: Date.now(),
      });

      ctx.clearRect(0,0,width,height);

      // 디지몬
      if(fridgeRenderPolicy.shouldShowDigimon && frames.length>0){
        const canUseIdleMotionTimeline =
          fridgeRenderPolicy.shouldUseIdleMotionTimeline &&
          currentAnimation === "idle" &&
          !isInjured &&
          !isSleepingLikeVisualState &&
          idleMotionTimeline.length > 0;
        const motionStepIndex = canUseIdleMotionTimeline
          ? Math.floor((nowTimestamp - animationStartedAt) / IDLE_MOTION_STEP_MS) % idleMotionTimeline.length
          : null;
        const motionStep = motionStepIndex !== null
          ? idleMotionTimeline[motionStepIndex]
          : null;

        // 거절 애니메이션일 때는 feedStep으로 좌우 번갈아가게
        let idx = 0;
        let name;
        if(currentAnimation === "foodRejectRefuse" && fridgeRenderPolicy.shouldCycleDigimonFrames){
          // feedStep % 2로 좌우 번갈아가게 (0: 좌, 1: 우)
          idx = feedStep % 2;
          name = frames[idx] || frames[0];
        } else if (motionStep) {
          name = `${motionStep.spriteNumber}`;
        } else {
          idx = fridgeRenderPolicy.shouldCycleDigimonFrames
            ? Math.floor(frame/speed) % frames.length
            : 0;
          name = frames[idx] || frames[0];
        }
        const key= getDigimonSpriteKey(name);
        const digimonImg= spriteCache.current[key];
        if(digimonImg && digimonImg.naturalWidth>0){
          const baseAnimationForDraw = fridgeRenderPolicy.shouldFreezeDigimonMotion
            ? "idle"
            : currentAnimation;
          const drawState = motionStep
            ? getIdleMotionDrawState(width, height, motionStep)
            : {
                ...getDefaultDigimonDrawState(width, height, baseAnimationForDraw),
                flip:
                  fridgeRenderPolicy.shouldCycleDigimonFrames &&
                  currentAnimation === "foodRejectRefuse" &&
                  idx === 1,
              };

          drawDigimonImage(ctx, digimonImg, drawState);

          // 거절 상태일 때만 😡 표시 (디지몬 오른쪽)
          if(currentAnimation === "foodRejectRefuse" && isRefused){
            ctx.font="32px Arial";
            ctx.fillStyle="red";
            ctx.fillText("😡", drawState.digiX + drawState.digiW + 10, drawState.digiY + drawState.digiH/2);
          }

          if(developerMode){
            ctx.fillStyle="red";
            ctx.font="12px sans-serif";
            const motionLabel = motionStep
              ? ` F:${motionStep.f} X:${motionStep.x} Y:${motionStep.y} Flip:${motionStep.flip ? "Y" : "N"}`
              : "";
            ctx.fillText(`Sprite: ${name}.png${motionLabel}`, drawState.digiX, drawState.digiY + drawState.digiH + 12);
          }
        }
      }

      // 음식 (거절 애니메이션일 때는 표시하지 않음)
      if(showFood && currentAnimation !== "foodRejectRefuse"){
        const foodStepToShow = feedStep;
        if(foodStepToShow < foodSprites.length){
          const fKey= `food${foodStepToShow}`;
          const fImg= spriteCache.current[fKey];
          if(fImg && fImg.naturalWidth>0){
            const fw= width*foodSizeScale;
            const fh= height*foodSizeScale;
            const fx= width*0.2 - fw/2;
            const fy= (height-fh)/2;
            ctx.drawImage(fImg, fx,fy,fw,fh);

            if(developerMode){
              ctx.fillStyle="blue";
              ctx.fillText(`Food: ${foodSprites[foodStepToShow]}`, fx, fy+fh+12);
            }
          }
        }
      }

      // ★ (4) 똥 표시 (정확한 개수만큼 렌더링, 위치 분산)
      const poopImg= spriteCache.current["poop"];
      if(poopImg && poopImg.naturalWidth>0){
        // poopCount => 0..8
        // Array.from을 사용하여 정확한 개수만큼 렌더링
        const validPoopCount = Math.min(Math.max(0, poopCount), 8); // 0-8 범위 제한
        Array.from({ length: validPoopCount }).forEach((_, i) => {
          // 유니크한 위치 계산을 위해 poopCount와 index 조합 사용
          const posIndex = i % poopPositions.length; // 위치 배열 인덱스
          const pos= poopPositions[posIndex];
          
          // 위치 분산: 각 똥마다 약간의 오프셋 추가 (겹치지 않도록)
          // index와 poopCount를 조합하여 더 정확한 분산
          const offsetX = Math.sin(i * 0.5) * (width * 0.03); // 사인파를 사용한 자연스러운 분산
          const offsetY = Math.cos(i * 0.7) * (height * 0.02); // 코사인파를 사용한 자연스러운 분산
          const px= pos.xRatio*width + offsetX;
          const py= pos.yRatio*height + offsetY;
          const pw= width*0.2; // 똥 크기
          const ph= height*0.2;
          
          // 둥둥 떠다니는 애니메이션 효과 (약간의 상하 움직임)
          const floatOffset = Math.sin(frame * 0.05 + i) * 2; // 프레임 기반 부드러운 움직임
          
          ctx.drawImage(poopImg, px - pw/2, py - ph/2 + floatOffset, pw, ph);

          if(developerMode){
            ctx.fillStyle="purple";
            ctx.fillText(`Poop#${i+1} (${validPoopCount})`, px - pw/2, (py - ph/2 + floatOffset)-2);
          }
        });
      }

      // ★ (5) 청소 애니메이션
      
      if(showPoopCleanAnimation){
        const cImg = spriteCache.current["clean"];
        if(cImg && cImg.naturalWidth > 0){
          const w= width*0.3, h= height*0.25;
      
          // cleanStep=0..3 => x 좌표 이동
          const steps=4;
          const ratio= cleanStep/(steps-1);
          const xPos= width*(1 - 0.9*ratio);
      
          // (A) 세 군데 y좌표
          const topY= height*0.15;
          const midY= height*0.4;
          const botY= height*0.65;
      
          // 세 줄
          ctx.drawImage(cImg, xPos, topY, w, h);
          ctx.drawImage(cImg, xPos, midY, w, h);
          ctx.drawImage(cImg, xPos, botY, w, h);
        }
      }

      // ★ (6) Zzz 애니메이션 (수면 상태, 사망 상태가 아닐 때만, 디지타마 제외, 냉장고 상태 제외)
      if(
        isSleepingLikeVisualState &&
        !isDead &&
        !isFrozen &&
        selectedDigimon !== "Digitama"
      ){
        const zzzFrameIdx = Math.floor(frame/speed) % zzzSprites.length;
        const zzzKey = `zzz${zzzFrameIdx}`;
        const zzzImg = spriteCache.current[zzzKey];
        if(zzzImg && zzzImg.naturalWidth > 0){
          // 디지몬 머리 위에 표시
          const zzzW = width * 0.3;
          const zzzH = height * 0.2;
          const zzzX = (width - zzzW) / 2;
          const zzzY = (height - height*0.4) / 2 - zzzH; // 디지몬 위쪽
          ctx.drawImage(zzzImg, zzzX, zzzY, zzzW, zzzH);
          
          if(developerMode){
            ctx.fillStyle="yellow";
            ctx.font="12px sans-serif";
            ctx.fillText(`Zzz: ${535 + zzzFrameIdx}.png`, zzzX, zzzY - 2);
          }
        }
      }
      
      // ★ (6-1) 부상 스프라이트 애니메이션 (부상 상태, 사망 상태가 아닐 때만)
      if(isInjured && !isDead){
        const injuryFrameIdx = Math.floor(frame/speed) % injurySprites.length;
        const injuryKey = `injury${injuryFrameIdx}`;
        const injuryImg = spriteCache.current[injuryKey];
        if(injuryImg && injuryImg.naturalWidth > 0){
          // 디지몬 머리 위에 표시 (졸음 스프라이트와 동일한 위치)
          const injuryW = width * 0.3;
          const injuryH = height * 0.2;
          const injuryX = (width - injuryW) / 2;
          const injuryY = (height - height*0.4) / 2 - injuryH; // 디지몬 위쪽
          ctx.drawImage(injuryImg, injuryX, injuryY, injuryW, injuryH);
          
          if(developerMode){
            ctx.fillStyle="orange";
            ctx.font="12px sans-serif";
            ctx.fillText(`Injury: ${541 + injuryFrameIdx}.png`, injuryX, injuryY - 2);
          }
        }
      }
      
      // ★ (7) 해골 애니메이션 (죽음 상태)
      if(isDead){
        const skullFrameIdx = Math.floor(frame/speed) % skullSprites.length;
        const skullKey = `skull${skullFrameIdx}`;
        const skullImg = spriteCache.current[skullKey];
        if(skullImg && skullImg.naturalWidth > 0){
          // 디지몬 머리 위에 표시 (Zzz와 동일한 위치)
          const skullW = width * 0.3;
          const skullH = height * 0.2;
          const skullX = (width - skullW) / 2;
          const skullY = (height - height*0.4) / 2 - skullH; // 디지몬 위쪽
          ctx.drawImage(skullImg, skullX, skullY, skullW, skullH);
          
          if(developerMode){
            ctx.fillStyle="red";
            ctx.font="12px sans-serif";
            ctx.fillText(`Skull: ${543 + skullFrameIdx}.png`, skullX, skullY - 2);
          }
        }
      }
      
      // ★ (8) 냉장고 애니메이션
      // 꺼내기 애니메이션 (4단계)
      if(!isFrozen && !isDead && fridgeRenderPolicy.takeOutStage){
        const elapsedSeconds = (fridgeRenderPolicy.takeOutElapsedMs || 0) / 1000;
        const currentStage = fridgeRenderPolicy.takeOutStage;

        // 1단계: 해제 신호 (553 진동 효과)
        if (currentStage === 1) {
          const fridgeImg1 = spriteCache.current['fridge1'];
          if(fridgeImg1 && fridgeImg1.naturalWidth > 0){
            const fridgeW = width * 0.5;
            const fridgeH = height * 0.5;
            // 진동 효과: 좌우로 미세하게 흔들림 (sin 함수 사용)
            const shakeAmount = 3; // 흔들림 정도 (픽셀)
            const shakeSpeed = 20; // 진동 속도
            const shakeOffset = Math.sin(elapsedSeconds * shakeSpeed) * shakeAmount;
            const fridgeX = (width - fridgeW) / 2 + shakeOffset;
            const fridgeY = (height - fridgeH) / 2;
            ctx.drawImage(fridgeImg1, fridgeX, fridgeY, fridgeW, fridgeH);
            
            if(developerMode){
              ctx.fillStyle="cyan";
              ctx.font="12px sans-serif";
              ctx.fillText(`TakeOut Stage 1: 553.png (Shake) (${elapsedSeconds.toFixed(2)}s)`, fridgeX, fridgeY - 2);
            }
          }
        }
        
        // 2단계: 해동 시작 (555 → 554 얼음 감소, 553 사라짐)
        if (currentStage === 2) {
          // 554와 555를 교차 표시 (얼음 감소 효과)
          // elapsedSeconds가 0.8~2.0초 사이이므로, 0.2초 단위로 나누어 교차
          const stage2Elapsed = elapsedSeconds - 0.8; // 2단계 시작 후 경과 시간
          const cycleIndex = Math.floor(stage2Elapsed / 0.2); // 0.2초마다 인덱스 증가
          const show555 = cycleIndex % 2 === 0; // 짝수 인덱스: 555, 홀수 인덱스: 554
          
          const coverW = width * 0.4;
          const coverH = height * 0.4;
          const coverX = (width - coverW) / 2;
          const coverY = (height - height*0.4) / 2 - coverH * 0.3;
          
          if (show555) {
            const fridgeImg3 = spriteCache.current['fridge3'];
            if(fridgeImg3 && fridgeImg3.naturalWidth > 0){
              ctx.drawImage(fridgeImg3, coverX, coverY, coverW, coverH);
              
              if(developerMode){
                ctx.fillStyle="cyan";
                ctx.font="12px sans-serif";
                ctx.fillText(`TakeOut Stage 2: 555.png (${elapsedSeconds.toFixed(2)}s)`, coverX, coverY - 2);
              }
            }
          } else {
            const fridgeImg2 = spriteCache.current['fridge2'];
            if(fridgeImg2 && fridgeImg2.naturalWidth > 0){
              ctx.drawImage(fridgeImg2, coverX, coverY, coverW, coverH);
              
              if(developerMode){
                ctx.fillStyle="cyan";
                ctx.font="12px sans-serif";
                ctx.fillText(`TakeOut Stage 2: 554.png (${elapsedSeconds.toFixed(2)}s)`, coverX, coverY - 2);
              }
            }
          }
        }
        
        // 3단계: 얼음 깨짐 (552 제거)
        if (currentStage === 3) {
          // 552만 표시 (제거 준비)
          const fridgeImg0 = spriteCache.current['fridge0'];
          if(fridgeImg0 && fridgeImg0.naturalWidth > 0){
            const fridgeW = width * 0.3;
            const fridgeH = height * 0.3;
            const fridgeX = width * 0.2 - fridgeW / 2; // 왼쪽 (밥 위치)
            const fridgeY = height * 0.6 - fridgeH / 2;
            
            // 펑 효과: 점점 작아지면서 사라지는 효과
            const stage3Elapsed = elapsedSeconds - 2.0; // 3단계 시작 후 경과 시간
            const fadeProgress = stage3Elapsed / 0.5; // 0~1 사이 값
            const scale = 1 - fadeProgress; // 1에서 0으로 감소
            
            if (scale > 0) {
              const scaledW = fridgeW * scale;
              const scaledH = fridgeH * scale;
              const scaledX = fridgeX + (fridgeW - scaledW) / 2;
              const scaledY = fridgeY + (fridgeH - scaledH) / 2;
              
              ctx.globalAlpha = scale; // 투명도도 함께 감소
              ctx.drawImage(fridgeImg0, scaledX, scaledY, scaledW, scaledH);
              ctx.globalAlpha = 1.0; // 원래대로 복원
              
              if(developerMode){
                ctx.fillStyle="cyan";
                ctx.font="12px sans-serif";
                ctx.fillText(`TakeOut Stage 3: 552.png (Fade) (${elapsedSeconds.toFixed(2)}s)`, scaledX, scaledY - 2);
              }
            }
          }
        }
        
        // 4단계: 기상 완료 (디지몬만 표시, 냉장고 스프라이트 모두 사라짐)
        // 이 단계에서는 냉장고 스프라이트를 표시하지 않음 (디지몬만 표시)
        if (currentStage === 4) {
          // 냉장고 스프라이트는 표시하지 않음
          if(developerMode){
            ctx.fillStyle="cyan";
            ctx.font="12px sans-serif";
            ctx.fillText(`TakeOut Stage 4: Awake (${elapsedSeconds.toFixed(2)}s)`, 10, 20);
          }
        }
      }
      
      // 넣기 애니메이션 (냉장고 상태일 때) - 3단계 애니메이션
      if(isFrozen && !isDead && fridgeRenderPolicy.fridgeStage !== null){
        const elapsedSeconds = (fridgeRenderPolicy.fridgeElapsedMs || 0) / 1000;
        const currentStage = fridgeRenderPolicy.fridgeStage;

        // 1단계: 밥 위치에 냉장고 (552)만 표시
        if (currentStage === 0) {
          const fridgeImg0 = spriteCache.current['fridge0'];
          if(fridgeImg0 && fridgeImg0.naturalWidth > 0){
            const fridgeW = width * 0.3;
            const fridgeH = height * 0.3;
            const fridgeX = width * 0.2 - fridgeW / 2; // 왼쪽 (밥 위치)
            const fridgeY = height * 0.6 - fridgeH / 2;
            ctx.drawImage(fridgeImg0, fridgeX, fridgeY, fridgeW, fridgeH);
            
            if(developerMode){
              ctx.fillStyle="cyan";
              ctx.font="12px sans-serif";
              ctx.fillText(`Stage 1: 552.png (${elapsedSeconds.toFixed(2)}s)`, fridgeX, fridgeY - 2);
            }
          }
        }
        
        // 2단계: 밥 위치 냉장고(552) + 디지몬 위에 덮개(554/555 교차)
        if (currentStage === 1) {
          // 552 표시
          const fridgeImg0 = spriteCache.current['fridge0'];
          if(fridgeImg0 && fridgeImg0.naturalWidth > 0){
            const fridgeW = width * 0.3;
            const fridgeH = height * 0.3;
            const fridgeX = width * 0.2 - fridgeW / 2;
            const fridgeY = height * 0.6 - fridgeH / 2;
            ctx.drawImage(fridgeImg0, fridgeX, fridgeY, fridgeW, fridgeH);
          }
          
          // 554와 555를 0.5초 간격으로 교차 표시
          // elapsedSeconds가 1.0~2.5초 사이이므로, 0.5초 단위로 나누어 교차
          const stage2Elapsed = elapsedSeconds - 1.0; // 2단계 시작 후 경과 시간
          const cycleIndex = Math.floor(stage2Elapsed / 0.5); // 0.5초마다 인덱스 증가
          const show554 = cycleIndex % 2 === 0; // 짝수 인덱스: 554, 홀수 인덱스: 555
          
          const coverW = width * 0.4;
          const coverH = height * 0.4;
          const coverX = (width - coverW) / 2;
          const coverY = (height - height*0.4) / 2 - coverH * 0.3;
          
          if (show554) {
            const fridgeImg2 = spriteCache.current['fridge2'];
            if(fridgeImg2 && fridgeImg2.naturalWidth > 0){
              ctx.drawImage(fridgeImg2, coverX, coverY, coverW, coverH);
              
              if(developerMode){
                ctx.fillStyle="cyan";
                ctx.font="12px sans-serif";
                ctx.fillText(`Stage 2: 554.png (${elapsedSeconds.toFixed(2)}s)`, coverX, coverY - 2);
              }
            }
          } else {
            const fridgeImg3 = spriteCache.current['fridge3'];
            if(fridgeImg3 && fridgeImg3.naturalWidth > 0){
              ctx.drawImage(fridgeImg3, coverX, coverY, coverW, coverH);
              
              if(developerMode){
                ctx.fillStyle="cyan";
                ctx.font="12px sans-serif";
                ctx.fillText(`Stage 2: 555.png (${elapsedSeconds.toFixed(2)}s)`, coverX, coverY - 2);
              }
            }
          }
        }
        
        // 3단계: 화면 가운데 냉장고 안 (553)만 표시
        if (currentStage === 2) {
          const fridgeImg1 = spriteCache.current['fridge1'];
          if(fridgeImg1 && fridgeImg1.naturalWidth > 0){
            const fridgeW = width * 0.5;
            const fridgeH = height * 0.5;
            const fridgeX = (width - fridgeW) / 2;
            const fridgeY = (height - fridgeH) / 2;
            ctx.drawImage(fridgeImg1, fridgeX, fridgeY, fridgeW, fridgeH);
            
            if(developerMode){
              ctx.fillStyle="cyan";
              ctx.font="12px sans-serif";
              ctx.fillText(`Stage 3: 553.png (${elapsedSeconds.toFixed(2)}s)`, fridgeX, fridgeY - 2);
            }
          }
        }
      }


      frame++;
      animationID.current= requestAnimationFrame(animate);
    }
    animate();
  }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{
        position:"absolute",
        top:0,left:0,
        backgroundColor:"transparent",
        ...style
      }}
    />
  );
};

export default Canvas;
