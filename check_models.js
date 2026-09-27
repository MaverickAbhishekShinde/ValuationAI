import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

async function testModel() {
    const candidateModels = ["gemini-flash-latest", "gemini-3.7-flash", "gemini-3.5-flash", "gemini-3.8-flash"];
    for (const m of candidateModels) {
        try {
            console.log(`Testing model: ${m}...`);
            const model = genAI.getGenerativeModel({ model: m });
            const result = await model.generateContent("Respond with JSON: {\"status\": \"ok\"}");
            console.log(`Success with ${m}! Output:`, result.response.text());
            return;
        } catch (error) {
            console.error(`Failed ${m}:`, error.message);
        }
    }
}

testModel();
