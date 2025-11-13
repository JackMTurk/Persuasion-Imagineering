

import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Modality } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3001;

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors()); 
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '')));

// --- The Secure API Endpoint for Report Generation ---
app.post('/api/generate', async (req, res) => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error('API key is not configured on the server.');
    return res.status(500).json({ error: 'API key is not configured on the server. Deployment is missing the API_KEY environment variable.' });
  }

  const { formData, schema, systemInstruction, userContent } = req.body;

  if (!formData || !schema || !systemInstruction || !userContent) {
      return res.status(400).json({ error: 'Missing required data in the request body.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: userContent }] },
      config: { systemInstruction, responseMimeType: "application/json", responseSchema: schema }
    });
    
    if (response.promptFeedback?.blockReason) {
        const blockReason = response.promptFeedback.blockReason;
        const safetyRatings = JSON.stringify(response.promptFeedback.safetyRatings);
        console.error(`Gemini API blocked the prompt. Reason: ${blockReason}. Ratings: ${safetyRatings}`);
        return res.status(500).json({ error: `The AI service blocked the request due to content safety policies. Reason: ${blockReason}. Please modify your input and try again.` });
    }

    const responseText = response.text;

    if (!responseText) {
      console.error('Gemini API returned an empty response without a specific block reason. Full response:', JSON.stringify(response, null, 2));
      return res.status(500).json({ error: 'The AI service returned an empty response. This may be due to a content safety filter. Please check your inputs.' });
    }

    let reportData;
    try {
      reportData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON from Gemini response. Raw response:', responseText);
      return res.status(500).json({ error: 'The AI service returned a malformed response that was not valid JSON. This is an internal error.' });
    }

    res.json(reportData);

  } catch (error) {
    console.error('Error calling Gemini API SDK for text generation:', error);
    
    let errorMessage = 'An internal server error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
        if (errorMessage.includes('API key not valid')) {
            errorMessage = 'The API key configured on the server is invalid. Please check the Render environment variables.';
        } else if (errorMessage.includes('permission denied')) {
            errorMessage = 'The API key is missing necessary permissions, or the Google AI Platform API is not enabled on your Google Cloud project.';
        } else if (errorMessage.includes('billing')) {
            errorMessage = 'There is a billing issue with your Google Cloud project. Please ensure billing is enabled.';
        }
    }
    
    res.status(500).json({ 
        error: `An error occurred while communicating with the AI service. Details: ${errorMessage}` 
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running and listening on port ${port}`);
});