import express from 'express';
import multer from 'multer';
import { generateSingleCertificate } from '../services/pdfService.js';
import { config } from '../config.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes }
});

/**
 * POST /api/preview-pdf
 * Renders a single sample certificate PDF with the current field positions and font settings.
 */
router.post('/preview-pdf', upload.single('template'), async (req, res) => {
  try {
    let templateBuffer = req.file?.buffer;
    let templateMime = req.file?.mimetype || 'image/png';

    if (!templateBuffer && req.body.templateBase64) {
      const base64Data = req.body.templateBase64.replace(/^data:[^;]+;base64,/, '');
      templateBuffer = Buffer.from(base64Data, 'base64');
      templateMime = req.body.templateMime || 'image/png';
    }

    if (!templateBuffer) {
      return res.status(400).json({ success: false, error: 'No template provided for preview.' });
    }

    let fields = {};
    if (typeof req.body.fields === 'string') {
      fields = JSON.parse(req.body.fields);
    } else if (req.body.fields) {
      fields = req.body.fields;
    }

    const sampleName = req.body.sampleName || 'Alexander Montgomery';
    const sampleRoll = req.body.sampleRoll || 'REG-2026-9842';

    const pdfBytes = await generateSingleCertificate({
      templateBuffer,
      templateMime,
      studentName: sampleName,
      rollNumber: sampleRoll,
      fields
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="preview-certificate.pdf"');
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('PDF preview error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate preview PDF.'
    });
  }
});

export default router;

