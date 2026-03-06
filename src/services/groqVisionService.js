class GroqVisionService {
    constructor() {
        this.apiKey = process.env.GROQ_API_KEY;
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    }

    async analyzeImage(base64Image, systemPrompt, userPrompt = "Please analyze this image.") {
        if (!this.apiKey) {
            throw new Error("GROQ_API_KEY is not set in environment variables");
        }

        let imageUrl = base64Image;
        if (!base64Image.startsWith('data:image')) {
            imageUrl = `data:image/jpeg;base64,${base64Image}`;
        }

        const payload = {
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: userPrompt },
                        { type: "image_url", image_url: { url: imageUrl } }
                    ]
                }
            ],
            max_tokens: 1024,
            temperature: 0.1
        };

        return this._makeRequest(payload);
    }

    async analyzeText(systemPrompt, userPrompt) {
        if (!this.apiKey) {
            throw new Error("GROQ_API_KEY is not set in environment variables");
        }

        const payload = {
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            max_tokens: 1024,
            temperature: 0.1
        };

        return this._makeRequest(payload);
    }

    async _makeRequest(payload) {
        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Groq API error: ${response.status} ${errText}`);
            }

            const data = await response.json();
            const rawContent = data.choices[0].message.content;

            return this.parseJsonResponse(rawContent);
        } catch (error) {
            if (error.isParseError) {
                throw error;
            }
            throw new Error(`GroqVisionService Error: ${error.message}`);
        }
    }

    parseJsonResponse(content) {
        let cleanStr = content.trim();

        // Strip out formatting that could break JSON.parse
        if (cleanStr.startsWith('```json')) {
            cleanStr = cleanStr.substring(7);
        } else if (cleanStr.startsWith('```JSON')) {
            cleanStr = cleanStr.substring(7);
        } else if (cleanStr.startsWith('```')) {
            cleanStr = cleanStr.substring(3);
        }

        if (cleanStr.endsWith('```')) {
            cleanStr = cleanStr.substring(0, cleanStr.length - 3);
        }

        cleanStr = cleanStr.trim();

        try {
            return JSON.parse(cleanStr);
        } catch (err) {
            const parseError = new Error("AI response parse failed");
            parseError.isParseError = true;
            parseError.raw = content;
            throw parseError;
        }
    }
}

module.exports = new GroqVisionService();
