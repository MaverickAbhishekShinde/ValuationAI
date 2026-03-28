import dotenv from "dotenv";

dotenv.config();

const key = process.env.VITE_GROQ_API_KEY;

async function listGroqModelNames() {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/models', {
            headers: {
                'Authorization': `Bearer ${key}`
            }
        });
        const data = await response.json();
        if (data.data) {
            console.log("Groq Model Names:");
            data.data.forEach(m => console.log(m.id));
        } else {
            console.log("No models found or error:", data);
        }
    } catch (error) {
        console.error("List Groq Model Names Error:", error);
    }
}

listGroqModelNames();
