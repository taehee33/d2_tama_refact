import React from "react";

const SizeAdjuster = ({ size, onSizeChange }) => {
  return (
    <div className="space-y-4 p-4 border rounded">
      <div>
        <label className="block font-semibold">
          화면 한 변:
          <div className="flex items-center space-x-2">
            <input
              type="range"
              min="100"
              max="600"
              value={size}
              onChange={onSizeChange}
              className="flex-1"
            />
            <input
              type="number"
              value={size}
              onChange={onSizeChange}
              className="w-20 p-1 border rounded"
            />
          </div>
        </label>
      </div>
    </div>
  );
};

export default SizeAdjuster;
