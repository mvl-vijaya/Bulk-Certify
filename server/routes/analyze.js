import express from 'express';
import multer from 'multer';
import { detectCertificateFields } from '../services/geminiService.js';
import { config } from '../config.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes }
});

/**
 * POST /api/analyze-template
 * Receives certificate template image and analyzes baseline coordinates with Gemini Vision AI.
 */
router.post('/analyze-template', upload.single('template'), async (req, res) => {
  try {
    let imageBuffer = req.file?.buffer;
    let mimeType = req.file?.mimetype || 'image/png';

    // Allow passing base64 image data directly from frontend (useful if client rendered PDF page to canvas)
    if (!imageBuffer && req.body.imageBase64) {
      const base64Data = req.body.imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
      mimeType = req.body.mimeType || 'image/png';
    }

    if (!imageBuffer) {
      return res.status(400).json({
        success: false,
        error: 'No template image or file was uploaded.'
      });
    }

    // User can supply their Gemini API key via header or body
    const userApiKey = req.headers['x-gemini-api-key'] || req.body.apiKey;

    const result = await detectCertificateFields({
      imageBuffer,
      mimeType,
      apiKey: userApiKey
    });

    return res.json(result);
  } catch (err) {
    console.error('Template analysis error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while analyzing template'
    });
  }
});

export default router;

