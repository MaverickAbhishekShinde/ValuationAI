import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const key = process.env.VITE_GEMINI_API_KEY;

async function listModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data.models) {
            console.log("Model Names:");
            data.models.forEach(m => console.log(m.name));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("List Models Error:", error);
    }
}

listModels();
