import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.VITE_GEMINI_API_KEY);

async function listModels() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        console.log("Attempting to reach gemini-1.5-flash...");

        const result = await model.generateContent("test");
        console.log("Success! Response text:", result.response.text());
    } catch (error) {
        console.error("Error Detail:", error);
    }
}

listModels();
