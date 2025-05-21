// netlify/functions/product-search.js
import { GoogleGenAI } from "@google/genai";

// API_KEY will be set in Netlify's environment variables
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const GEMINI_MODEL = 'gemini-2.5-flash-preview-04-17';

export async function handler(event) { // Netlify uses 'handler'
    const productName = event.queryStringParameters.productName;

    if (!productName) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Product name is required." }),
        };
    }

    const prompt = `Search for products matching "${productName}" on ASDA and Tesco. For each product, provide its name, a unique product code, the ASDA price, and the Tesco price. If a price is unavailable, use "N/A". Return the results as a JSON array, where each object has "name", "code", "asdaPrice", and "tescoPrice" fields. Example: [{"name": "Heinz Baked Beans", "code": "HB001", "asdaPrice": "£1.00", "tescoPrice": "£1.05"}]`;

    try {
        const response = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
            jsonStr = match[2].trim();
        }
        
        const products = JSON.parse(jsonStr);

        return {
            statusCode: 200,
            body: JSON.stringify(products),
        };
    } catch (error) {
        console.error('Error calling Gemini API or parsing response:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to get product data from AI. Details: ' + error.message }),
        };
    }
}