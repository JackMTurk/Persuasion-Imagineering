import React, { useState, useCallback, useRef, FormEvent, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Global Type Declarations ---
// FIX: Inlined the AIStudio interface within the global Window interface to resolve a TypeScript error about duplicate or conflicting declarations of 'aistudio'.
declare global {
    interface Window {
        jspdf: any;
        html2canvas: any;
        aistudio: {
          hasSelectedApiKey: () => Promise<boolean>;
          openSelectKey: () => Promise<void>;
        };
        process?: {
            env?: {
                API_KEY?: string;
            }
        }
    }
}

// --- Type Definitions ---
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

// --- Constants ---
const SKILL_DEFINITIONS: { [key in keyof Scores]: { label: string, prompt: string } } = {
  communication: { label: "Communication", prompt: "How skilled are you at expressing ideas through words or speech (writing, teaching, persuading, presenting)?" },
  creative: { label: "Creative Expression", prompt: "How confident are you in producing or shaping creative media—video, design, voice, humor, performance?" },
  strategy: { label: "Strategic Thinking", prompt: "How well do you connect dots, design offers, plan campaigns, or architect marketing systems?" },
  technical: { label: "Technical Fluency", prompt: "How comfortable are you with digital tools—AI apps, automation, analytics, or basic coding?" },
  eq: { label: "Emotional Intelligence", prompt: "How strong are you at reading people, resolving conflict, inspiring, or leading through empathy?" },
  learning: { label: "Learning Agility / Curiosity", prompt: "How quickly do you learn new ideas, explore trends, and synthesize knowledge?" },
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
  name: '', email: '', consent: false,
  scores: { communication: 5, creative: 5, strategy: 5, technical: 5, eq: 5, learning: 5 },
  workstyle: [], time_per_week_hours: 10, budget_level: 'low', age_bracket: '30-44', markets: [],
  wildcards: '', constraints: '',
};

const PERSONA_MAP: { persona: string, skills: (keyof Scores)[] }[] = [
  { persona: 'Narrative Architect', skills: ['communication', 'strategy'] }, { persona: 'System Builder', skills: ['technical', 'strategy'] },
  { persona: 'Creator-Educator', skills: ['communication', 'creative'] }, { persona: 'Opportunity Synthesist', skills: ['learning', 'strategy'] },
  { persona: 'Empathic Facilitator', skills: ['eq', 'communication'] }, { persona: 'Visual Storysmith', skills: ['creative', 'communication'] },
  { persona: 'Operator-Automator', skills: ['technical', 'communication'] }, { persona: 'Community Catalyst', skills: ['eq', 'strategy', 'communication'] },
];

const GOOGLE_SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycbwGfWfFzCqH7I4T5b5lXoIq9kPzY_8Uo7oGjR6tC8jHjV-9sQ8wXyZ/exec";
const AWEBER_ENDPOINT = "https://hook.us1.make.com/k71oy4mebyi2rhjukfe246y5nlcui6in";

// --- Icon Components ---
const LogoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1-H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" /></svg>
);
const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.562L16.25 22.5l-.648-1.938a2.25 2.25 0 01-1.463-1.463L12 18.75l1.938-.648a2.25 2.25 0 011.463-1.463L16.25 15l.648 1.938a2.25 2.25 0 011.463 1.463L19.5 18.75l-1.938.648a2.25 2.25 0 01-1.463 1.463z" /></svg>
);
const PersonaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
);
const EdgeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
);
const OpportunityIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
);
const QuickWinsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a17.918 17.918 0 00-1.3-1.61 17.92 17.92 0 00-4.54-1.61m0 0a17.92 17.92 0 00-4.54 1.61 17.918 17.918 0 00-1.3 1.61m11.68 0a17.92 17.92 0 00-5.84 0m5.84 0a18.006 18.006 0 00-11.68 0" /></svg>
);
const BuildPlanIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0h18M12 11.25h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" /></svg>
);
const GuardrailsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
);
const ToolsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.664 1.206-.861a7.5 7.5 0 10-9.28 9.28c.197-.466.477-.89.861-1.206l3.03-2.496z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 9.75L2.25 6m0 0L6 2.25M2.25 6h19.5" /></svg>
);
const PromptsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
);
const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375V9.375a2.25 2.25 0 00-2.25-2.25H1.5A2.25 2.25 0 00-.75 9.375v10.125c0 1.243 1.007 2.25 2.25 2.25h10.5a2.25 2.25 0 002.25-2.25z" /></svg>
);
const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
);
const JsonIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" /></svg>
);
const BackIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
);

// --- UI Components ---
const SliderInput: React.FC<{ label: string; prompt: string; value: number; onChange: (value: number) => void; }> = ({ label, prompt, value, onChange }) => {
  const getBackgroundColor = (value: number) => `linear-gradient(to right, #4f46e5 ${value * 10}%, #e5e7eb ${value * 10}%)`;
  return (
    <div className="py-4">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      <p className="text-sm text-gray-500 mt-1 mb-3">{prompt}</p>
      <div className="flex items-center gap-4">
        <input type="range" min="0" max="10" value={value} onChange={(e) => onChange(parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb" style={{ background: getBackgroundColor(value) }} />
        <span className="font-semibold text-indigo-600 w-8 text-center bg-indigo-50 rounded-md py-1">{value}</span>
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-1"><span>Novice</span><span>World-Class Pro</span></div>
      <style>{`.slider-thumb::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;background:#fff;border:2px solid #4f46e5;border-radius:50%;cursor:pointer;}.slider-thumb::-moz-range-thumb{width:20px;height:20px;background:#fff;border:2px solid #4f46e5;border-radius:50%;cursor:pointer;}`}</style>
    </div>
  );
};

const MultiSelect = <T extends string>({ label, prompt, options, selectedOptions, onChange, maxSelection }: { label: string; prompt: string; options: T[]; selectedOptions: T[]; onChange: (selected: T[]) => void; maxSelection?: number; }) => {
  const handleSelect = (option: T) => {
    let newSelected: T[] = selectedOptions.includes(option) ? selectedOptions.filter(item => item !== option) : (maxSelection && selectedOptions.length >= maxSelection) ? selectedOptions : [...selectedOptions, option];
    if (newSelected !== selectedOptions) onChange(newSelected);
  };
  return (
    <div className="py-4">
      <label className="block text-sm font-medium text-gray-800">{label}</label>
      <p className="text-sm text-gray-500 mt-1 mb-3">{prompt}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <button key={option} type="button" onClick={() => handleSelect(option)} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${selectedOptions.includes(option) ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};

const RadioGroup = <T extends string>({ label, prompt, options, selectedValue, onChange }: { label: string; prompt: string; options: { value: T; label: string; }[]; selectedValue: T; onChange: (value: T) => void; }) => (
  <div className="py-4">
    <label className="block text-sm font-medium text-gray-800">{label}</label>
    <p className="text-sm text-gray-500 mt-1 mb-3">{prompt}</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {options.map(option => (
        <label key={option.value} className={`relative flex items-center justify-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${selectedValue === option.value ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500' : 'bg-white border-gray-300 hover:border-gray-400'}`}>
          <input type="radio" name={label} value={option.value} checked={selectedValue === option.value} onChange={() => onChange(option.value)} className="sr-only" />
          <span className="text-sm font-medium text-gray-800">{option.label}</span>
        </label>
      ))}
    </div>
  </div>
);

const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="border-t border-gray-200 pt-6 mt-6"><h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3><div className="space-y-4">{children}</div></div>
);

// --- Gemini Service ---
const reportSchema = {
  type: Type.OBJECT,
  properties: {
    personaTitle: { type: Type.STRING }, identityParagraph: { type: Type.STRING },
    topStrengths: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { strength: { type: Type.STRING }, reason: { type: Type.STRING } }, required: ['strength', 'reason'] } },
    opportunityMap: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { what: { type: Type.STRING }, whyFit: { type: Type.STRING }, audience: { type: Type.STRING }, offer: { type: Type.STRING }, channel: { type: Type.STRING }, speedPlan: { type: Type.STRING } }, required: ['what', 'whyFit', 'audience', 'offer', 'channel', 'speedPlan'] } },
    quickWins: { type: Type.ARRAY, items: { type: Type.STRING } }, buildPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
    guardrails: { type: Type.ARRAY, items: { type: Type.STRING } }, tools: { type: Type.ARRAY, items: { type: Type.STRING } },
    starterPrompts: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, prompt: { type: Type.STRING } }, required: ['title', 'prompt'] } },
  },
  required: ['personaTitle', 'identityParagraph', 'topStrengths', 'opportunityMap', 'quickWins', 'buildPlan', 'guardrails', 'tools', 'starterPrompts'],
};

const normalizeScores = (scores: Scores): { [key in keyof Scores]: number } => SKILL_KEYS.reduce((acc, key) => ({ ...acc, [key]: scores[key] * 10 }), {} as { [key in keyof Scores]: number });

const identifyTopSkills = (normalizedScores: { [key in keyof Scores]: number }): (keyof Scores)[] => {
    const sortedSkills = (Object.keys(normalizedScores) as (keyof Scores)[]).sort((a, b) => normalizedScores[b] - normalizedScores[a]);
    const topScore = normalizedScores[sortedSkills[0]];
    const topSkills = sortedSkills.filter(skill => normalizedScores[skill] >= 70);
    const secondarySkills = sortedSkills.filter(skill => normalizedScores[skill] >= topScore - 10 && !topSkills.includes(skill));
    let dominantSkills = [...new Set([...topSkills, ...secondarySkills])];
    if (dominantSkills.length < 2 && sortedSkills.length >= 2) dominantSkills = [sortedSkills[0], sortedSkills[1]];
    return dominantSkills.slice(0, 3);
};

const determinePersona = (topSkills: (keyof Scores)[]): string => {
    for (const mapping of PERSONA_MAP) if (mapping.skills.every(skill => topSkills.includes(skill))) return mapping.persona;
    const skillCounts = PERSONA_MAP.reduce((acc, p) => { const matchCount = p.skills.filter(s => topSkills.includes(s)).length; if(matchCount > 0) acc[p.persona] = (acc[p.persona] || 0) + matchCount; return acc; }, {} as { [key: string]: number });
    const bestMatch = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
    return bestMatch.length > 0 ? bestMatch[0][0] : 'Opportunity Synthesist';
};

const buildSystemInstruction = (): string => `You are "The Persuasion Imagineer"—a strategic advisor that converts a person's skills, interests, and constraints into realistic, high-leverage market opportunities. Your outputs must be specific, feasible, and action-oriented. You are confident, warm, conversational, and direct. You avoid vague pep-talks and hype.
OBJECTIVE: Given the user's data, produce a complete diagnostic report.
PROCESS:
1. Adopt Persona Tone: Generate the entire response in the voice of a trusted strategic advisor.
2. Analyze Strengths: Use the top strengths to frame the entire report.
3. Generate Opportunities: Create 3-5 opportunity plays that are a strong fit for the user's persona, strengths, chosen markets, workstyle, and constraints.
4. Apply Feasibility Filters: Consider Age, Budget, Time, and Authenticity to ensure suggestions are realistic.
5. Structure Output: Generate the report according to the JSON schema provided.
You MUST return a single, valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations outside of the JSON object.`;

const buildUserContent = (formData: FormData, persona: string, topSkills: (keyof Scores)[], normalizedScores: { [key in keyof Scores]: number }): string => `USER DATA:
- Name: ${formData.name}, Email: ${formData.email}
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

const postToEndpoint = async (url: string, data: object) => {
    if (!url.includes('...')) {
        try { await fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
        catch (error) { console.error(`Error posting to ${url}:`, error); }
    } else { console.warn(`Endpoint ${url} is a placeholder. Skipping POST.`); }
};

const generateReport = async (formData: FormData): Promise<Report> => {
    const normalizedScores = normalizeScores(formData.scores);
    const topSkills = identifyTopSkills(normalizedScores);
    const persona = determinePersona(topSkills);
    const systemInstruction = buildSystemInstruction();
    const userContent = buildUserContent(formData, persona, topSkills, normalizedScores);

    const apiResponse = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            formData: formData,
            schema: reportSchema,
            systemInstruction: systemInstruction,
            userContent: userContent,
        })
    });

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({ error: 'Failed to parse error response from server.' }));
        // Directly throw the detailed error message from the server.
        throw new Error(errorData.error || `Request failed with status ${apiResponse.status}`);
    }

    const reportData = await apiResponse.json();
    
    const snapshot = {
        name: formData.name, email: formData.email, persona: reportData.personaTitle,
        strengths: topSkills, markets: formData.markets, scores: normalizedScores, consent: formData.consent,
    };

    const finalReport = { ...reportData, jsonData: JSON.stringify(snapshot, null, 2) };

    if (formData.consent) {
        postToEndpoint(GOOGLE_SHEET_ENDPOINT, snapshot);
        postToEndpoint(AWEBER_ENDPOINT, { email: formData.email, name: formData.name });
    }
    
    return finalReport;
};

// --- Form Component ---
const DiagnosticForm: React.FC<{ onSubmit: (formData: FormData) => void; }> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});

  const handleChange = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }));
    if (formErrors[key as string]) setFormErrors(prev => { const newErrors = { ...prev }; delete newErrors[key as string]; return newErrors; });
  };
  
  const validateForm = (): boolean => {
    const errors: { [key: string]: string } = {};
    if (!formData.name.trim()) errors.name = 'Name is required.';
    if (!formData.email.trim()) errors.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email is invalid.';
    if (!formData.consent) errors.consent = 'You must agree to the terms.';
    if (formData.workstyle.length === 0) errors.workstyle = 'Please select at least one workstyle.';
    if (formData.markets.length === 0) errors.markets = 'Please select at least one market.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); if (validateForm()) onSubmit(formData); };
  
  return (
    <form onSubmit={handleSubmit} className="p-6 sm:p-10" noValidate>
      <div className="text-center mb-8"><h2 className="text-2xl font-bold text-gray-900">Discover Your AI-Era Persona</h2><p className="mt-2 text-gray-600">Turn your scattered skills into a clear plan for value creation. Rate yourself honestly—your edge, not your ego.</p></div>
      <FormSection title="Basic Info">
        <div><label htmlFor="name" className="block text-sm font-medium text-gray-800">Name</label><input type="text" id="name" value={formData.name} onChange={e => handleChange('name', e.target.value)} className={`mt-1 block w-full px-3 py-2 border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900`} required />{formErrors.name && <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>}</div>
        <div><label htmlFor="email" className="block text-sm font-medium text-gray-800">Email</label><input type="email" id="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} className={`mt-1 block w-full px-3 py-2 border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900`} required />{formErrors.email && <p className="text-red-500 text-xs mt-1">{formErrors.email}</p>}</div>
      </FormSection>
      <FormSection title="Skill Assessment">
        {SKILL_KEYS.map(key => (
            <SliderInput key={key} label={SKILL_DEFINITIONS[key].label} prompt={SKILL_DEFINITIONS[key].prompt} value={formData.scores[key]} onChange={value => handleChange('scores', { ...formData.scores, [key]: value })} />
        ))}
      </FormSection>
      <FormSection title="Your Context">
        <MultiSelect label="Preferred Workstyle" prompt="How do you prefer to create value? Select up to 3." options={WORKSTYLE_OPTIONS} selectedOptions={formData.workstyle} onChange={value => handleChange('workstyle', value)} maxSelection={3} />
        {formErrors.workstyle && <p className="text-red-500 text-xs -mt-2 mb-2">{formErrors.workstyle}</p>}
        <div>
          <label htmlFor="time_per_week_hours" className="block text-sm font-medium text-gray-800">Time Commitment</label>
          <p className="text-sm text-gray-500 mt-1 mb-3">How many hours per week can you realistically dedicate?</p>
          <div className="flex items-center gap-4">
            <input type="range" min="1" max="40" step="1" id="time_per_week_hours" value={formData.time_per_week_hours} onChange={e => handleChange('time_per_week_hours', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb" style={{ background: `linear-gradient(to right, #4f46e5 ${((formData.time_per_week_hours - 1) / 39) * 100}%, #e5e7eb ${((formData.time_per_week_hours - 1) / 39) * 100}%)` }} />
            <span className="font-semibold text-indigo-600 w-16 text-center bg-indigo-50 rounded-md py-1">{formData.time_per_week_hours} hrs</span>
          </div>
        </div>
        <RadioGroup label="Budget Level" prompt="What's your monthly budget for tools, ads, or other expenses?" options={BUDGET_OPTIONS} selectedValue={formData.budget_level} onChange={value => handleChange('budget_level', value)} />
        <div>
          <label className="block text-sm font-medium text-gray-800">Age Bracket</label>
          <p className="text-sm text-gray-500 mt-1 mb-3">Which age range do you fall into?</p>
          <div className="flex flex-wrap gap-2">
            {AGE_BRACKET_OPTIONS.map(option => (
              <button key={option} type="button" onClick={() => handleChange('age_bracket', option)} className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ${formData.age_bracket === option ? 'bg-indigo-600 text-white ring-2 ring-offset-2 ring-indigo-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>{option}</button>
            ))}
          </div>
        </div>
        <MultiSelect label="Target Markets" prompt="Who do you want to serve? Select all that apply." options={MARKET_OPTIONS} selectedOptions={formData.markets} onChange={value => handleChange('markets', value)} />
        {formErrors.markets && <p className="text-red-500 text-xs -mt-2 mb-2">{formErrors.markets}</p>}
        <div>
          <label htmlFor="wildcards" className="block text-sm font-medium text-gray-800">Wildcards</label>
          <p className="text-sm text-gray-500 mt-1 mb-3">List any unique skills, hobbies, or past experiences. (e.g., "former chef," "speak Japanese," "poker champion")</p>
          <textarea id="wildcards" value={formData.wildcards} onChange={e => handleChange('wildcards', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" rows={3} placeholder="e.g., neuroscience background, stand-up comedy, blockchain expert..." />
        </div>
        <div>
          <label htmlFor="constraints" className="block text-sm font-medium text-gray-800">Constraints & Guardrails</label>
          <p className="text-sm text-gray-500 mt-1 mb-3">What do you want to avoid? (e.g., "no cold calling," "no complex software," "must be remote-friendly")</p>
          <textarea id="constraints" value={formData.constraints} onChange={e => handleChange('constraints', e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900" rows={3} placeholder="e.g., no social media dancing, prefer async work, avoid healthcare topics..." />
        </div>
      </FormSection>
      <FormSection title="Consent & Submission">
        <div className="flex items-start">
          <div className="flex items-center h-5"><input id="consent" name="consent" type="checkbox" checked={formData.consent} onChange={e => handleChange('consent', e.target.checked)} className={`focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded ${formErrors.consent ? 'border-red-500' : ''}`} /></div>
          <div className="ml-3 text-sm">
            <label htmlFor="consent" className="font-medium text-gray-800">Agree to Terms</label>
            <p className="text-gray-500">By checking this, you agree to receive emails and have your (anonymized) data used for research.</p>
            {formErrors.consent && <p className="text-red-500 text-xs mt-1">{formErrors.consent}</p>}
          </div>
        </div>
      </FormSection>
      <div className="mt-8 text-center">
        <button type="submit" className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-gray-400">
          <SparklesIcon className="w-5 h-5 mr-2 -ml-1" /> Generate My Report
        </button>
      </div>
    </form>
  );
};

// --- Report Display Component ---
const ReportDisplay: React.FC<{ report: Report; onBack: () => void; }> = ({ report, onBack }) => {
  const reportRef = useRef<HTMLDivElement>(null);
  const [showJson, setShowJson] = useState(false);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  const handleDownloadPdf = () => {
    if (!reportRef.current || !window.html2canvas || !window.jspdf) {
      alert("PDF generation library is not available.");
      return;
    }
    const reportElement = reportRef.current;
    
    const originalWidth = reportElement.style.width;
    reportElement.style.width = '1024px';

    window.html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: true,
        onclone: (document) => {
            const clonedReport = document.querySelector('.report-content');
            if(clonedReport) {
              (clonedReport as HTMLElement).style.width = '1024px';
            }
        }
    }).then((canvas) => {
      reportElement.style.width = originalWidth;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgProps= pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }
      pdf.save(`${report.personaTitle.replace(/\s+/g, '-')}-Report.pdf`);
    }).catch(err => {
      console.error("PDF Generation failed:", err);
      alert("Sorry, there was an error generating the PDF.");
      reportElement.style.width = originalWidth;
    });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: false })), 2000);
  };

  const ReportSection: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <section className="mb-8 p-6 bg-white rounded-xl shadow-sm break-inside-avoid">
      <div className="flex items-center mb-4">
        <div className="bg-indigo-100 text-indigo-600 rounded-full p-2 mr-4">{icon}</div>
        <h3 className="text-xl font-bold text-gray-900">{title}</h3>
      </div>
      <div className="prose prose-indigo max-w-none">{children}</div>
    </section>
  );

  return (
    <div className="p-4 sm:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={onBack} className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">
            <BackIcon className="w-5 h-5 mr-2" /> Back to Form
          </button>
          <div className="flex gap-2">
            <button onClick={() => setShowJson(prev => !prev)} className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <JsonIcon className="w-5 h-5 mr-2" /> {showJson ? 'Hide' : 'Show'} JSON
            </button>
            <button onClick={handleDownloadPdf} className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                <DownloadIcon className="w-5 h-5 mr-2" /> Download PDF
            </button>
          </div>
        </div>
        
        {showJson && (
            <div className="mb-6 relative bg-gray-800 text-white p-4 rounded-lg text-sm font-mono overflow-x-auto">
                <button onClick={() => copyToClipboard(report.jsonData, 'json')} className="absolute top-2 right-2 text-gray-300 hover:text-white">
                    <CopyIcon className="w-5 h-5" />
                </button>
                <pre><code>{report.jsonData}</code></pre>
            </div>
        )}

        <div ref={reportRef} className="p-8 bg-white rounded-lg shadow-lg report-content">
          <header className="text-center pb-8 border-b border-gray-200 mb-8">
            <div className="inline-block bg-indigo-100 p-3 rounded-full mb-4">
              <SparklesIcon className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">{report.personaTitle}</h1>
            <h2 className="text-xl text-gray-500 mt-2">Your Persuasion Imagineering Report</h2>
          </header>

          <main>
            <ReportSection icon={<PersonaIcon className="w-6 h-6" />} title="Your AI-Era Identity">
              <p>{report.identityParagraph}</p>
            </ReportSection>

            <ReportSection icon={<EdgeIcon className="w-6 h-6" />} title="Your Persuasive Edge">
              <ul className="list-none p-0">
                {report.topStrengths.map((s, i) => (
                  <li key={i} className="mb-3"><strong>{s.strength}:</strong> {s.reason}</li>
                ))}
              </ul>
            </ReportSection>

            <ReportSection icon={<OpportunityIcon className="w-6 h-6" />} title="High-Leverage Opportunity Map">
              <div className="space-y-6">
                {report.opportunityMap.map((opp, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-lg bg-gray-50 break-inside-avoid">
                    <h4 className="font-bold text-lg text-indigo-700">{opp.what}</h4>
                    <p><strong>Fit:</strong> {opp.whyFit}</p>
                    <p><strong>Audience:</strong> {opp.audience}</p>
                    <p><strong>Offer:</strong> {opp.offer}</p>
                    <p><strong>Channel:</strong> {opp.channel}</p>
                    <p><strong>Speed Plan:</strong> {opp.speedPlan}</p>
                  </div>
                ))}
              </div>
            </ReportSection>

            <ReportSection icon={<QuickWinsIcon className="w-6 h-6" />} title="Quick Wins (This Week)">
              <ul className="list-disc pl-5 space-y-2">{report.quickWins.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </ReportSection>

            <ReportSection icon={<BuildPlanIcon className="w-6 h-6" />} title="90-Day Build Plan">
              <ul className="list-disc pl-5 space-y-2">{report.buildPlan.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </ReportSection>

            <ReportSection icon={<GuardrailsIcon className="w-6 h-6" />} title="Guardrails & Pitfalls">
               <ul className="list-disc pl-5 space-y-2">{report.guardrails.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </ReportSection>

            <ReportSection icon={<ToolsIcon className="w-6 h-6" />} title="Recommended Tech Stack">
              <ul className="list-disc pl-5 space-y-2">{report.tools.map((item, i) => <li key={i}>{item}</li>)}</ul>
            </ReportSection>

            <ReportSection icon={<PromptsIcon className="w-6 h-6" />} title="Starter Prompts">
              {report.starterPrompts.map((p, i) => (
                <div key={i} className="relative p-4 border border-gray-200 rounded-lg bg-gray-50 mb-4 break-inside-avoid">
                  <h4 className="font-semibold text-gray-800">{p.title}</h4>
                  <p className="text-sm text-gray-600 mt-1 font-mono whitespace-pre-wrap">{p.prompt}</p>
                   <button onClick={() => copyToClipboard(p.prompt, `prompt-${i}`)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md bg-white/50 backdrop-blur-sm transition">
                    {copiedStates[`prompt-${i}`] ? 'Copied!' : <CopyIcon className="w-5 h-5" />}
                  </button>
                </div>
              ))}
            </ReportSection>
          </main>
        </div>
      </div>
    </div>
  );
};

// --- App State Components ---
const PageLoader: React.FC<{ message: string }> = ({ message }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-4">
      <LogoIcon className="w-16 h-16 text-indigo-600 animate-pulse mb-4" />
      <h2 className="text-xl font-semibold text-gray-800">{message}</h2>
      <p className="text-gray-500 mt-2">Please wait a moment...</p>
    </div>
);

const ApiKeyScreen: React.FC<{ onSelectKey: () => void }> = ({ onSelectKey }) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
        <div className="max-w-md bg-white p-8 rounded-xl shadow-lg">
            <LogoIcon className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">Welcome!</h2>
            <p className="mt-2 text-gray-600">To generate your personalized report, this app needs access to the Gemini API. Please select an API key to continue.</p>
            <p className="mt-4 text-sm text-gray-500">
                You may need to have a Google Cloud project with the AI Platform API enabled.
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline ml-1">Learn more about billing.</a>
            </p>
            <button
                onClick={onSelectKey}
                className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
                Select API Key
            </button>
        </div>
    </div>
);

// --- Main App Component ---
const App: React.FC = () => {
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [checkingApiKey, setCheckingApiKey] = useState(true);

  useEffect(() => {
    const initialize = async () => {
        if (window.aistudio) {
            try {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                setApiKeyReady(hasKey);
            } catch (e) {
                console.error("Error checking AI Studio key:", e);
                setApiKeyReady(false);
            }
        } else {
            setApiKeyReady(true);
        }
        setCheckingApiKey(false);
    };
    initialize();
  }, []);

  const handleFormSubmit = async (formData: FormData) => {
    setIsLoading(true);
    setError(null);
    setReport(null);
    try {
      const result = await generateReport(formData);
      setReport(result);
      window.scrollTo(0, 0);
    } catch (err: any) {
      const detailedMessage = err.message || 'An unexpected error occurred.';
      setError(`Failed to generate your report. Please try again. (Details: ${detailedMessage})`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setError(null);
    setIsLoading(false);
    window.scrollTo(0, 0);
  };
  
  const handleSelectKey = async () => {
    if (window.aistudio) {
        try {
            await window.aistudio.openSelectKey();
            setApiKeyReady(true); 
            setCheckingApiKey(false);
        } catch(e) {
            console.error("Failed to open select key dialog", e);
        }
    }
  }

  if (checkingApiKey) {
    return <PageLoader message="Initializing application..." />;
  }
  
  if (!apiKeyReady) {
    return <ApiKeyScreen onSelectKey={handleSelectKey} />;
  }

  return (
    <div className="bg-gray-50 min-h-screen font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogoIcon className="h-8 w-8 text-indigo-600" />
            <h1 className="text-xl font-semibold text-gray-800">Persuasion Imagineering Diagnostic</h1>
          </div>
        </div>
      </header>
      <main className="py-8">
        <div className="max-w-4xl mx-auto px-4">
          {isLoading && (
            <div className="bg-white rounded-lg shadow-xl p-8 text-center">
              <SparklesIcon className="w-12 h-12 text-indigo-600 mx-auto animate-spin mb-4" />
              <h2 className="text-2xl font-bold text-gray-900">Imagineering your results...</h2>
              <p className="text-gray-600 mt-2">Analyzing your skills and mapping opportunities. This might take a moment.</p>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg shadow-md mb-6">
              <div className="flex">
                <div className="py-1"><svg className="h-6 w-6 text-red-500 mr-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg></div>
                <div>
                  <h3 className="font-bold text-red-800">Error Generating Report</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                   <button onClick={handleReset} className="mt-2 text-sm font-semibold text-red-800 hover:text-red-900">Try again</button>
                </div>
              </div>
            </div>
          )}
          
          <div className={`${report ? 'block' : 'hidden'}`}>
            {report && <ReportDisplay report={report} onBack={handleReset} />}
          </div>

          <div className={`${report || isLoading || error ? 'hidden' : 'block'}`}>
            <div className="bg-white rounded-lg shadow-xl overflow-hidden">
                <DiagnosticForm onSubmit={handleFormSubmit} />
            </div>
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} Persuasion Imagineering. All rights reserved.</p>
      </footer>
    </div>
  );
};

// --- Render App ---
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);