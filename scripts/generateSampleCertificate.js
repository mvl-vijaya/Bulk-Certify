import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const assetsDir = path.resolve(__dirname, '../public/assets');

async function createSamplePdf() {
  const pdfDoc = await PDFDocument.create();
  // Standard A4 Landscape: 841.89 x 595.28 points
  const width = 842;
  const height = 595;
  const page = pdfDoc.addPage([width, height]);

  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Background cream color
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(0.99, 0.985, 0.96)
  });

  // Outer border (Navy Gold accent)
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderColor: rgb(0.12, 0.23, 0.54), // Navy
    borderWidth: 4
  });

  // Inner border
  page.drawRectangle({
    x: 35,
    y: 35,
    width: width - 70,
    height: height - 70,
    borderColor: rgb(0.78, 0.62, 0.25), // Gold
    borderWidth: 1.5
  });

  // Certificate Header
  const title = 'CERTIFICATE OF ACHIEVEMENT';
  const titleWidth = timesBold.widthOfTextAtSize(title, 30);
  page.drawText(title, {
    x: (width - titleWidth) / 2,
    y: height - 110,
    size: 30,
    font: timesBold,
    color: rgb(0.12, 0.23, 0.54)
  });

  // Subtitle
  const subtitle = 'PROUDLY PRESENTED TO';
  const subWidth = helvetica.widthOfTextAtSize(subtitle, 12);
  page.drawText(subtitle, {
    x: (width - subWidth) / 2,
    y: height - 160,
    size: 12,
    font: helvetica,
    color: rgb(0.5, 0.5, 0.5)
  });

  // 1st DASHED LINE FOR STUDENT NAME
  // Centered from x=150 to x=692 (width 542)
  const line1Y = height - 250;
  // Draw dashed baseline
  const dashLength = 8;
  const spaceLength = 5;
  const startX1 = 150;
  const endX1 = 692;
  for (let x = startX1; x < endX1; x += dashLength + spaceLength) {
    page.drawLine({
      start: { x, y: line1Y },
      end: { x: Math.min(x + dashLength, endX1), y: line1Y },
      thickness: 1.5,
      color: rgb(0.4, 0.45, 0.55)
    });
  }

  // Label under 1st dashed line
  const nameLabel = '(Recipient Full Name)';
  const nameLabelWidth = timesItalic.widthOfTextAtSize(nameLabel, 10);
  page.drawText(nameLabel, {
    x: (width - nameLabelWidth) / 2,
    y: line1Y - 18,
    size: 10,
    font: timesItalic,
    color: rgb(0.55, 0.55, 0.6)
  });

  // Body text
  const bodyText = 'for outstanding dedication, academic excellence, and successful completion of the course';
  const bodyWidth = timesRoman.widthOfTextAtSize(bodyText, 14);
  page.drawText(bodyText, {
    x: (width - bodyWidth) / 2,
    y: height - 315,
    size: 14,
    font: timesRoman,
    color: rgb(0.25, 0.25, 0.3)
  });

  // 2nd DASHED LINE FOR ROLL NUMBER / REGISTRATION ID
  const line2Y = height - 380;
  const startX2 = 270;
  const endX2 = 572;
  for (let x = startX2; x < endX2; x += dashLength + spaceLength) {
    page.drawLine({
      start: { x, y: line2Y },
      end: { x: Math.min(x + dashLength, endX2), y: line2Y },
      thickness: 1.2,
      color: rgb(0.4, 0.45, 0.55)
    });
  }

  const rollLabel = '(Roll / Registration Number)';
  const rollLabelWidth = timesItalic.widthOfTextAtSize(rollLabel, 10);
  page.drawText(rollLabel, {
    x: (width - rollLabelWidth) / 2,
    y: line2Y - 18,
    size: 10,
    font: timesItalic,
    color: rgb(0.55, 0.55, 0.6)
  });

  // Signature lines
  // Left: Authorized Director
  page.drawLine({
    start: { x: 120, y: 110 },
    end: { x: 280, y: 110 },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.3)
  });
  const sig1 = 'Program Director';
  page.drawText(sig1, {
    x: 155,
    y: 92,
    size: 11,
    font: helvetica,
    color: rgb(0.35, 0.35, 0.4)
  });

  // Right: Examination Head
  page.drawLine({
    start: { x: 560, y: 110 },
    end: { x: 720, y: 110 },
    thickness: 1,
    color: rgb(0.3, 0.3, 0.3)
  });
  const sig2 = 'Dean of Academic Affairs';
  page.drawText(sig2, {
    x: 570,
    y: 92,
    size: 11,
    font: helvetica,
    color: rgb(0.35, 0.35, 0.4)
  });

  const pdfBytes = await pdfDoc.save();
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  fs.writeFileSync(path.join(assetsDir, 'sample-template.pdf'), pdfBytes);
  console.log('Created sample-template.pdf successfully!');
}

createSamplePdf().catch(err => {
  console.error('Error creating sample certificate:', err);
});

