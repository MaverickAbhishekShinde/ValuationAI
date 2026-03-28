import dotenv from "dotenv";

dotenv.config();

const key = process.env.VITE_GROQ_API_KEY;

async function checkGroq() {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'test' }],
                temperature: 0.3
            })
        });
        const data = await response.json();
        console.log("Groq Success! Response:", data.choices?.[0]?.message?.content);
    } catch (error) {
        console.error("Error Detail:", error);
    }
}

checkGroq();
