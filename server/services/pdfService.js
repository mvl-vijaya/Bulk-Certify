import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import archiver from 'archiver';
import { calculatePdfTextCoordinates } from '../utils/coordinateConverter.js';
import { sanitizeFilename, hexToRgb01 } from '../utils/sanitizer.js';

/**
 * Bulk Certify - High-Performance PDF Generation Engine
 * Overlays dynamic recipient data onto master PDF or image templates with auto-fitting.
 */

// Mapping of UI font options to pdf-lib standard fonts
const FONT_MAP = {
  'Helvetica': StandardFonts.Helvetica,
  'Helvetica-Bold': StandardFonts.HelveticaBold,
  'Times-Roman': StandardFonts.TimesRoman,
  'Times-Bold': StandardFonts.TimesRomanBold,
  'Courier': StandardFonts.Courier,
  'Courier-Bold': StandardFonts.CourierBold
};

/**
 * Helper to determine if a buffer is a PNG by inspecting the magic bytes.
 */
function isPngBuffer(buf) {
  if (!buf || buf.length < 8) return false;
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
}

/**
 * Generates a single customized certificate PDF buffer for a recipient.
 *
 * @param {Object} params
 * @param {Buffer} params.templateBuffer - Master template buffer (PNG, JPG, or PDF)
 * @param {string} params.templateMime - Template MIME type ('application/pdf', 'image/png', 'image/jpeg')
 * @param {string} params.studentName - Recipient name
 * @param {string} params.rollNumber - Roll / Registration number
 * @param {Object} params.fields - Field mapping config { nameField, rollNumberField }
 * @returns {Promise<Uint8Array>} Raw PDF bytes
 */
export async function generateSingleCertificate({
  templateBuffer,
  templateMime = 'image/png',
  studentName = '',
  rollNumber = '',
  fields = {}
}) {
  const isPdfTemplate = templateMime === 'application/pdf';
  let targetDoc;
  let targetPage;
  let pageWidth;
  let pageHeight;

  if (isPdfTemplate) {
    // 1. PDF Template: Load existing PDF and clone the first page to preserve vector artwork
    const sourcePdf = await PDFDocument.load(templateBuffer);
    targetDoc = await PDFDocument.create();
    const [copiedPage] = await targetDoc.copyPages(sourcePdf, [0]);
    targetPage = targetDoc.addPage(copiedPage);
    const size = targetPage.getSize();
    pageWidth = size.width;
    pageHeight = size.height;
  } else {
    // 2. Image Template (PNG or JPEG): Embed image at 1:1 original resolution
    targetDoc = await PDFDocument.create();
    const isPng = templateMime === 'image/png' || isPngBuffer(templateBuffer);
    const embeddedImg = isPng
      ? await targetDoc.embedPng(templateBuffer)
      : await targetDoc.embedJpg(templateBuffer);

    pageWidth = embeddedImg.width;
    pageHeight = embeddedImg.height;

    // Create page matching exact image pixel dimensions for zero pixelation
    targetPage = targetDoc.addPage([pageWidth, pageHeight]);
    targetPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight
    });
  }

  // Embed requested font families
  const nameFontName = FONT_MAP[fields.nameField?.fontFamily] || StandardFonts.HelveticaBold;
  const rollFontName = FONT_MAP[fields.rollNumberField?.fontFamily] || StandardFonts.Helvetica;

  const embeddedNameFont = await targetDoc.embedFont(nameFontName);
  const embeddedRollFont = await targetDoc.embedFont(rollFontName);

  // Parse font colors
  const nameColorRgb = hexToRgb01(fields.nameField?.fontColor || '#1e3a8a');
  const rollColorRgb = hexToRgb01(fields.rollNumberField?.fontColor || '#374151');

  // Calculate coordinates & auto-fit for Student Name (1st line)
  if (studentName && fields.nameField) {
    const nameLayout = calculatePdfTextCoordinates({
      text: studentName,
      field: fields.nameField,
      pageWidth,
      pageHeight,
      font: embeddedNameFont
    });

    targetPage.drawText(nameLayout.text, {
      x: nameLayout.x,
      y: nameLayout.y,
      size: nameLayout.fontSize,
      font: embeddedNameFont,
      color: rgb(nameColorRgb.r, nameColorRgb.g, nameColorRgb.b)
    });
  }

  // Calculate coordinates & auto-fit for Roll Number (2nd line)
  if (rollNumber && fields.rollNumberField) {
    const rollLayout = calculatePdfTextCoordinates({
      text: rollNumber,
      field: fields.rollNumberField,
      pageWidth,
      pageHeight,
      font: embeddedRollFont
    });

    targetPage.drawText(rollLayout.text, {
      x: rollLayout.x,
      y: rollLayout.y,
      size: rollLayout.fontSize,
      font: embeddedRollFont,
      color: rgb(rollColorRgb.r, rollColorRgb.g, rollColorRgb.b)
    });
  }

  return await targetDoc.save();
}

/**
 * Batch generates certificates for an array of student rows and bundles them into a ZIP archive.
 *
 * @param {Object} params
 * @param {Buffer} params.templateBuffer - Master template buffer
 * @param {string} params.templateMime - MIME type of template
 * @param {Array<Object>} params.students - Array of student records
 * @param {string} params.nameColumn - Column key for student name
 * @param {string} params.rollNumberColumn - Column key for roll number
 * @param {Object} params.fields - Visual field layout { nameField, rollNumberField }
 * @param {Function} [params.onProgress] - Callback for generation progress
 * @returns {Promise<Buffer>} Complete ZIP archive buffer
 */
export async function generateBatchZip({
  templateBuffer,
  templateMime = 'image/png',
  students = [],
  nameColumn = 'Student Name',
  rollNumberColumn = 'Roll Number',
  fields = {},
  onProgress
}) {
  if (!students || students.length === 0) {
    throw new Error('No student data provided for batch generation.');
  }

  return new Promise(async (resolve, reject) => {
    try {
      const archive = archiver('zip', { zlib: { level: 6 } });
      const chunks = [];

      archive.on('data', chunk => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', err => reject(err));

      const usedFilenames = new Map();

      for (let i = 0; i < students.length; i++) {
        const row = students[i];
        const studentName = String(row[nameColumn] || `Student_${i + 1}`).trim();
        const rollNumber = String(row[rollNumberColumn] || '').trim();

        // 1. Generate individual certificate PDF bytes
        const pdfBytes = await generateSingleCertificate({
          templateBuffer,
          templateMime,
          studentName,
          rollNumber,
          fields
        });

        // 2. Format sanitized filename: <Student_Name>.pdf
        let baseFilename = sanitizeFilename(studentName, `Student_${i + 1}`);

        // Handle duplicates gracefully by appending count
        let finalFilename = `${baseFilename}.pdf`;
        if (usedFilenames.has(finalFilename)) {
          const count = usedFilenames.get(finalFilename) + 1;
          usedFilenames.set(finalFilename, count);
          finalFilename = `${baseFilename}_${count}.pdf`;
        } else {
          usedFilenames.set(finalFilename, 1);
        }

        // 3. Append to ZIP stream
        archive.append(Buffer.from(pdfBytes), { name: finalFilename });

        if (typeof onProgress === 'function') {
          onProgress({
            current: i + 1,
            total: students.length,
            percent: Math.round(((i + 1) / students.length) * 100),
            studentName
          });
        }
      }

      // Finalize ZIP archive
      await archive.finalize();
    } catch (err) {
      reject(err);
    }
  });
}

