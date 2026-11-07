import express from 'express';
import multer from 'multer';
import { parseSpreadsheet } from '../services/excelService.js';
import { config } from '../config.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSizeBytes }
});

/**
 * POST /api/parse-data
 * Receives an Excel (.xlsx/.xls) or CSV file and extracts student records and headers.
 */
router.post('/parse-data', upload.single('dataFile'), (req, res) => {
  try {
    const fileBuffer = req.file?.buffer;
    if (!fileBuffer) {
      return res.status(400).json({
        success: false,
        error: 'No Excel or CSV data file was uploaded.'
      });
    }

    const parsed = parseSpreadsheet(fileBuffer);

    return res.json({
      success: true,
      filename: req.file.originalname,
      ...parsed
    });
  } catch (err) {
    console.error('Spreadsheet parsing error:', err);
    return res.status(400).json({
      success: false,
      error: err.message || 'Failed to parse the uploaded spreadsheet.'
    });
  }
});

export default router;

