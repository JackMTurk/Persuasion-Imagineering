import { FormData, Scores, Workstyle, Budget, AgeBracket, Market } from './types.ts';

export const SKILL_DEFINITIONS: { [key in keyof Scores]: { label: string, prompt: string } } = {
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

export const WORKSTYLE_OPTIONS: Workstyle[] = ["Create", "Teach", "Advise", "Build", "Lead"];
export const BUDGET_OPTIONS: { value: Budget, label: string }[] = [
  { value: 'low', label: 'Low (<$100 mo)' },
  { value: 'medium', label: 'Medium ($100–500 mo)' },
  { value: 'high', label: 'High (>$500 mo)' },
];
export const AGE_BRACKET_OPTIONS: AgeBracket[] = ["18-29", "30-44", "45-59", "60+"];
export const MARKET_OPTIONS: Market[] = ["SMB", "Creators", "B2B SaaS", "Healthcare", "Education", "Nonprofits", "Local Services", "Professional Services", "Ecommerce"];

export const INITIAL_FORM_DATA: FormData = {
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

export const PERSONA_MAP: { persona: string, skills: (keyof Scores)[] }[] = [
  { persona: 'Narrative Architect', skills: ['communication', 'strategy'] },
  { persona: 'System Builder', skills: ['technical', 'strategy'] },
  { persona: 'Creator-Educator', skills: ['communication', 'creative'] },
  { persona: 'Opportunity Synthesist', skills: ['learning', 'strategy'] },
  { persona: 'Empathic Facilitator', skills: ['eq', 'communication'] },
  { persona: 'Visual Storysmith', skills: ['creative', 'communication'] },
  { persona: 'Operator-Automator', skills: ['technical', 'communication'] }, // Assuming Tech dominant, Comm secondary
  { persona: 'Community Catalyst', skills: ['eq', 'strategy', 'communication'] },
];

// Placeholder URL for the Google Sheet Web App
export const GOOGLE_SHEET_ENDPOINT = "https://script.google.com/macros/s/AKfycby.../exec"; // Replace with actual URL

// Placeholder for your AWeber integration endpoint (e.g., a Zapier webhook or a custom serverless function)
export const AWEBER_ENDPOINT = "https://hook.us1.make.com/k71oy4mebyi2rhjukfe246y5nlcui6in"; // Replace with actual URL