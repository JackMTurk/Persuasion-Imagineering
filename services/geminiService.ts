
import { GoogleGenAI, Type } from "@google/genai";
import { FormData, Report, Scores, SKILL_KEYS } from '../types.ts';
import { PERSONA_MAP, GOOGLE_SHEET_ENDPOINT, AWEBER_ENDPOINT } from '../constants.ts';

// FIX: Per @google/genai guidelines, initialize directly with the environment variable.
// REMOVED: Global AI client initialization to prevent crash on load in environments without process.env.

// FIX: Added response schema for robust JSON output.
const reportSchema = {
  type: Type.OBJECT,
  properties: {
    personaTitle: { type: Type.STRING },
    identityParagraph: { type: Type.STRING },
    topStrengths: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          strength: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ['strength', 'reason'],
      },
    },
    opportunityMap: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          what: { type: Type.STRING },
          whyFit: { type: Type.STRING },
          audience: { type: Type.STRING },
          offer: { type: Type.STRING },
          channel: { type: Type.STRING },
          speedPlan: { type: Type.STRING },
        },
        required: ['what', 'whyFit', 'audience', 'offer', 'channel', 'speedPlan'],
      },
    },
    quickWins: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    buildPlan: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    guardrails: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    tools: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    starterPrompts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          prompt: { type: Type.STRING },
        },
        required: ['title', 'prompt'],
      },
    },
  },
  required: [
    'personaTitle',
    'identityParagraph',
    'topStrengths',
    'opportunityMap',
    'quickWins',
    'buildPlan',
    'guardrails',
    'tools',
    'starterPrompts',
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
    if (bestMatch.length > 0) {
        return bestMatch[0][0];
    }

    return 'Opportunity Synthesist'; // Fallback
};

// FIX: Separated system instruction from user content per Gemini API best practices.
const buildSystemInstruction = (): string => {
  return `You are "The Persuasion Imagineer"—a strategic advisor that converts a person's skills, interests, and constraints into realistic, high-leverage market opportunities. Your outputs must be specific, feasible, and action-oriented. You are confident, warm, conversational, and direct. You avoid vague pep-talks and hype.

OBJECTIVE:
Given the user's data, produce a complete diagnostic report.

PROCESS:
1.  **Adopt Persona Tone**: Generate the entire response in the voice of a trusted strategic advisor. Be clear, direct, and encouraging.
2.  **Analyze Strengths**: Use the top strengths to frame the entire report.
3.  **Generate Opportunities**: Create 3-5 opportunity plays that are a strong fit for the user's persona, strengths, chosen markets, workstyle, and constraints.
4.  **Apply Feasibility Filters**:
    - **Age/Physical Realism**: Do not suggest physically demanding roles for older age brackets or roles that contradict constraints. Propose adjacent, realistic roles (e.g., coach instead of player).
    - **Budget/Time**: Favor low-friction, digital-first ideas for low budgets and limited time.
    - **Speed-to-Revenue**: Ensure at least one opportunity is viable within 30 days.
    - **Authenticity**: Opportunities must align with user's strengths and wildcards.
5.  **Structure Output**: Generate the report according to the JSON schema provided.

You MUST return a single, valid JSON object that strictly follows the provided schema. Do not include any text, markdown, or explanations outside of the JSON object.`;
};

// FIX: Created a dedicated function for user-specific content.
const buildUserContent = (formData: FormData, persona: string, topSkills: (keyof Scores)[], normalizedScores: { [key in keyof Scores]: number }): string => {
  return `USER DATA:
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
};


export const generateReport = async (formData: FormData): Promise<Report> => {
    let ai;
    try {
        // This check handles environments where `process` is not defined (like a browser without a build step).
        if (typeof process === 'undefined' || !process.env.API_KEY) {
            throw new Error("API_KEY environment variable not found.");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } catch (e) {
        console.error("Failed to initialize GoogleGenAI. Is the API_KEY environment variable set on your deployment platform?", e);
        throw new Error("Configuration Error: The API key is missing. Please add it to your environment variables on Render.com to proceed.");
    }
    
    try {
        const normalizedScores = normalizeScores(formData.scores);
        const topSkills = identifyTopSkills(normalizedScores);
        const persona = determinePersona(topSkills);
        
        const systemInstruction = buildSystemInstruction();
        const userContent = buildUserContent(formData, persona, topSkills, normalizedScores);

        // FIX: Updated generateContent call with systemInstruction and responseSchema.
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userContent,
          config: {
              systemInstruction,
              responseMimeType: "application/json",
              responseSchema: reportSchema,
          }
        });

        // FIX: Per @google/genai guidelines, directly access the .text property.
        const text = response.text;
        const reportData = JSON.parse(text);
        
        // Prepare JSON for snapshot/backend
        const snapshot = {
            name: formData.name,
            email: formData.email,
            persona: reportData.personaTitle,
            strengths: topSkills,
            markets: formData.markets,
            scores: normalizedScores,
            consent: formData.consent,
        };

        const finalReport = {
          ...reportData,
          jsonData: JSON.stringify(snapshot, null, 2)
        };

        // Fire-and-forget calls to backend services if consent is given
        if (formData.consent) {
            postToGoogleSheet(snapshot).catch(console.error);
            postToAweber(formData.name, formData.email).catch(console.error);
        }
        
        return finalReport;
    } catch (error) {
        console.error("Error generating report:", error);
        if (error instanceof Error && /API key not valid/i.test(error.message)) {
            throw new Error("The API key is invalid. Please check the value in your Render.com environment variables.");
        }
        throw new Error("Failed to generate your Renaissance Map. The AI may be experiencing high demand. Please try again later.");
    }
};

const postToGoogleSheet = async (data: object) => {
    if (!GOOGLE_SHEET_ENDPOINT.includes('...')) {
        try {
            await fetch(GOOGLE_SHEET_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
        } catch (error) {
            console.error("Error posting to Google Sheet:", error);
        }
    } else {
        console.warn("Google Sheet endpoint is a placeholder. Skipping POST.");
    }
};

const postToAweber = async (name: string, email: string) => {
    if (!AWEBER_ENDPOINT.includes('your.aweber.integration.url')) {
        try {
            // AWeber's API to add a subscriber typically requires a payload like this.
            // Your integration endpoint (e.g., a serverless function) will handle the authentication.
            const payload = {
                email,
                name,
            };

            await fetch(AWEBER_ENDPOINT, {
                method: 'POST',
                mode: 'no-cors', // Use 'no-cors' if your endpoint is a simple webhook that doesn't return CORS headers
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
        } catch (error) {
            console.error("Error posting to AWeber:", error);
        }
    } else {
        console.warn("AWeber endpoint is a placeholder. Skipping POST.");
    }
};
