// src/components/Canvas.jsx
import React, { useEffect, useRef } from "react";

const poopSprite= "/images/533.png";  // 똥 스프라이트
const cleanSprite= "/images/534.png"; // 청소(빗자루 등) 스프라이트
const zzzSprites= ["/images/535.png", "/images/536.png", "/images/537.png", "/images/538.png"]; // Zzz 스프라이트
const injurySprites= ["/images/541.png", "/images/542.png"]; // 부상 스프라이트
const skullSprites= ["/images/543.png", "/images/544.png"]; // 해골 스프라이트 (죽음 상태)

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

const Canvas = ({
  style={},
  width=300,
  height=200,
  // frames
  idleFrames=[],
  eatFrames=[],
  foodRejectFrames=[],
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
  sleepStatus="AWAKE", // 'AWAKE' | 'TIRED' | 'SLEEPING'
  // ★ (4) 거절 상태 (오버피드)
  isRefused=false, // 고기 거절 상태
  // ★ (5) 사망 상태
  isDead=false, // 사망 여부
  // ★ (6) 부상 상태
  isInjured=false, // 부상 여부
  // ★ (7) 선택된 디지몬 (디지타마 수면 상태 체크용)
  selectedDigimon="", // 선택된 디지몬 이름
}) => {
  const canvasRef= useRef(null);
  const spriteCache= useRef({});
  const animationID= useRef(null);

  useEffect(()=>{
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
  },[
    width,height,
    idleFrames,eatFrames,foodRejectFrames,
    currentAnimation,showFood,feedStep,
    foodSizeScale,foodSprites,developerMode,
    poopCount,showPoopCleanAnimation,cleanStep,
    sleepStatus,isRefused,isDead,isInjured,selectedDigimon
  ]);

  function initImages(){
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

    // ★ (3) 로드할 이미지들
    const imageSources={};
    frames.forEach((fn,idx)=>{
      imageSources[`digimon${idx}`] = `/images/${fn}.png`;
    });
    foodSprites.forEach((src,idx)=>{
      imageSources[`food${idx}`]= src;
    });

    // poop, clean
    imageSources["poop"]= poopSprite;    // "/images/533.png"
    imageSources["clean"]= cleanSprite;  // "/images/534.png"
    
    // Zzz 스프라이트 (수면 상태일 때, 사망 상태가 아닐 때만, 디지타마 제외)
    if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && !isDead && selectedDigimon !== "Digitama"){
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
  }

  function startAnimation(ctx, frames){
    let frame=0;
    const speed=25;

    function animate(){
      ctx.clearRect(0,0,width,height);

      // 디지몬
      if(frames.length>0){
        // 거절 애니메이션일 때는 feedStep으로 좌우 번갈아가게
        let idx, name;
        if(currentAnimation === "foodRejectRefuse"){
          // feedStep % 2로 좌우 번갈아가게 (0: 좌, 1: 우)
          idx = feedStep % 2;
          name = frames[idx] || frames[0];
        } else {
          idx = Math.floor(frame/speed) % frames.length;
          name = frames[idx];
        }
        const key= `digimon${idx}`;
        const digimonImg= spriteCache.current[key];
        if(digimonImg && digimonImg.naturalWidth>0){
          const digiW= width*0.4;
          const digiH= height*0.4;
          let digiX= (width-digiW)/2;
          if(currentAnimation==="eat" || currentAnimation==="foodRejectRefuse"){
            digiX= width*0.6 - digiW/2;
          }
          
          // 거절 애니메이션일 때 우측 프레임(홀수)은 좌우 반전
          if(currentAnimation === "foodRejectRefuse" && idx === 1){
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(digimonImg, -digiX - digiW, (height-digiH)/2, digiW, digiH);
            ctx.restore();
          } else {
            ctx.drawImage(digimonImg, digiX,(height-digiH)/2,digiW,digiH);
          }

          // 거절 상태일 때만 😡 표시 (디지몬 오른쪽)
          if(currentAnimation === "foodRejectRefuse" && isRefused){
            ctx.font="32px Arial";
            ctx.fillStyle="red";
            ctx.fillText("😡", digiX + digiW + 10, (height-digiH)/2 + digiH/2);
          }

          if(developerMode){
            ctx.fillStyle="red";
            ctx.font="12px sans-serif";
            ctx.fillText(`Sprite: ${name}.png`, digiX,(height-digiH)/2 + digiH+12);
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

      // ★ (6) Zzz 애니메이션 (수면 상태, 사망 상태가 아닐 때만, 디지타마 제외)
      if((sleepStatus === "SLEEPING" || sleepStatus === "TIRED") && !isDead && selectedDigimon !== "Digitama"){
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