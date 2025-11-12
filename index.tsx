import React, { useState, useCallback, useRef, FormEvent } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Global Type Declarations ---
declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
    }
}

// --- From types.ts ---
interface Scores {
  communication: number;
  creative: number;
  strategy: number;
  technical: number;
  eq: number;
  learning: number;
}

const SKILL_KEYS: (keyof Scores)[] = ['communication', 'creative', 'strategy', 'technical', 'eq', 'learning'];


type Workstyle = "Create" | "Teach" | "Advise" | "Build" | "Lead";
type Budget = "low" | "medium" | "high";
type AgeBracket = "18-29" | "30-44" | "45-59" | "60+";
type Market = "SMB" | "Creators" | "B2B SaaS" | "Healthcare" | "Education" | "Nonprofits" | "Local Services" | "Professional Services" | "Ecommerce";

interface FormData {
  name: string;
  email: string;
  consent: boolean;
  scores: Scores;
  workstyle: Workstyle[];
  time_per_week_hours: number;
  budget_level: Budget;
  age_bracket: AgeBracket;
  markets: Market[];
  wildcards: string;
  constraints: string;
}

interface Opportunity {
  what: string;
  whyFit: string;
  audience: string;
  offer: string;
  channel: string;
  speedPlan: string;
}

interface Report {
  personaTitle: string;
  identityParagraph: string;
  topStrengths: { strength: string; reason: string }[];
  opportunityMap: Opportunity[];
  quickWins: string[];
  buildPlan: string[];
  guardrails: string[];
  tools: string[];
  starterPrompts: { title: string; prompt: string }[];
  jsonData: string;
}

// --- From constants.ts ---
const SKILL_DEFINITIONS: { [key in keyof Scores]: { label: string, prompt: string } } = {
  communication: {
    label: "Communication",
    prompt: "How skilled are you at expressing ideas through words or speech (writing, teaching, persuading, presenting)?"
  },
  creative: {
    label: "Creative Expression",
    prompt: "How confident are you in producing or shaping creative media—video, design, voice, humor, performance?"
  },
  strategy: {
    label: "Strategic Thinking",
    prompt: "How well do you connect dots, design offers, plan campaigns, or architect marketing systems?"
  },
  technical: {
    label: "Technical Fluency",
    prompt: "How comfortable are you with digital tools—AI apps, automation, analytics, or basic coding?"
  },
  eq: {
    label: "Emotional Intelligence",
    prompt: "How strong are you at reading people, resolving conflict, inspiring, or leading through empathy?"
  },
  learning: {
    label: "Learning Agility / Curiosity",
    prompt: "How quickly do you learn new ideas, explore trends, and synthesize knowledge?"
  },
};

const WORKSTYLE_OPTIONS: Workstyle[] = ["Create", "Teach", "Advise", "Build", "Lead"];
const BUDGET_OPTIONS: { value: Budget, label: string }[] = [
  { value: 'low', label: 'Low (<$100 mo)' },
  { value: 'medium', label: 'Medium ($100–500 mo)' },
  { value: 'high', label: 'High (>$500 mo)' },
];
const AGE_BRACKET_OPTIONS: AgeBracket[] = ["18-29", "30-44", "45-59", "60+"];
const MARKET_OPTIONS: Market[] = ["SMB", "Creators", "B2B SaaS", "Healthcare", "Education", "Nonprofits", "Local Services", "Professional Services", "Ecommerce"];

const INITIAL_FORM_DATA: FormData = {
  name: '',
  email: '',
  consent: false,
  scores: {
    communication: 5,
    creative: 5,
    strategy: 5,
    technical: 5,
    eq: 5,
    learning: 5,
  },
  workstyle: [],
  time_per_week_hours: 10,
  budget_level: 'low',
  age_bracket: '30-44',
  markets: [],
  wildcards: '',
  constraints: '',
};

const PERSONA_MAP: { persona: string, skills: (keyof Scores)[] }[] = [
  { persona: 'Narrative Architect', skills: ['communication', 'strategy'] },
  { persona: 'System Builder', skills: ['technical', 'strategy'] },
  { persona: 'Creator-Educator', skills: ['communication', 'creative'] },
  { persona: 'Opportunity Synthesist', skills: ['learning', 'strategy'] },
  { persona: 'Empathic Facilitator', skills: ['eq', 'communication'] },
  { persona: 'Visual Storysmith', skills: ['creative', 'communication'] },
  { persona: 'Operator-Automator', skills: ['technical', 'communication'] }, // Assuming Tech dominant, Comm secondary
  { persona: 'Community Catalyst', skills: ['eq', 'strategy', 'communication'] },
];

const GOOGLE_SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycby.../exec"; // Replace with actual URL
const AWEBER_ENDPOINT = "https://hook.us1.make.com/k71oy4mebyi2rhjukfe246y5nlcui6in"; // Replace with actual URL

// --- From components/icons.tsx ---
const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a2.25 2.25 0 01-1.463-1.463L12 18.75l1.938-.648a2.25 2.25 0 011.463-1.463L16.25 15l.648 1.938a2.25 2.25 0 011.463 1.463L19.5 18.75l-1.938.648a2.25 2.25 0 01-1.463 1.463z" />
    </svg>
);

const PersonaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
);

const EdgeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
);

const OpportunityIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
);

const QuickWinsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a17.918 17.918 0 00-1.3-1.61 17.92 17.92 0 00-4.54-1.61m0 0a17.92 17.92 0 00-4.54 1.61 17.918 17.918 0 00-1.3 1.61m11.68 0a17.92 17.92 0 00-5.84 0m5.84 0a18.006 18.006 0 00-11.68 0" />
    </svg>
);

const BuildPlanIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 11.25h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
);

const GuardrailsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
);

const ToolsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.664 1.206-.861a7.5 7.5 0 10-9.28 9.28c.197-.466.477-.89.861-1.206l3.03-2.496z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 9.75L2.25 6m0 0L6 2.25M2.25 6h19.5" />
    </svg>
);

const PromptsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
    </svg>
);

const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375V9.375a2.25 2.25 0 00-2.25-2.25H1.5A2.25 2.25 0 00-.75 9.375v10.125c0 1.243 1.007 2.25 2.25 2.25h10.5a2.25 2.25 0 002.25-2.25z" />
    </svg>
);

const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
);

const JsonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
);

const BackIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
    </svg>
);

// --- From components/SliderInput.tsx ---
interface SliderInputProps {
  label: string;
  prompt: string;
  value: number;
  onChange: (value: number) => void;
}

const SliderInput: React.FC<SliderInputProps> = ({ label, prompt, value, onChange }) => {
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

// --- From components/MultiSelect.tsx ---
interface MultiSelectProps<T extends string> {
  label: string;
  prompt: string;
  options: T[];
  selectedOptions: T[];
  onChange: (selected: T[]) => void;
  maxSelection?: number;
}

const MultiSelect = <T extends string>({ label, prompt, options, selectedOptions, onChange, maxSelection }: MultiSelectProps<T>) => {

  const handleSelect = (option: T) => {
    let newSelected: T[];
    if (selectedOptions.includes(option)) {
      newSelected = selectedOptions.filter(item => item !== option);
    } else {
      if (maxSelection && selectedOptions.length >= maxSelection) {
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

// --- From components/RadioGroup.tsx ---
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

const RadioGroup = <T extends string>({ label, prompt, options, selectedValue, onChange }: RadioGroupProps<T>) => {
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

// --- From services/geminiService.ts ---
const reportSchema = {
  type: Type.OBJECT,
  properties: {
    personaTitle: { type: Type.STRING },
    identityParagraph: { type: Type.STRING },
    topStrengths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { strength: { type: Type.STRING }, reason: { type: Type.STRING } },
        required: ['strength', 'reason'],
      },
    },
    opportunityMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          what: { type: Type.STRING }, whyFit: { type: Type.STRING }, audience: { type: Type.STRING },
          offer: { type: Type.STRING }, channel: { type: Type.STRING }, speedPlan: { type: Type.STRING },
        },
        required: ['what', 'whyFit', 'audience', 'offer', 'channel', 'speedPlan'],
      },
    },
    quickWins: { type: Type.ARRAY, items: { type: Type.STRING } },
    buildPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
    guardrails: { type: Type.ARRAY, items: { type: Type.STRING } },
    tools: { type: Type.ARRAY, items: { type: Type.STRING } },
    starterPrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { title: { type: Type.STRING }, prompt: { type: Type.STRING } },
        required: ['title', 'prompt'],
      },
    },
  },
  required: [
    'personaTitle', 'identityParagraph', 'topStrengths', 'opportunityMap',
    'quickWins', 'buildPlan', 'guardrails', 'tools', 'starterPrompts',
  ],
};

const normalizeScores = (scores: Scores): { [key in keyof Scores]: number } => {
    const normalized = {} as { [key in keyof Scores]: number };
    for (const key of SKILL_KEYS) {
        normalized[key] = scores[key] * 10;
    }
    return normalized;
};

const identifyTopSkills = (normalizedScores: { [key in keyof Scores]: number }): (keyof Scores)[] => {
    const sortedSkills = (Object.keys(normalizedScores) as (keyof Scores)[]).sort((a, b) => normalizedScores[b] - normalizedScores[a]);
    const topScore = normalizedScores[sortedSkills[0]];
    const topSkills = sortedSkills.filter(skill => normalizedScores[skill] >= 70);
    const secondarySkills = sortedSkills.filter(skill => normalizedScores[skill] >= topScore - 10 && !topSkills.includes(skill));
    let dominantSkills = [...new Set([...topSkills, ...secondarySkills])];
    if (dominantSkills.length < 2 && sortedSkills.length >= 2) {
      dominantSkills = [sortedSkills[0], sortedSkills[1]];
    }
    return dominantSkills.slice(0, 3);
};

const determinePersona = (topSkills: (keyof Scores)[]): string => {
    for (const mapping of PERSONA_MAP) {
        if (mapping.skills.every(skill => topSkills.includes(skill))) {
            return mapping.persona;
        }
    }
    const skillCounts: { [key: string]: number } = {};
    PERSONA_MAP.forEach(p => {
        const matchCount = p.skills.filter(s => topSkills.includes(s)).length;
        if(matchCount > 0) {
            skillCounts[p.persona] = (skillCounts[p.persona] || 0) + matchCount;
        }
    });
    const bestMatch = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
    if (bestMatch.length > 0) return bestMatch[0][0];
    return 'Opportunity Synthesist'; // Fallback
};

const buildSystemInstruction = (): string => `You are "The Persuasion Imagineer"—a strategic advisor that converts a person's skills, interests, and constraints into realistic, high-leverage market opportunities. Your outputs must be specific, feasible, and action-oriented. You are confident, warm, conversational, and direct. You avoid vague pep-talks and hype.
OBJECTIVE: Given the user's data, produce a complete diagnostic report.
PROCESS:
1. Adopt Persona Tone: Generate the entire response in the voice of a trusted strategic advisor. Be clear, direct, and encouraging.
2. Analyze Strengths: Use the top strengths to frame the entire report.
3. Generate Opportunities: Create 3-5 opportunity plays that are a strong fit for the user's persona, strengths, chosen markets, workstyle, and constraints.
4. Apply Feasibility Filters:
- Age/Physical Realism: Do not suggest physically demanding roles for older age brackets or roles that contradict constraints. Propose adjacent, realistic roles (e.g., coach instead of player).
- Budget/Time: Favor low-friction, digital-first ideas for low budgets and limited time.
- Speed-to-Revenue: Ensure at least one opportunity is viable within 30 days.
- Authenticity: Opportunities must align with user's strengths and wildcards.
5. Structure Output: Generate the report according to the JSON schema provided.
You MUST return a single, valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations outside of the JSON object.`;

const buildUserContent = (formData: FormData, persona: string, topSkills: (keyof Scores)[], normalizedScores: { [key in keyof Scores]: number }): string => `USER DATA:
- Name: ${formData.name}
- Email: ${formData.email}
- Scores (0-100): ${JSON.stringify(normalizedScores)}
- Top 3 Strengths: ${topSkills.join(', ')}
- Chosen Persona: ${persona}
- Markets: ${formData.markets.join(', ') || 'Not specified'}
- Workstyle: ${formData.workstyle.join(', ') || 'Not specified'}
- Time per week: ${formData.time_per_week_hours} hours
- Budget: ${formData.budget_level}
- Age Bracket: ${formData.age_bracket}
- Wildcards (hobbies, interests, past careers): ${formData.wildcards || 'None'}
- Constraints: ${formData.constraints || 'None'}`;

const postToGoogleSheet = async (data: object) => {
    if (!GOOGLE_SHEET_ENDPOINT.includes('...')) {
        try {
            await fetch(GOOGLE_SHEET_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        } catch (error) { console.error("Error posting to Google Sheet:", error); }
    } else { console.warn("Google Sheet endpoint is a placeholder. Skipping POST."); }
};

const postToAweber = async (name: string, email: string) => {
    if (!AWEBER_ENDPOINT.includes('your.aweber.integration.url')) {
        try {
            await fetch(AWEBER_ENDPOINT, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name }) });
        } catch (error) { console.error("Error posting to AWeber:", error); }
    } else { console.warn("AWeber endpoint is a placeholder. Skipping POST."); }
};

const generateReport = async (formData: FormData): Promise<Report> => {
    let ai;
    try {
        if (typeof process === 'undefined' || !process.env.API_KEY) {
            throw new Error("API_KEY environment variable not found.");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI. Is the API_KEY environment variable set?", e);
        throw new Error("Configuration Error: The API key is missing. Please ensure it is configured in your environment variables.");
    }
    
    try {
        const normalizedScores = normalizeScores(formData.scores);
        const topSkills = identifyTopSkills(normalizedScores);
        const persona = determinePersona(topSkills);
        const systemInstruction = buildSystemInstruction();
        const userContent = buildUserContent(formData, persona, topSkills, normalizedScores);

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userContent,
          config: { systemInstruction, responseMimeType: "application/json", responseSchema: reportSchema }
        });

        const text = response.text;
        const reportData = JSON.parse(text);
        
        const snapshot = {
            name: formData.name, email: formData.email, persona: reportData.personaTitle,
            strengths: topSkills, markets: formData.markets, scores: normalizedScores, consent: formData.consent,
        };

        const finalReport = { ...reportData, jsonData: JSON.stringify(snapshot, null, 2) };

        if (formData.consent) {
            postToGoogleSheet(snapshot).catch(console.error);
            postToAweber(formData.name, formData.email).catch(console.error);
        }
        
        return finalReport;
    } catch (error) {
        console.error("Error generating report:", error);
        if (error instanceof Error && /API key not valid/i.test(error.message)) {
            throw new Error("The API key is invalid. Please check the value in your environment variables.");
        }
        throw new Error("Failed to generate your Renaissance Map. The AI may be experiencing high demand. Please try again later.");
    }
};

// --- From components/DiagnosticForm.tsx ---
interface DiagnosticFormProps {
  onSubmit: (formData: FormData) => void;
}

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="border-t border-gray-200 pt-6 mt-6">
    <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
    <div className="space-y-4">{children}</div>
  </div>
);

const DiagnosticForm: React.FC<DiagnosticFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleChange = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (formErrors[key as string]) {
      setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors[key as string]; return newErrors; });
    }
  };
  
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = 'Name is required.';
    if (!formData.email.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid.';
    if (!formData.consent) errors.consent = 'You must agree to the terms.';
    if(formData.workstyle.length === 0) errors.workstyle = 'Please select at least one workstyle.';
    if(formData.markets.length === 0) errors.markets = 'Please select at least one market.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateForm()) onSubmit(formData);
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
            <div className="flex items-center h-5"><input id="consent" name="consent" type="checkbox" checked={formData.consent} onChange={e => handleChange('consent', e.target.checked)} className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 ${formErrors.consent ? 'border-red-500' : 'border-gray-300'} rounded`} /></div>
            <div className="ml-3 text-sm"><label htmlFor="consent" className="font-medium text-gray-700">I agree to have my responses stored for research and follow-up.</label></div>
        </div>
        {formErrors.consent && <p className="text-red-500 text-xs mt-1">{formErrors.consent}</p>}
      </FormSection>
      <FormSection title="Core Skill Ratings">
        {SKILL_KEYS.map(key => <SliderInput key={key} label={SKILL_DEFINITIONS[key].label} prompt={SKILL_DEFINITIONS[key].prompt} value={formData.scores[key]} onChange={value => handleChange('scores', { ...formData.scores, [key]: value })} />)}
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

// --- From components/ReportDisplay.tsx ---
interface ReportDisplayProps {
  report: Report;
  onReset: () => void;
}

const ReportSection: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; }> = ({ title, icon, children }) => (
    <div className="py-6 border-b border-gray-200 last:border-b-0 report-section-content">
        <div className="flex items-center gap-3 mb-4">
            {icon}
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        </div>
        <div className="pl-10 space-y-4 text-gray-700">
            {children}
        </div>
    </div>
);

const ReportDisplay: React.FC<ReportDisplayProps> = ({ report, onReset }) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const [showJson, setShowJson] = useState(false);

    const copyToClipboard = useCallback(() => {
        if (!reportRef.current) return;
        const reportText = Array.from(reportRef.current.querySelectorAll('.report-section-content')).map((el: Element) => {
            const title = el.querySelector('h3')?.textContent || '';
            const content = Array.from(el.querySelectorAll('p, li')).map(item => item.textContent).join('\n');
            return `${title}\n${content}\n`;
        }).join('\n\n');
        navigator.clipboard.writeText(reportText).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        });
    }, []);

    const downloadAsPdf = useCallback(() => {
        const input = reportRef.current;
        if (!input || !window.jspdf || !window.html2canvas) return;
        const { jsPDF } = window.jspdf;
        const html2canvas = window.html2canvas;
        html2canvas(input, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
            const pageHeight = pdf.internal.pageSize.getHeight();
            const pageWidth = pdf.internal.pageSize.getWidth();
            const ratio = pageWidth / canvas.width;
            const totalPdfHeight = canvas.height * ratio;
            let heightLeft = totalPdfHeight;
            let position = 0;
            pdf.addImage(imgData, 'PNG', 0, position, pageWidth, totalPdfHeight);
            heightLeft -= pageHeight;
            while (heightLeft > 0) {
                position -= pageHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pageWidth, totalPdfHeight);
                heightLeft -= pageHeight;
            }
            pdf.save('Persuasion_Imagineering_Report.pdf');
        });
    }, []);

    return (
        <div className="p-6 sm:p-10">
            <div className="flex justify-between items-center mb-6">
                <button onClick={onReset} className="flex items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800">
                    <BackIcon className="h-5 w-5" /> Start Over
                </button>
                <div className="flex items-center gap-2">
                    <button onClick={copyToClipboard} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                        <CopyIcon className="h-4 w-4" /> {copyStatus === 'copied' ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={downloadAsPdf} className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2">
                        <DownloadIcon className="h-4 w-4" /> Download PDF
                    </button>
                </div>
            </div>
            <div ref={reportRef} className="report-container bg-white">
                <div className="text-center py-6 border-b border-gray-200 report-section-content">
                    <PersonaIcon className="h-16 w-16 mx-auto text-indigo-500 mb-4" />
                    <h2 className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">You Are:</h2>
                    <h1 className="text-4xl font-extrabold text-gray-900 mt-1">{report.personaTitle}</h1>
                    <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600">{report.identityParagraph}</p>
                </div>
                <ReportSection title="Your Edge (Top 3 Strength Zones)" icon={<EdgeIcon className="h-7 w-7 text-green-500" />}>
                    <ul className="list-none space-y-3">
                        {report.topStrengths.map((s, i) => <li key={i}><p className="font-semibold text-gray-800">{s.strength}</p><p className="text-gray-600">{s.reason}</p></li>)}
                    </ul>
                </ReportSection>
                <ReportSection title="Opportunity Map (3-5 ideas)" icon={<OpportunityIcon className="h-7 w-7 text-blue-500" />}>
                    <div className="space-y-8">
                        {report.opportunityMap.map((opp, i) => (
                            <div key={i} className="bg-gray-50 p-4 rounded-lg"><h4 className="font-bold text-lg text-gray-900">{opp.what}</h4>
                                <ul className="mt-3 space-y-2 text-sm">
                                    <li><strong>Why You Fit:</strong> {opp.whyFit}</li><li><strong>Audience:</strong> {opp.audience}</li>
                                    <li><strong>Offer:</strong> {opp.offer}</li><li><strong>Channel:</strong> {opp.channel}</li>
                                    <li><strong>Speed Plan:</strong> {opp.speedPlan}</li>
                                </ul>
                            </div>
                        ))}
                    </div>
                </ReportSection>
                <div className="grid md:grid-cols-2 gap-x-8">
                    <ReportSection title="Quick Wins (Next 7-14 days)" icon={<QuickWinsIcon className="h-7 w-7 text-yellow-500" />}><ul className="list-disc list-inside space-y-1">{report.quickWins.map((win, i) => <li key={i}>{win}</li>)}</ul></ReportSection>
                    <ReportSection title="30-Day Build Plan" icon={<BuildPlanIcon className="h-7 w-7 text-teal-500" />}><ul className="list-disc list-inside space-y-1">{report.buildPlan.map((step, i) => <li key={i}>{step}</li>)}</ul></ReportSection>
                    <ReportSection title="Guardrails (Not Worth Your Time)" icon={<GuardrailsIcon className="h-7 w-7 text-red-500" />}><ul className="list-disc list-inside space-y-1">{report.guardrails.map((g, i) => <li key={i}>{g}</li>)}</ul></ReportSection>
                    <ReportSection title="Tools to Explore" icon={<ToolsIcon className="h-7 w-7 text-purple-500" />}><p>{report.tools.join(' • ')}</p></ReportSection>
                </div>
                <ReportSection title="Starter Prompts" icon={<PromptsIcon className="h-7 w-7 text-orange-500" />}>
                    {report.starterPrompts.map((p, i) => (
                        <div key={i} className="bg-gray-800 text-white p-4 rounded-lg font-mono text-sm">
                            <h5 className="font-bold mb-2 text-gray-300">{p.title}</h5><p className="whitespace-pre-wrap">{p.prompt}</p>
                        </div>
                    ))}
                </ReportSection>
            </div>
            <div className="mt-6">
                <button onClick={() => setShowJson(!showJson)} className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800">
                    <JsonIcon className="h-5 w-5" />{showJson ? 'Hide' : 'Show'} Data Snapshot
                </button>
                {showJson && <pre className="mt-2 bg-gray-900 text-white p-4 rounded-lg text-xs overflow-x-auto"><code>{report.jsonData}</code></pre>}
            </div>
        </div>
    );
};

// --- From App.tsx ---
const App: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFormSubmit = useCallback(async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    try {
      const generatedReport = await generateReport(formData);
      setReport(generatedReport);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = () => {
    setReport(null);
    setError(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans text-gray-800">
      <header className="w-full max-w-4xl mx-auto text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-2">
            <LogoIcon className="h-10 w-10 text-indigo-600" />
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">Persuasion Imagineering</h1>
        </div>
        <p className="text-lg text-gray-600">Skill Stack Diagnostic</p>
      </header>
      <main className="w-full max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg transition-all duration-500">
          {isLoading ? (
            <div className="p-12 text-center">
              <SparklesIcon className="h-12 w-12 text-indigo-500 mx-auto animate-pulse" />
              <h2 className="mt-4 text-2xl font-semibold text-gray-700">Generating Your Renaissance Map...</h2>
              <p className="mt-2 text-gray-500">The Imagineer is analyzing your skills and crafting your opportunities. This may take a moment.</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <h2 className="text-2xl font-semibold text-red-600">An Error Occurred</h2>
              <p className="mt-2 text-gray-600">{error}</p>
              <button onClick={handleReset} className="mt-6 px-6 py-2 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">Try Again</button>
            </div>
          ) : report ? (
            <ReportDisplay report={report} onReset={handleReset} />
          ) : (
            <DiagnosticForm onSubmit={handleFormSubmit} />
          )}
        </div>
        <footer className="text-center mt-8 text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} Persuasion Imagineering. All Rights Reserved.</p>
        </footer>
      </main>
    </div>
  );
};

// --- From index.tsx (original) ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
