import React, { useState, FormEvent } from 'react';
import { FormData, SKILL_KEYS } from '../types.ts';
import { INITIAL_FORM_DATA, SKILL_DEFINITIONS, WORKSTYLE_OPTIONS, BUDGET_OPTIONS, AGE_BRACKET_OPTIONS, MARKET_OPTIONS } from '../constants.ts';
import { SliderInput } from './SliderInput.tsx';
import { MultiSelect } from './MultiSelect.tsx';
import { RadioGroup } from './RadioGroup.tsx';
import { SparklesIcon } from './icons.tsx';

interface DiagnosticFormProps {
  onSubmit: (formData: FormData) => void;
}

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-t border-gray-200 pt-6 mt-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

export const DiagnosticForm: React.FC<DiagnosticFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleChange = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (formErrors[key as string]) {
      setFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[key as string];
        return newErrors;
      });
    }
  };
  
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = 'Name is required.';
    if (!formData.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid.';
    }
    if (!formData.consent) errors.consent = 'You must agree to the terms.';
    if(formData.workstyle.length === 0) errors.workstyle = 'Please select at least one workstyle.';
    if(formData.markets.length === 0) errors.markets = 'Please select at least one market.';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 sm:p-10" noValidate>
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900">Discover Your AI-Era Persona</h2>
        <p className="mt-2 text-gray-600">Turn your scattered skills into a clear plan for value creation. Rate yourself honestly—your edge, not your ego.</p>
      </div>

      <FormSection title="Basic Info">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-800">Name</label>
          <input type="text" id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} className={`mt-1 block w-full px-3 py-2 border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900`} required />
          {formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-800">Email</label>
          <input type="email" id="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} className={`mt-1 block w-full px-3 py-2 border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900`} required />
          {formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}
        </div>
        <div className="flex items-start">
            <div className="flex items-center h-5">
                <input id="consent" name="consent" type="checkbox" checked={formData.consent} onChange={e => handleChange('consent', e.target.checked)} className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 ${formErrors.consent ? 'border-red-500' : 'border-gray-300'} rounded`} />
            </div>
            <div className="ml-3 text-sm">
                <label htmlFor="consent" className="font-medium text-gray-700">I agree to have my responses stored for research and follow-up.</label>
            </div>
        </div>
        {formErrors.consent && <p className="text-red-500 text-xs mt-1">{formErrors.consent}</p>}
      </FormSection>

      <FormSection title="Core Skill Ratings">
        {SKILL_KEYS.map(key => (
          <SliderInput
            key={key}
            label={SKILL_DEFINITIONS[key].label}
            prompt={SKILL_DEFINITIONS[key].prompt}
            value={formData.scores[key]}
            onChange={value => handleChange('scores', { ...formData.scores, [key]: value })}
          />
        ))}
      </FormSection>

      <FormSection title="Workstyle & Intent">
        <MultiSelect label="Energizing Roles" prompt="Which roles energize you most? (pick up to 2)" options={WORKSTYLE_OPTIONS} selectedOptions={formData.workstyle} onChange={value => handleChange('workstyle', value)} maxSelection={2} />
        {formErrors.workstyle && <p className="text-red-500 text-xs mt-1">{formErrors.workstyle}</p>}
        
        <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-800 mb-1">Time Investment</label>
            <p className="text-sm text-gray-500 mt-1 mb-3">How many hours per week can you realistically invest?</p>
            <input type="number" id="time" value={formData.time_per_week_hours} onChange={e => handleChange('time_per_week_hours', Math.max(1, parseInt(e.target.value, 10)) || 1)} min="1" max="100" className="mt-1 block w-full sm:w-1/2 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" />
        </div>
        
        <RadioGroup label="Budget" prompt="Available budget to invest in tools or marketing?" options={BUDGET_OPTIONS} selectedValue={formData.budget_level} onChange={value => handleChange('budget_level', value)} />
        
        <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-800">Age Bracket</label>
            <p className="text-sm text-gray-500 mt-1 mb-3">Your age bracket (for realism filters).</p>
            <select id="age" value={formData.age_bracket} onChange={e => handleChange('age_bracket', e.target.value as any)} className="mt-1 block w-full sm:w-1/2 pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-white text-gray-900">
                {AGE_BRACKET_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
        </div>

        <MultiSelect label="Preferred Markets" prompt="Preferred markets to serve (pick up to 3)" options={MARKET_OPTIONS} selectedOptions={formData.markets} onChange={value => handleChange('markets', value)} maxSelection={3} />
        {formErrors.markets && <p className="text-red-500 text-xs mt-1">{formErrors.markets}</p>}
      </FormSection>

      <FormSection title="Wildcards & Personal Dimensions">
        <div>
          <label htmlFor="wildcards" className="block text-sm font-medium text-gray-800">Unusual Skills & Interests</label>
          <p className="text-sm text-gray-500 mt-1 mb-3">List any unusual skills that shape how you work (hobbies, past careers, stage experience, crafts, sports fandom, etc.).</p>
          <textarea id="wildcards" value={formData.wildcards} onChange={e => handleChange('wildcards', e.target.value)} rows={3} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900"></textarea>
        </div>
        <div>
          <label htmlFor="constraints" className="block text-sm font-medium text-gray-800">Constraints (Optional)</label>
          <p className="text-sm text-gray-500 mt-1 mb-3">Anything limiting your choices (mobility, equipment, geography, health)?</p>
          <input type="text" id="constraints" value={formData.constraints} onChange={e => handleChange('constraints', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" />
        </div>
      </FormSection>

      <div className="mt-10 pt-6 border-t border-gray-200">
        <button type="submit" className="w-full flex items-center justify-center gap-2 px-6 py-4 border border-transparent text-base font-medium rounded-xl text-white bg-indigo-600 shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform transform hover:scale-105">
          <SparklesIcon className="h-6 w-6" />
          Generate My Renaissance Map
        </button>
      </div>
    </form>
  );
};