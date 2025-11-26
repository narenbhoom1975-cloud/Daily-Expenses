import { GoogleGenAI, Type } from "@google/genai";
import { ExpenseResponse } from '../types';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
  });
};

export const processAudioWithGemini = async (audioBlob: Blob): Promise<ExpenseResponse> => {
  // THIS LINE IS FIXED — works on all hosting platforms
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key missing! Add VITE_GEMINI_API_KEY in your hosting environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const base64Audio = await blobToBase64(audioBlob);

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      transcription: { type: Type.STRING },
      translation: { type: Type.STRING },
      expenses: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            item: { type: Type.STRING },
            amount: { type: Type.NUMBER },
            category: { type: Type.STRING }
          },
          required: ["item", "amount", "category"]
        }
      },
      totalAmount: { type: Type.NUMBER },
      currency: { type: Type.STRING }
    },
    required: ["transcription", "translation", "expenses", "totalAmount", "currency"]
  };

  const systemInstruction = `
    You are an expert Indian expense tracker AI.
    Listen carefully to mixed Hindi-English speech and do this:
    1. Transcribe exactly in Devanagari Hindi + English.
    2. Translate to clear English.
    3. Extract EVERY expense mentioned.
    4. Convert ALL Indian numbers perfectly:
       - "dedh lakh" or "1.5 lakh" → 150000
       - "ek lakh" or "1 lakh" → 100000
       - "pachas hazar" or "50 thousand" → 50000
       - "so rupaye" or "100 ka" → 100
       - "do hazaar" → 2000
    5. Categorize properly (Food & Vegetables, Transportation, Shopping, etc.)
    6. Calculate TOTAL exactly as sum of all amounts.
    Return ONLY valid JSON matching the schema.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: audioBlob.type || 'audio/webm',
              data: base64Audio
            }
          },
          { text: "Extract all expenses from this audio." }
        ]
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema,
        temperature: 0.1
      }
    });

    if (!response.text) throw new Error("Empty response from Gemini");

    const parsed = JSON.parse(response.text) as ExpenseResponse;

    // CLIENT-SIDE FIX: Force correct total (in case Gemini messes up)
    parsed.totalAmount = parsed.expenses.reduce((sum, e) => sum + e.amount, 0);

    return parsed;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
