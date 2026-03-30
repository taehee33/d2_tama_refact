import React from "react";
import DigimonGuidePanel from "./panels/DigimonGuidePanel";

export default function DigimonInfoModal(props) {
  const { onClose } = props;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto px-4"
        onClick={(event) => event.stopPropagation()}
      >
        <DigimonGuidePanel {...props} onClose={onClose} showCloseButton />
      </div>
    </div>
  );
}
