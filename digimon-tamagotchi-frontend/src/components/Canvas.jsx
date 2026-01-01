// src/components/Canvas.jsx
import React, { useEffect, useRef } from "react";

const poopSprite= "/images/533.png";  // 똥 스프라이트
const cleanSprite= "/images/534.png"; // 청소(빗자루 등) 스프라이트
const zzzSprites= ["/images/535.png", "/images/536.png", "/images/537.png", "/images/538.png"]; // Zzz 스프라이트

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
    sleepStatus
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
    
    // Zzz 스프라이트 (수면 상태일 때)
    if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
      zzzSprites.forEach((src, idx)=>{
        imageSources[`zzz${idx}`]= src;
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
        const idx= Math.floor(frame/speed)% frames.length;
        const name= frames[idx];
        const key= `digimon${idx}`;
        const digimonImg= spriteCache.current[key];
        if(digimonImg && digimonImg.naturalWidth>0){
          const digiW= width*0.4;
          const digiH= height*0.4;
          let digiX= (width-digiW)/2;
          if(currentAnimation==="eat"){
            digiX= width*0.6 - digiW/2;
          }
          ctx.drawImage(digimonImg, digiX,(height-digiH)/2,digiW,digiH);

          if(developerMode){
            ctx.fillStyle="red";
            ctx.font="12px sans-serif";
            ctx.fillText(`Sprite: ${name}.png`, digiX,(height-digiH)/2 + digiH+12);
          }
        }
      }

      // 음식
      if(showFood && feedStep<foodSprites.length){
        const fKey= `food${feedStep}`;
        const fImg= spriteCache.current[fKey];
        if(fImg && fImg.naturalWidth>0){
          const fw= width*foodSizeScale;
          const fh= height*foodSizeScale;
          const fx= width*0.2 - fw/2;
          const fy= (height-fh)/2;
          ctx.drawImage(fImg, fx,fy,fw,fh);

          if(developerMode){
            ctx.fillStyle="blue";
            ctx.fillText(`Food: ${foodSprites[feedStep]}`, fx, fy+fh+12);
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

      // ★ (6) Zzz 애니메이션 (수면 상태)
      if(sleepStatus === "SLEEPING" || sleepStatus === "TIRED"){
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