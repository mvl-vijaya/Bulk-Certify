import express from 'express';
import multer from 'multer';
import { generateBatchZip, generateSingleCertificate } from '../services/pdfService.js';
import { sanitizeFilename } from '../utils/sanitizer.js';
import { config } from '../config.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes }
});

/**
 * POST /api/generate-batch
 * Generates all customized certificate PDFs in bulk and downloads them as a single ZIP archive.
 */
router.post('/generate-batch', upload.single('template'), async (req, res) => {
  try {
    let templateBuffer = req.file?.buffer;
    let templateMime = req.file?.mimetype || 'image/png';

    if (!templateBuffer && req.body.templateBase64) {
      const base64Data = req.body.templateBase64.replace(/^data:[^;]+;base64,/, '');
      templateBuffer = Buffer.from(base64Data, 'base64');
      templateMime = req.body.templateMime || 'image/png';
    }

    if (!templateBuffer) {
      return res.status(400).json({ success: false, error: 'Certificate template is required.' });
    }

    let students = [];
    if (typeof req.body.students === 'string') {
      students = JSON.parse(req.body.students);
    } else if (Array.isArray(req.body.students)) {
      students = req.body.students;
    }

    if (!students || students.length === 0) {
      return res.status(400).json({ success: false, error: 'Student records list is empty.' });
    }

    let fields = {};
    if (typeof req.body.fields === 'string') {
      fields = JSON.parse(req.body.fields);
    } else if (req.body.fields) {
      fields = req.body.fields;
    }

    const nameColumn = req.body.nameColumn || 'Student Name';
    const rollNumberColumn = req.body.rollNumberColumn || 'Roll Number';

    const zipBuffer = await generateBatchZip({
      templateBuffer,
      templateMime,
      students,
      nameColumn,
      rollNumberColumn,
      fields
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const downloadFilename = `Certificates_${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadFilename}"`);
    res.setHeader('Content-Length', zipBuffer.length);

    return res.end(zipBuffer);
  } catch (err) {
    console.error('Batch generation error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'An error occurred during batch certificate generation.'
    });
  }
});

/**
 * POST /api/generate-single
 * Generates an individual student's certificate PDF for single-file download.
 */
router.post('/generate-single', upload.single('template'), async (req, res) => {
  try {
    let templateBuffer = req.file?.buffer;
    let templateMime = req.file?.mimetype || 'image/png';

    if (!templateBuffer && req.body.templateBase64) {
      const base64Data = req.body.templateBase64.replace(/^data:[^;]+;base64,/, '');
      templateBuffer = Buffer.from(base64Data, 'base64');
      templateMime = req.body.templateMime || 'image/png';
    }

    if (!templateBuffer) {
      return res.status(400).json({ success: false, error: 'Certificate template is required.' });
    }

    let fields = {};
    if (typeof req.body.fields === 'string') {
      fields = JSON.parse(req.body.fields);
    } else if (req.body.fields) {
      fields = req.body.fields;
    }

    const studentName = req.body.studentName || 'Student';
    const rollNumber = req.body.rollNumber || '';

    const pdfBytes = await generateSingleCertificate({
      templateBuffer,
      templateMime,
      studentName,
      rollNumber,
      fields
    });

    const filename = `${sanitizeFilename(studentName)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Single certificate generation error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate single certificate.'
    });
  }
});

export default router;

