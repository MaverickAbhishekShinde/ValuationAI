import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const key = process.env.VITE_GEMINI_API_KEY;
console.log("Using key starting with:", key ? key.substring(0, 5) : "MISSING");

async function listModels() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
        const response = await fetch(url);
        const data = await response.json();
        console.log("Available Models:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("List Models Error:", error);
    }
}

listModels();
