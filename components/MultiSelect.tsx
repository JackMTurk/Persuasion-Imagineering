
import React from 'react';

interface MultiSelectProps<T extends string> {
  label: string;
  prompt: string;
  options: T[];
  selectedOptions: T[];
  onChange: (selected: T[]) => void;
  maxSelection?: number;
}

export const MultiSelect = <T extends string>({ label, prompt, options, selectedOptions, onChange, maxSelection }: MultiSelectProps<T>) => {

  const handleSelect = (option: T) => {
    let newSelected: T[];
    if (selectedOptions.includes(option)) {
      newSelected = selectedOptions.filter(item => item !== option);
    } else {
      if (maxSelection && selectedOptions.length >= maxSelection) {
        // Optional: provide feedback that max is reached
        return;
      }
      newSelected = [...selectedOptions, option];
    }
    onChange(newSelected);
  };

  return (
    <div className="py-4">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      <p className="text-sm text-gray-500 mt-1 mb-3">{prompt}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => {
          const isSelected = selectedOptions.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200
                ${isSelected 
                  ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-500' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
              `}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
};
