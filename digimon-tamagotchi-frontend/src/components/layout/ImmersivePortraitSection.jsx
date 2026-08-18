import React from "react";
import ImmersivePortraitPixelSection from "./ImmersivePortraitPixelSection";

const ImmersivePortraitSection = ({ skin, legacyContent, pixelSectionProps }) => {
  if (!skin?.portraitPixel) return legacyContent;

  return <ImmersivePortraitPixelSection skin={skin} {...pixelSectionProps} />;
};

export default ImmersivePortraitSection;
