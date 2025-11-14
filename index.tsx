
// v1.0.1 - Forcing git update.
import React, { useState, useCallback, useRef, FormEvent, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { Type } from "@google/genai";

// --- Global Type Declarations ---
declare global {
    interface AIStudio {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    }
    interface Window {
        jspdf: any;
        html2canvas: any;
        aistudio?: AIStudio;
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
  topStrengths: { strength: string; reason:string }[];
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

const AWEBER_ENDPOINT = "https://hook.us1.make.com/k71oy4mebyi2rhjukfe246y5nlcui6in";

// --- Helper Functions ---
const getTopSkills = (scores: Scores, count = 2): (keyof Scores)[] => {
  return (Object.keys(scores) as (keyof Scores)[])
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, count);
};

const determinePersona = (scores: Scores): string => {
  const topTwoSkills = getTopSkills(scores, 2);
  const topThreeSkills = getTopSkills(scores, 3);

  // Check for 3-skill personas first
  const threeSkillPersona = PERSONA_MAP.find(p =>
    p.skills.length === 3 && p.skills.every(skill => topThreeSkills.includes(skill))
  );
  if (threeSkillPersona) return threeSkillPersona.persona;

  // Check for 2-skill personas
  const twoSkillPersona = PERSONA_MAP.find(p =>
    p.skills.length === 2 && p.skills.every(skill => topTwoSkills.includes(skill))
  );
  if (twoSkillPersona) return twoSkillPersona.persona;

  // Fallback persona
  return 'Integrated Imagineer';
};


// --- React Components ---

const SliderInput: React.FC<{ name: keyof Scores; label: string; value: number; onChange: (name: keyof Scores, value: number) => void; prompt: string }> = ({ name, label, value, onChange, prompt }) => (
  <div className="mb-6">
    <label htmlFor={name} className="block text-lg font-medium text-noir-text mb-2">{label}</label>
    <p className="text-sm text-noir-text-secondary italic mb-3">{prompt}</p>
    <input
      id={name}
      type="range"
      min="1"
      max="10"
      value={value}
      onChange={(e) => onChange(name, parseInt(e.target.value))}
      className="w-full h-2 bg-noir-border rounded-lg appearance-none cursor-pointer"
    />
    <div className="flex justify-between text-xs text-noir-text-secondary mt-1">
      <span>Less Confident</span>
      <span className="font-bold text-noir-green text-base">{value}</span>
      <span>More Confident</span>
    </div>
  </div>
);

const MultiSelect: React.FC<{ options: string[]; selected: string[]; onChange: (selected: string[]) => void; label: string; maxSelection?: number }> = ({ options, selected, onChange, label, maxSelection = 3 }) => {
  const handleSelect = (option: string) => {
    const newSelection = selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option];
    if (newSelection.length <= maxSelection) {
      onChange(newSelection);
    } else {
      alert(`You can select a maximum of ${maxSelection} options.`);
    }
  };

  return (
    <div className="mb-6">
      <label className="block text-lg font-medium text-noir-text mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(option => (
          <button
            key={option}
            type="button"
            onClick={() => handleSelect(option)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selected.includes(option)
                ? 'bg-noir-accent text-noir-paper shadow-md'
                : 'bg-noir-border text-noir-text hover:bg-opacity-80'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
       <p className="text-xs text-noir-text-secondary mt-2">Select up to {maxSelection}.</p>
    </div>
  );
};

const RadioGroup: React.FC<{ name: string; options: {value: string, label: string}[]; selected: string; onChange: (value: string) => void; label: string;}> = ({ name, options, selected, onChange, label }) => (
    <div className="mb-6">
        <label className="block text-lg font-medium text-noir-text mb-2">{label}</label>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
            {options.map(({ value, label: optionLabel }) => (
                <label key={value} className="flex items-center space-x-2 cursor-pointer">
                    <input
                        type="radio"
                        name={name}
                        value={value}
                        checked={selected === value}
                        onChange={(e) => onChange(e.target.value)}
                        className="h-4 w-4 text-noir-accent border-noir-border focus:ring-noir-accent"
                    />
                    <span className="text-noir-text">{optionLabel}</span>
                </label>
            ))}
        </div>
    </div>
);


const ReportDisplay: React.FC<{ report: Report; onBack: () => void; formData: FormData; persona: string }> = ({ report, onBack, formData, persona }) => {
    const reportRef = useRef<HTMLDivElement>(null);

    const downloadPdf = async () => {
        const { jsPDF } = window.jspdf;
        const reportElement = reportRef.current;
        if (!reportElement) return;

        try {
            const canvas = await window.html2canvas(reportElement, { scale: 2, backgroundColor: '#fefdf6' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight =canvas.height;
            const ratio = imgWidth / imgHeight;
            const height = pdfWidth / ratio;
            let position = 0;
            let remainingHeight = imgHeight * pdfWidth / imgWidth;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, height);
            remainingHeight -= pdfHeight;

            while (remainingHeight > 0) {
                position -= pdfHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, height);
                remainingHeight -= pdfHeight;
            }

            pdf.save(`Persuasion-Imagineering-Report-${formData.name}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Sorry, there was an error generating the PDF. Please try again.");
        }
    };


    return (
        <div className="bg-noir-bg min-h-screen p-4 sm:p-6 md:p-8">
          <div className="max-w-3xl mx-auto bg-noir-paper p-6 sm:p-8 md:p-12 rounded-lg shadow-2xl">
              <div ref={reportRef} className="report-content p-8">
                   <header className="text-center border-b-2 border-noir-border pb-6 mb-8">
                      <h1 className="font-heading text-4xl md:text-5xl text-noir-text">Your P.I. Manifesto & Plan</h1>
                      <p className="text-lg text-noir-text-secondary mt-2">Prepared for: {formData.name}</p>
                      <p className="font-heading text-2xl text-noir-green mt-4">Your Persona: {persona}</p>
                  </header>

                  <main>
                      <section className="mb-10">
                           <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-1.026.977-2.206.977-3.454a5.002 5.002 0 00-4.476-4.972M6.363 18.243A13.973 13.973 0 015 14.25a5.002 5.002 0 014.476-4.972M12 11v-1a4 4 0 00-4-4H6.363" /> </svg>
                              <span>Your P.I. Identity</span>
                           </h2>
                           <p className="text-noir-text-secondary leading-relaxed">{report.identityParagraph}</p>
                      </section>

                      <section className="mb-10">
                          <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L2.05 10.1c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /> </svg>
                              <span>Your Top Strengths</span>
                          </h2>
                          <ul className="space-y-4">
                              {report.topStrengths.map((item, index) => (
                                  <li key={index} className="p-4 bg-noir-accent bg-opacity-10 rounded-lg">
                                      <h3 className="font-bold text-noir-green">{item.strength}</h3>
                                      <p className="text-noir-text-secondary">{item.reason}</p>
                                  </li>
                              ))}
                          </ul>
                      </section>

                      <section className="mb-10">
                          <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-1.447-.894L15 7m-6 13l6-3m0 0V7" /> </svg>
                              <span>Your Opportunity Map</span>
                          </h2>
                          <div className="space-y-6">
                             {report.opportunityMap.map((opp, index) => (
                                  <div key={index} className="p-4 border border-noir-border rounded-lg shadow-sm">
                                      <h3 className="font-heading text-xl text-noir-green mb-2">{opp.what}</h3>
                                      <p className="mb-3"><strong className="font-medium text-noir-text">Why It's a Fit:</strong> <span className="text-noir-text-secondary">{opp.whyFit}</span></p>
                                      <p><strong className="font-medium text-noir-text">Audience:</strong> <span className="text-noir-text-secondary">{opp.audience}</span></p>
                                      <p><strong className="font-medium text-noir-text">Offer:</strong> <span className="text-noir-text-secondary">{opp.offer}</span></p>
                                      <p><strong className="font-medium text-noir-text">Channel:</strong> <span className="text-noir-text-secondary">{opp.channel}</span></p>
                                      <div className="mt-4 p-3 bg-noir-green bg-opacity-10 rounded">
                                          <h4 className="font-bold text-noir-green">30-Day Speed Plan:</h4>
                                          <p className="text-noir-text-secondary">{opp.speedPlan}</p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </section>
                      <div className="flex flex-col gap-8">
                        <section>
                            <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /> </svg>
                                <span>7-Day Action Sprint</span>
                            </h2>
                            <ul className="list-disc list-inside space-y-2 text-noir-text-secondary">
                                {report.quickWins.map((win, index) => <li key={index}>{win}</li>)}
                            </ul>
                        </section>
                        <section>
                            <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /> </svg>
                                <span>90 Day Relentless Execution Plan</span>
                            </h2>
                            <ul className="list-disc list-inside space-y-2 text-noir-text-secondary">
                                {report.buildPlan.map((item, index) => <li key={index}>{item}</li>)}
                            </ul>
                        </section>
                      </div>

                       <section className="mb-10 mt-10">
                          <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 20.944a11.955 11.955 0 019-4.527 11.955 11.955 0 019 4.527 12.02 12.02 0 00-2.382-8.984z" /> </svg>
                             <span>Guardrails & Watchouts</span>
                          </h2>
                          <ul className="list-disc list-inside space-y-2 text-noir-text-secondary bg-noir-accent bg-opacity-10 p-4 rounded-lg">
                             {report.guardrails.map((item, index) => <li key={index}>{item}</li>)}
                          </ul>
                      </section>

                       <section className="mb-10">
                          <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /> <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> </svg>
                              <span>Your P.I. Toolkit</span>
                           </h2>
                           <ul className="list-disc list-inside space-y-2 text-noir-text-secondary">
                              {report.tools.map((item, index) => <li key={index}>{item}</li>)}
                          </ul>
                      </section>
                      
                      <section>
                          <h2 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-4 flex items-center gap-3">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-noir-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}> <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /> </svg>
                              <span>Starter Prompts for Gemini</span>
                          </h2>
                          <div className="space-y-4">
                           {report.starterPrompts.map((p, index) => (
                              <div key={index} className="p-4 bg-noir-border bg-opacity-50 rounded-lg">
                                 <h3 className="font-bold text-noir-text">{p.title}</h3>
                                 <p className="text-noir-text-secondary font-mono text-sm mt-2 p-3 bg-noir-bg rounded">{p.prompt}</p>
                             </div>
                           ))}
                          </div>
                      </section>
                  </main>
              </div>
              <div className="mt-8 text-center flex gap-4 justify-center">
                   <button onClick={onBack} className="bg-noir-text-secondary hover:bg-opacity-80 text-noir-paper font-bold py-3 px-6 rounded-lg transition-colors shadow-md">
                      Back to Form
                  </button>
                  <button onClick={downloadPdf} className="bg-noir-accent hover:bg-noir-accent-hover text-noir-paper font-bold py-3 px-6 rounded-lg transition-colors shadow-md">
                      Download as PDF
                  </button>
              </div>
          </div>
        </div>
    );
};


const App: React.FC = () => {
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
    const [report, setReport] = useState<Report | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [persona, setPersona] = useState<string>('');

    const handleScoreChange = useCallback((name: keyof Scores, value: number) => {
        setFormData(prev => ({ ...prev, scores: { ...prev.scores, [name]: value } }));
    }, []);

    const handleMultiSelectChange = useCallback((field: 'workstyle' | 'markets') => (selected: string[]) => {
        setFormData(prev => ({...prev, [field]: selected}));
    }, []);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }, []);

     const handleRadioChange = useCallback((field: keyof FormData) => (value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: parseInt(value)}));
    }, []);

    const generateJsonSchema = () => ({
        type: Type.OBJECT,
        properties: {
            personaTitle: { type: Type.STRING, description: "A creative, 2-3 word title for the user's Persuasion Imagineering persona based on their skills and preferences." },
            identityParagraph: { type: Type.STRING, description: "A 3-4 sentence paragraph describing the user's core identity as a Persuasion Imagineer, written in an encouraging and insightful tone." },
            topStrengths: {
                type: Type.ARRAY,
                description: "The user's top 2-3 strengths, derived from their highest scores.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        strength: { type: Type.STRING, description: "Name of the strength (e.g., 'Strategic Communication')." },
                        reason: { type: Type.STRING, description: "A brief explanation of why this is a strength for them and how it applies." }
                    },
                    required: ["strength", "reason"]
                }
            },
            opportunityMap: {
                type: Type.ARRAY,
                description: "Three distinct, actionable business or project opportunities tailored to the user's persona and inputs.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        what: { type: Type.STRING, description: "A concise name for the opportunity (e.g., 'B2B SaaS Content Strategist')." },
                        whyFit: { type: Type.STRING, description: "Explanation of why this opportunity is a great fit for their specific skill stack and workstyle." },
                        audience: { type: Type.STRING, description: "The specific target audience for this opportunity." },
                        offer: { type: Type.STRING, description: "A compelling core offer or service they could provide." },
                        channel: { type: Type.STRING, description: "The primary marketing or distribution channel to focus on." },
                        speedPlan: { type: Type.STRING, description: "A concrete 30-day action plan to get started." }
                    },
                    required: ["what", "whyFit", "audience", "offer", "channel", "speedPlan"]
                }
            },
            quickWins: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-5 immediate, easy-to-implement actions the user can take this week." },
            buildPlan: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3-5 strategic actions for the next 90 days to build momentum." },
            guardrails: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 3 potential pitfalls or things to avoid based on their profile." },
            tools: { type: Type.ARRAY, items: { type: Type.STRING }, description: "A list of 5-7 recommended tools (software, platforms) that align with their opportunities." },
            starterPrompts: {
                type: Type.ARRAY,
                description: "Two creative, detailed prompts they can use with an AI like Gemini to brainstorm ideas for their top opportunity.",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        title: { type: Type.STRING, description: "A short, descriptive title for the prompt's purpose." },
                        prompt: { type: Type.STRING, description: "The full text of the starter prompt." }
                    },
                     required: ["title", "prompt"]
                }
            },
            jsonData: { type: Type.STRING, description: "The original form submission data as a JSON string." }
        },
        required: ["personaTitle", "identityParagraph", "topStrengths", "opportunityMap", "quickWins", "buildPlan", "guardrails", "tools", "starterPrompts", "jsonData"]
    });


    const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        
        const currentPersona = determinePersona(formData.scores);
        setPersona(currentPersona);

        const formDataWithPersona = {
            ...formData,
            persona: currentPersona,
            jsonData: JSON.stringify(formData, null, 2)
        };

        const systemInstruction = `You are "Jack Turk, P.I. (Persuasion Imagineer)," an AI business strategist. Your voice is a blend of a 1940s noir detective and a modern, savvy marketing expert—think Humphrey Bogart meets Seth Godin. You are gritty, insightful, and speak in a slightly stylized, hard-boiled manner, but you're genuinely here to help the user crack the code on their next big move. You call opportunities "gigs," problems "cases," and skills your "tool kit." Your goal is to analyze the user's "dossier" (their form inputs) and deliver a personalized, actionable "briefing" (the report). You must strictly adhere to the provided JSON schema for your response.`;

        const userContent = `Here's the dossier on the new client, gumshoe. Lay out the full briefing.

        **Client Dossier:**
        - **Name:** ${formData.name}
        - **Identified Persona:** ${currentPersona}
        - **Skill Scores:**
          - Communication: ${formData.scores.communication}/10
          - Creative: ${formData.scores.creative}/10
          - Strategy: ${formData.scores.strategy}/10
          - Technical: ${formData.scores.technical}/10
          - Emotional Intelligence: ${formData.scores.eq}/10
          - Learning Agility: ${formData.scores.learning}/10
        - **Preferred Workstyles:** ${formData.workstyle.join(', ')}
        - **Time Commitment:** ${formData.time_per_week_hours} hours/week
        - **Budget Level:** ${formData.budget_level}
        - **Age Bracket:** ${formData.age_bracket}
        - **Target Markets:** ${formData.markets.join(', ')}
        - **Wildcard Skills/Interests:** ${formData.wildcards}
        - **Constraints/Fears:** ${formData.constraints}

        Now, give me the full rundown. No fluff, just the facts and a solid plan. Stick to the JSON format I gave you.`;

        try {
            const schema = generateJsonSchema();
            
            const apiResponse = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    formData: formDataWithPersona,
                    systemInstruction,
                    userContent,
                    schema
                }),
            });

            if (!apiResponse.ok) {
                const errorData = await apiResponse.json();
                throw new Error(errorData.error || `HTTP error! status: ${apiResponse.status}`);
            }

            const reportData = await apiResponse.json();
            
            // Also send data to AWeber/Make.com webhook
            fetch(AWEBER_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: formData.name, 
                    email: formData.email, 
                    persona: currentPersona,
                    report: reportData,
                })
            }).catch(err => console.error("Webhook Error:", err)); // Log webhook error but don't block user
            
            setReport(reportData);

        } catch (error: any) {
            console.error("Error generating report:", error);
            setError(`Failed to generate report. ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [formData]);


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-noir-bg p-4">
                <div className="font-heading text-3xl text-noir-text">Analyzing Your Dossier...</div>
                <div className="mt-4 text-noir-text-secondary animate-pulse">Checking the angles... dusting for prints...</div>
                 {/* Spinner SVG */}
                <svg className="animate-spin h-10 w-10 text-noir-accent mt-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        );
    }
    
    if (error) {
        return (
             <div className="flex flex-col items-center justify-center min-h-screen bg-noir-red bg-opacity-10 p-4 text-center">
                <h2 className="font-heading text-3xl text-noir-red">A Snag in the Case</h2>
                <p className="mt-4 text-noir-red max-w-md">{error}</p>
                 <button onClick={() => { setError(null); setIsLoading(false); }} className="mt-6 bg-noir-red hover:bg-opacity-80 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                    Try Again
                </button>
            </div>
        )
    }

    if (report) {
        return <ReportDisplay report={report} onBack={() => setReport(null)} formData={formData} persona={persona} />;
    }

    return (
        <div className="bg-noir-bg min-h-screen p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto bg-noir-paper p-6 sm:p-8 md:p-12 rounded-lg shadow-2xl">
                <header className="text-center border-b-2 border-noir-border pb-6 mb-8">
                    <p className="mb-4 text-lg text-noir-text-secondary max-w-3xl mx-auto text-left">For Copywriters, Creators, and Marketers Unsure How AI Is Reshaping Their Future…</p>
                    <h1 className="font-heading text-2xl md:text-3xl text-noir-text">Discover Your Persuasion Imagineer Persona — Your Personalized Manifesto & Step-By-Step Plan Revealing Exactly Where Your Talents Pay Off Most in the AI Age, What Opportunities to Pursue, and How to Profit From What You Already Do Best.</h1>
                    <p className="mt-4 text-lg text-noir-text-secondary max-w-3xl mx-auto">Get a Personal Roadmap That Uncovers Where Your Strengths Shine, Who’s Ready to Pay for Them, and How to Turn Your Best Skills Into Real Profit.</p>
                    <div className="my-8">
                        {/* 
                          INSTRUCTION: 
                          Host your image online (e.g., on Imgur, your own website, etc.) 
                          and paste the direct URL into the `src` attribute below, replacing the placeholder link.
                        */}
                        <img 
                          src="https://magamarketingsecrets.com/wp-content/uploads/2025/11/Hero1a.jpg" 
                          alt="Persuasion Imagineer detective in a futuristic noir office" 
                          className="w-full max-w-xl mx-auto rounded-lg shadow-lg" 
                        />
                    </div>
                    <div className="mt-6 text-left text-noir-text-secondary max-w-2xl mx-auto">
                      <p className="mb-4">The Persuasion Imagineering Manifesto & Plan isn’t a quiz or a personality test. It’s a focused look at what you already do well, where those strengths carry the most value, and the specific opportunities that fit you best. In just a couple of minutes, you’ll walk away with clear direction and a working plan you can act on right away, including:</p>
                      <ul className="list-none space-y-2">
                          <li className="flex items-start"><span className="text-noir-accent font-bold mr-2">▶</span><span>A custom Persona showing how your unique blend of strategic, creative, technical, and emotional skills connects to real business opportunities.</span></li>
                          <li className="flex items-start"><span className="text-noir-accent font-bold mr-2">▶</span><span>Clear directions for turning your strengths into specific offers, audiences, and revenue streams.</span></li>
                          <li className="flex items-start"><span className="text-noir-accent font-bold mr-2">▶</span><span>Tools and technologies to amplify your work and extend your creative reach — without dulling your voice.</span></li>
                          <li className="flex items-start"><span className="text-noir-accent font-bold mr-2">▶</span><span>Your 7-Day Action Sprint with simple, concrete steps to start building momentum right now.</span></li>
                          <li className="flex items-start"><span className="text-noir-accent font-bold mr-2">▶</span><span>Your 90 Day Relentless Execution Plan - turning insights into implementation.</span></li>
                      </ul>
                      <p className="mt-4 font-medium text-noir-text">Your Manifesto & Plan will show you where to focus, what to build, and how to make your mark in the most exciting creative era in history.</p>
                    </div>
                </header>

                <form onSubmit={handleSubmit}>
                    <section className="mb-10">
                        <h3 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-6">Skill Stack Rundown</h3>
                        {SKILL_KEYS.map(key => (
                            <SliderInput
                                key={key}
                                name={key}
                                label={SKILL_DEFINITIONS[key].label}
                                prompt={SKILL_DEFINITIONS[key].prompt}
                                value={formData.scores[key]}
                                onChange={handleScoreChange}
                            />
                        ))}
                    </section>

                    <section className="mb-10">
                        <h3 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-6">Lay Of The Land</h3>
                        
                        <MultiSelect
                          label="My Preferred Workstyle Is To... (select up to 3)"
                          options={WORKSTYLE_OPTIONS}
                          selected={formData.workstyle}
                          onChange={handleMultiSelectChange('workstyle')}
                        />
                        
                         <div className="mb-6">
                            <label htmlFor="time_per_week_hours" className="block text-lg font-medium text-noir-text mb-2">Weekly Time Commitment</label>
                            <p className="text-sm text-noir-text-secondary italic mb-3">How many hours per week can you realistically dedicate to a new project?</p>
                            <input
                              id="time_per_week_hours"
                              name="time_per_week_hours"
                              type="range"
                              min="1"
                              max="40"
                              step="1"
                              value={formData.time_per_week_hours}
                              onChange={handleSliderChange}
                              className="w-full h-2 bg-noir-border rounded-lg appearance-none cursor-pointer"
                            />
                            <div className="text-center font-bold text-noir-green text-base mt-2">{formData.time_per_week_hours} hours / week</div>
                        </div>

                        <RadioGroup
                            name="budget_level"
                            label="Monthly Budget for Tools/Ads"
                            options={BUDGET_OPTIONS}
                            selected={formData.budget_level}
                            onChange={handleRadioChange('budget_level')}
                        />

                         <RadioGroup
                            name="age_bracket"
                            label="Your Age Bracket"
                            options={AGE_BRACKET_OPTIONS.map(age => ({ value: age, label: age }))}
                            selected={formData.age_bracket}
                            onChange={handleRadioChange('age_bracket')}
                        />
                        
                        <MultiSelect
                            label="Which Markets Excite You Most? (select up to 3)"
                            options={MARKET_OPTIONS}
                            selected={formData.markets}
                            onChange={handleMultiSelectChange('markets')}
                        />

                        <div className="mb-6">
                          <label htmlFor="wildcards" className="block text-lg font-medium text-noir-text mb-2">Your Wildcard Skills & Interests</label>
                          <p className="text-sm text-noir-text-secondary italic mb-3">What are your secret weapons? (e.g., "Former improv comic," "Speak fluent Klingon," "Can bake a professional-grade sourdough," "Obsessed with 18th-century naval history," etc.)</p>
                          <textarea
                            id="wildcards"
                            name="wildcards"
                            rows={3}
                            value={formData.wildcards}
                            onChange={handleInputChange}
                            className="mt-1 block w-full rounded-md bg-transparent border-noir-border shadow-sm focus:border-noir-accent focus:ring-noir-accent sm:text-sm p-2"
                            placeholder="List any unique hobbies, skills, or passions here..."
                          ></textarea>
                        </div>
                        
                         <div className="mb-6">
                           <label htmlFor="constraints" className="block text-lg font-medium text-noir-text mb-2">Constraints, Fears, or Blockers</label>
                            <p className="text-sm text-noir-text-secondary italic mb-3">What's holding you back? Be honest. (e.g., "Fear of being on camera," "I hate cold-calling," "No existing audience," "Limited time due to family.")</p>
                           <textarea
                            id="constraints"
                            name="constraints"
                            rows={3}
                            value={formData.constraints}
                            onChange={handleInputChange}
                            className="mt-1 block w-full rounded-md bg-transparent border-noir-border shadow-sm focus:border-noir-accent focus:ring-noir-accent sm:text-sm p-2"
                            placeholder="What challenges or fears are on your mind?"
                          ></textarea>
                        </div>
                    </section>
                    
                     <section className="mb-6">
                        <h3 className="font-heading text-2xl text-noir-text border-b border-noir-border pb-2 mb-6">Final Authorization</h3>
                        <div className="mb-4">
                            <label htmlFor="name" className="block text-sm font-medium text-noir-text">Name</label>
                            <input
                                type="text"
                                name="name"
                                id="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md bg-transparent border-noir-border shadow-sm focus:border-noir-accent focus:ring-noir-accent sm:text-sm p-2"
                                required
                            />
                        </div>

                        <div className="mb-6">
                            <label htmlFor="email" className="block text-sm font-medium text-noir-text">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                id="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                className="mt-1 block w-full rounded-md bg-transparent border-noir-border shadow-sm focus:border-noir-accent focus:ring-noir-accent sm:text-sm p-2"
                                required
                            />
                        </div>
                         <div className="flex items-start">
                            <div className="flex h-5 items-center">
                                <input
                                    id="consent"
                                    name="consent"
                                    type="checkbox"
                                    checked={formData.consent}
                                    onChange={handleInputChange}
                                    className="h-4 w-4 rounded border-noir-border text-noir-accent focus:ring-noir-accent"
                                    required
                                 />
                            </div>
                            <div className="ml-3 text-sm">
                                <label htmlFor="consent" className="font-medium text-noir-text">Keep My Data Off the Record</label>
                                <p className="text-noir-text-secondary">Strictly confidential — NEVER shared — and used only to generate my Manifesto & Plan and send updates. I can unsubscribe anytime.</p>
                            </div>
                        </div>
                    </section>

                    <div className="mt-8 pt-6 border-t border-noir-border">
                        <button
                            type="submit"
                            className="w-full bg-noir-accent hover:bg-noir-accent-hover text-noir-paper font-bold py-4 px-4 rounded-lg text-xl transition-transform transform hover:scale-105 shadow-lg"
                            disabled={!formData.consent || !formData.name || !formData.email}
                        >
                           Show Me My P.I. Persona & Manifesto
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
