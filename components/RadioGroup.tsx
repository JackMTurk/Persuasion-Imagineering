
import React from 'react';

interface RadioOption<T extends string> {
  value: T;
  label: string;
}

interface RadioGroupProps<T extends string> {
  label: string;
  prompt: string;
  options: RadioOption<T>[];
  selectedValue: T;
  onChange: (value: T) => void;
}

export const RadioGroup = <T extends string>({ label, prompt, options, selectedValue, onChange }: RadioGroupProps<T>) => {
  return (
    <div className="py-4">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      <p className="text-sm text-gray-500 mt-1 mb-3">{prompt}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {options.map(option => {
          const isSelected = selectedValue === option.value;
          return (
            <label
              key={option.value}
              className={`relative flex items-center justify-center p-4 border rounded-lg cursor-pointer transition-all duration-200
                ${isSelected ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500' : 'bg-white border-gray-300 hover:border-gray-400'}
              `}
            >
              <input
                type="radio"
                name={label}
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span className="text-sm font-medium text-gray-800">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
