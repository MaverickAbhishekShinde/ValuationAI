import dotenv from "dotenv";

dotenv.config();

const key = process.env.VITE_GROQ_API_KEY;
console.log("Using Groq key starting with:", key ? key.substring(0, 5) : "MISSING");

async function listGroqModels() {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });
        const data = await response.json();
        console.log("Groq Models:", data.data?.map(m => m.id).join(', '));
    } catch (error) {
        console.error("List Groq Models Error:", error);
    }
}

listGroqModels();
