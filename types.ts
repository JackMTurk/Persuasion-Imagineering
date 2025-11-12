
export interface Scores {
  communication: number;
  creative: number;
  strategy: number;
  technical: number;
  eq: number;
  learning: number;
}

export const SKILL_KEYS: (keyof Scores)[] = ['communication', 'creative', 'strategy', 'technical', 'eq', 'learning'];


export type Workstyle = "Create" | "Teach" | "Advise" | "Build" | "Lead";
export type Budget = "low" | "medium" | "high";
export type AgeBracket = "18-29" | "30-44" | "45-59" | "60+";
export type Market = "SMB" | "Creators" | "B2B SaaS" | "Healthcare" | "Education" | "Nonprofits" | "Local Services" | "Professional Services" | "Ecommerce";

export interface FormData {
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

export interface Opportunity {
  what: string;
  whyFit: string;
  audience: string;
  offer: string;
  channel: string;
  speedPlan: string;
}

export interface Report {
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
