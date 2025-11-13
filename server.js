
import express from 'express';
import cors from 'cors';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3001;

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
// Allow requests from any origin, which is fine for this public-facing app
app.use(cors()); 
// Allow the server to read JSON from request bodies
app.use(express.json()); 
// Serve the static frontend files (index.html, index.tsx, etc.) from the root directory
app.use(express.static(path.join(__dirname, '')));

// --- The Secure API Endpoint ---
// The frontend will call this endpoint instead of Google's API directly.
app.post('/api/generate', async (req, res) => {
  // Securely access the API key from Render's environment variables
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error('API key is not configured on the server.');
    return res.status(500).json({ error: 'API key is not configured on the server. Deployment is missing the API_KEY environment variable.' });
  }

  // Extract the data sent from the frontend
  const { formData, schema, systemInstruction, userContent } = req.body;

  if (!formData || !schema || !systemInstruction || !userContent) {
      return res.status(400).json({ error: 'Missing required data in the request body.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Make the call to the Gemini API on behalf of the client
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: userContent }] },
      config: { systemInstruction, responseMimeType: "application/json", responseSchema: schema }
    });
    
    // The response text is a JSON string, so we parse it before sending.
    const reportData = JSON.parse(response.text);

    // Send the successful response from Gemini back to the frontend
    res.json(reportData);

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    res.status(500).json({ error: 'An error occurred while communicating with the AI service.' });
  }
});

// A catch-all route to serve the index.html for any non-API routes, which helps with client-side routing.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server is running and listening on port ${port}`);
});
