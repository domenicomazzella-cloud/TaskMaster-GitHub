import { GoogleGenAI, Type } from "@google/genai";
import { TagSuggestionRequest } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize client lazily inside the function to avoid immediate errors if key is missing
export const suggestTagsWithGemini = async (request: TagSuggestionRequest): Promise<string[]> => {
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    // Return empty array instead of crashing, allowing the app to function without AI
    return [];
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";
    const prompt = `
      Analizza il seguente task e suggerisci da 3 a 5 tag pertinenti, brevi e concisi in italiano per la categorizzazione.
      Titolo Task: ${request.title}
      Descrizione Task: ${request.description || "Nessuna descrizione fornita."}
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Una lista di tag pertinenti in italiano"
            }
          },
          required: ["tags"]
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return [];
    
    const parsed = JSON.parse(jsonText);
    return parsed.tags || [];

  } catch (error) {
    console.error("Error generating tags:", error);
    return [];
  }
};