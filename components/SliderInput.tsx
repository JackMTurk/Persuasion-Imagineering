
import React from 'react';

interface SliderInputProps {
  label: string;
  prompt: string;
  value: number;
  onChange: (value: number) => void;
}

export const SliderInput: React.FC<SliderInputProps> = ({ label, prompt, value, onChange }) => {
  const getBackgroundColor = (value: number) => {
    const percentage = value * 10;
    return `linear-gradient(to right, #4f46e5 ${percentage}%, #e5e7eb ${percentage}%)`;
  };

  return (
    <div className="py-4">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      <p className="text-sm text-gray-500 mt-1 mb-3">{prompt}</p>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="10"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
          style={{ background: getBackgroundColor(value) }}
        />
        <span className="font-semibold text-indigo-600 w-8 text-center bg-indigo-50 rounded-md py-1">{value}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1">
        <span>Novice</span>
        <span>World-Class Pro</span>
      </div>
       <style>{`
        .slider-thumb::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 20px;
            height: 20px;
            background: #fff;
            border: 2px solid #4f46e5;
            border-radius: 50%;
            cursor: pointer;
        }
        .slider-thumb::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: #fff;
            border: 2px solid #4f46e5;
            border-radius: 50%;
            cursor: pointer;
        }
    `}</style>
    </div>
  );
};
