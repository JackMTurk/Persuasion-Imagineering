import { Type } from "@google/genai";

// --- Type Definitions ---
// These types are used by the engine and the form, so we export them from this central location.
export interface Scores {
  communication: number;
  creative: number;
  strategy: number;
  technical: number;
  eq: number;
  learning: number;
}

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
  topStrengths: { strength: string; reason:string }[];
  opportunityMap: Opportunity[];
  quickWins: string[];
  buildPlan: string[];
  guardrails: string[];
  tools: string[];
  starterPrompts: { title: string; prompt: string }[];
  jsonData: string;
}

// --- Persona Logic ---
const PERSONA_MAP: { persona: string, skills: (keyof Scores)[] }[] = [
  { persona: 'Narrative Architect', skills: ['communication', 'strategy'] }, { persona: 'System Builder', skills: ['technical', 'strategy'] },
  { persona: 'Creator-Educator', skills: ['communication', 'creative'] }, { persona: 'Opportunity Synthesist', skills: ['learning', 'strategy'] },
  { persona: 'Empathic Facilitator', skills: ['eq', 'communication'] }, { persona: 'Visual Storysmith', skills: ['creative', 'communication'] },
  { persona: 'Operator-Automator', skills: ['technical', 'communication'] }, { persona: 'Community Catalyst', skills: ['eq', 'strategy', 'communication'] },
];

const getTopSkills = (scores: Scores, count = 2): (keyof Scores)[] => {
  return (Object.keys(scores) as (keyof Scores)[])
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, count);
};

export const determinePersona = (scores: Scores): string => {
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


// --- Prompt Engineering ---

export const systemInstruction = `You are "Jack Turk, P.I. (Persuasion Imagineer)," an AI business strategist. Your voice is a blend of a 1940s noir detective and a modern, savvy marketing expert—think Humphrey Bogart meets Seth Godin. You are gritty, insightful, and speak in a slightly stylized, hard-boiled manner, but you're genuinely here to help the user crack the code on their next big move. You call opportunities "gigs," problems "cases," and skills your "tool kit." Your goal is to analyze the user's "dossier" (their form inputs) and deliver a personalized, actionable "briefing" (the report). You must strictly adhere to the provided JSON schema for your response.`;

export const createUserContent = (formData: FormData, currentPersona: string): string => {
    return `Here's the dossier on the new client, gumshoe. Lay out the full briefing.

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
};


// --- JSON Schema Definition ---
export const generateJsonSchema = () => ({
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