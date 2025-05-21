// netlify/functions/product-search.mjs
import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.API_KEY; // Netlify will inject this

export async function handler(event) {
  if (!API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'API Key is not configured on the server.' }),
    };
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const productName = event.queryStringParameters.productName;

  if (!productName) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'productName query parameter is required.' }),
    };
  }

  const prompt = `You are an advanced product search simulator for UK supermarkets.
Your task is to search for the product: '${productName}' on BOTH www.asda.co.uk AND www.tesco.com.
Return a list of fictional grocery products found, including their prices from both retailers.

The response MUST be a valid JSON array. Each element in the array MUST be a JSON object.
Each JSON object MUST contain exactly four properties:
1. "name": A string value for the product name (e.g., "Hovis Wholemeal Bread 800g").
2. "code": A string value representing a fictional 7-digit product code (e.g., "1234567"). This code can be generic for the product.
3. "asdaPrice": A string value for the product price on ASDA, including the currency symbol (e.g., "£1.10"). If the product is not found or price is unavailable on ASDA, use the string "N/A". Ensure this is enclosed in double quotes.
4. "tescoPrice": A string value for the product price on Tesco, including the currency symbol (e.g., "£1.05"). If the product is not found or price is unavailable on Tesco, use the string "N/A". Ensure this is enclosed in double quotes.

The entire output from you MUST be ONLY this JSON array.
Do NOT include any explanatory text, comments, or markdown formatting such as \`\`\`json or \`\`\` before or after the JSON array.
Do NOT use single quotes for JSON strings; always use double quotes.

Example of a perfect, complete response for a search term like "milk 2L":
[
  {"name": "ASDA Whole Milk 2L", "code": "1002345", "asdaPrice": "£1.50", "tescoPrice": "£1.55"},
  {"name": "Tesco Semi-Skimmed Milk 2L", "code": "2005678", "asdaPrice": "N/A", "tescoPrice": "£1.45"},
  {"name": "Cravendale PureFilter Milk 2L", "code": "3008901", "asdaPrice": "£2.20", "tescoPrice": "£2.10"},
  {"name": "Organic Whole Milk 2L", "code": "4001234", "asdaPrice": "£1.90", "tescoPrice": "£1.90"}
]

Provide 3 to 5 such product objects in the JSON array, trying to find comparable items if the exact one isn't on both.
If a product is conceptually the same but branded differently (e.g., store brand vs. national brand for 'milk'), list them as separate items if their prices are distinct.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    let jsonStr = response.text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    // The Gemini API should return JSON, but we parse it here to ensure it's valid before sending.
    // The function itself should return a stringified JSON body.
    JSON.parse(jsonStr); // Validate JSON

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: jsonStr, // Return the raw, validated JSON string from Gemini
    };
  } catch (error) {
    console.error('Error calling Gemini API or processing response:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch product data from the AI model.' }),
    };
  }
}