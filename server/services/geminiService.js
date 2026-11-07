import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';

/**
 * Bulk Certify - Gemini Vision API Service
 * Analyzes certificate templates to detect placeholder dash lines & baseline coordinates.
 */

/**
 * Analyzes a certificate template image to find coordinates for Student Name and Roll Number.
 *
 * @param {Object} params
 * @param {Buffer} params.imageBuffer - Image buffer (PNG or JPEG)
 * @param {string} params.mimeType - 'image/png' or 'image/jpeg'
 * @param {string} [params.apiKey] - Optional user-provided Gemini API key
 * @returns {Promise<Object>} Detected coordinates and layout recommendations
 */
export async function detectCertificateFields({
  imageBuffer,
  mimeType = 'image/png',
  apiKey
}) {
  const activeKey = apiKey?.trim() || config.defaultGeminiApiKey?.trim();

  // If no Gemini API key is supplied, provide sensible certificate layout defaults
  if (!activeKey) {
    return {
      success: true,
      mode: 'heuristic_fallback',
      message: 'No GEMINI_API_KEY provided. Applied standard certificate alignment heuristics.',
      fields: getDefaultFieldCoordinates()
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(activeKey);
    // Prefer gemini-3.5-flash-lite / gemini-3.8-flash for speed and reliability
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.5-flash'];
    let lastError = null;
    let result = null;

    const base64Data = imageBuffer.toString('base64');

    // Prompt specifically tailored for certificate layout detection
    const prompt = `
You are an expert document analysis and computer vision system.
Analyze this certificate template image with extreme precision to detect the placeholder text lines.

Task:
1. Locate the primary placeholder line (1st dashed line, dotted line, solid line, or open baseline area) intended for the RECIPIENT'S / STUDENT'S NAME. This usually appears right below phrases like "This is to certify that", "Awarded to", or "Presented to".
2. Locate the secondary placeholder line (2nd dashed line or field) intended for the ROLL NUMBER, REGISTRATION NUMBER, or CERTIFICATE ID. This usually appears below the recipient's name or alongside metadata.

For each field, calculate coordinates as PERCENTAGES (0 to 100) relative to the template dimensions:
- The coordinate origin (0, 0) is the TOP-LEFT of the image.
- xPercent: The horizontal left starting position of the line or text area (0 = extreme left, 100 = extreme right).
- yPercent: The vertical TOP position where the text box should start (about 2% to 6% above the line).
- widthPercent: The total horizontal span / width of the dashed line or allocated space.
- heightPercent: The height of the text box (usually 6% to 10%).
- alignment: "center", "left", or "right" based on the certificate design.
- suggestedFontSize: Recommended font size in points (e.g., 28 to 36 for Name, 16 to 22 for Roll Number).

Respond STRICTLY with valid JSON following this schema:
{
  "nameField": {
    "xPercent": number,
    "yPercent": number,
    "widthPercent": number,
    "heightPercent": number,
    "alignment": "center" | "left" | "right",
    "suggestedFontSize": number,
    "description": string
  },
  "rollNumberField": {
    "xPercent": number,
    "yPercent": number,
    "widthPercent": number,
    "heightPercent": number,
    "alignment": "center" | "left" | "right",
    "suggestedFontSize": number,
    "description": string
  }
}
`;

    for (const modelName of candidateModels) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1
          }
        });

        result = await model.generateContent([
          prompt,
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]);
        if (result) break;
      } catch (mErr) {
        lastError = mErr;
        console.warn(`Model ${modelName} failed (${mErr.message}), trying next candidate...`);
      }
    }

    if (!result && lastError) {
      throw lastError;
    }

    const responseText = result.response.text();
    let parsedData;

    try {
      parsedData = JSON.parse(responseText);
    } catch (parseErr) {
      // Clean possible markdown code fence wrapper (```json ... ```)
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    // Validate and sanitize the response data
    const validated = validateAndSanitizeGeminiOutput(parsedData);

    return {
      success: true,
      mode: 'gemini_vision',
      message: 'Successfully detected field baselines using Gemini Vision AI.',
      fields: validated
    };
  } catch (err) {
    console.error('Gemini Vision API error:', err.message);

    // Fallback gracefully to heuristics if Gemini call fails (e.g. quota, bad key)
    return {
      success: false,
      mode: 'heuristic_fallback',
      error: err.message,
      message: `Gemini Vision detection failed (${err.message}). Reverted to standard certificate layout heuristics.`,
      fields: getDefaultFieldCoordinates()
    };
  }
}

/**
 * Standard certificate layout heuristics when AI is unavailable or fails.
 */
function getDefaultFieldCoordinates() {
  return {
    nameField: {
      xPercent: 15,
      yPercent: 42,
      widthPercent: 70,
      heightPercent: 8,
      alignment: 'center',
      suggestedFontSize: 32,
      description: 'Default primary recipient name baseline'
    },
    rollNumberField: {
      xPercent: 25,
      yPercent: 55,
      widthPercent: 50,
      heightPercent: 6,
      alignment: 'center',
      suggestedFontSize: 18,
      description: 'Default secondary roll number baseline'
    }
  };
}

/**
 * Ensures Gemini's numeric values are within safe percentage bounds (0-100%).
 */
function validateAndSanitizeGeminiOutput(data) {
  const clamp = (val, min, max, def) => {
    const num = Number(val);
    if (isNaN(num)) return def;
    return Math.min(Math.max(num, min), max);
  };

  const name = data?.nameField || {};
  const roll = data?.rollNumberField || {};

  return {
    nameField: {
      xPercent: clamp(name.xPercent, 0, 90, 15),
      yPercent: clamp(name.yPercent, 5, 90, 42),
      widthPercent: clamp(name.widthPercent, 10, 100, 70),
      heightPercent: clamp(name.heightPercent, 2, 30, 8),
      alignment: ['center', 'left', 'right'].includes(name.alignment) ? name.alignment : 'center',
      suggestedFontSize: clamp(name.suggestedFontSize, 12, 72, 32),
      description: name.description || 'Recipient name line'
    },
    rollNumberField: {
      xPercent: clamp(roll.xPercent, 0, 90, 25),
      yPercent: clamp(roll.yPercent, 5, 95, 55),
      widthPercent: clamp(roll.widthPercent, 10, 100, 50),
      heightPercent: clamp(roll.heightPercent, 2, 25, 6),
      alignment: ['center', 'left', 'right'].includes(roll.alignment) ? roll.alignment : 'center',
      suggestedFontSize: clamp(roll.suggestedFontSize, 10, 48, 18),
      description: roll.description || 'Roll number line'
    }
  };
}

