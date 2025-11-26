import { GoogleGenerativeAI } from "@google/genai";

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const body = await request.json();
    const audioBase64 = body.audio;

    const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const result = await model.generateContent(audioBase64);

    return new Response(JSON.stringify({ reply: result.response.text() }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ reply: "Error processing audio" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
}
