/**
 * Bulk Certify - Coordinate Converter & Text Layout Engine
 *
 * CRITICAL LOGIC EXPLANATION:
 * 1. Web Canvas Origin: Top-Left (0, 0).
 *    - X increases from Left (0%) to Right (100%).
 *    - Y increases from Top (0%) to Bottom (100%).
 *
 * 2. PDF-Lib Origin: Bottom-Left (0, 0).
 *    - X increases from Left (0) to Right (pageWidth).
 *    - Y increases from Bottom (0) to Top (pageHeight).
 *
 * 3. Conversion Formula:
 *    - boxX = (field.xPercent / 100) * pageWidth
 *    - boxYTop = pageHeight - ((field.yPercent / 100) * pageHeight)
 *    - boxWidth = (field.widthPercent / 100) * pageWidth
 *    - boxHeight = (field.heightPercent / 100) * pageHeight
 *    - boxYBottom = boxYTop - boxHeight
 *
 * 4. Baseline Alignment:
 *    - Text baseline in PDF is where the glyphs rest (excluding descenders like 'g', 'y', 'p').
 *    - To place text neatly on the dashed line, we align with the lower section of the box
 *      plus an optional user-defined yOffset points.
 */

/**
 * Calculates the exact PDF rendering parameters for a text overlay.
 *
 * @param {Object} params
 * @param {string} params.text - The actual text string (e.g., student name)
 * @param {Object} params.field - Field config { xPercent, yPercent, widthPercent, heightPercent, alignment, fontSize, fontColor, yOffset, xOffset }
 * @param {number} params.pageWidth - PDF page width in points
 * @param {number} params.pageHeight - PDF page height in points
 * @param {Object} params.font - pdf-lib embedded PDFFont instance
 * @returns {Object} { x, y, fontSize, text, width, height }
 */
export function calculatePdfTextCoordinates({
  text = '',
  field = {},
  pageWidth = 842,
  pageHeight = 595,
  font
}) {
  const content = String(text || '').trim();
  const baseFontSize = Number(field.fontSize) || 28;
  const minFontSize = 10;

  // Normalized percentages (0 - 100)
  const xPercent = Number(field.xPercent) || 10;
  const yPercent = Number(field.yPercent) || 40;
  const widthPercent = Number(field.widthPercent) || 80;
  const heightPercent = Number(field.heightPercent) || 8;
  const alignment = (field.alignment || 'center').toLowerCase();
  const yOffset = Number(field.yOffset) || 0;
  const xOffset = Number(field.xOffset) || 0;

  // 1. Calculate bounding box dimensions in PDF points
  const boxX = (xPercent / 100) * pageWidth + xOffset;
  const boxWidth = (widthPercent / 100) * pageWidth;
  const boxHeight = (heightPercent / 100) * pageHeight;

  // 2. Invert Y coordinate for PDF coordinate space (Bottom-Left origin)
  // Top of box in PDF points:
  const boxYTop = pageHeight - ((yPercent / 100) * pageHeight);
  // Bottom of box in PDF points (near the dashed line):
  const boxYBottom = boxYTop - boxHeight;

  // 3. Dynamic Font Auto-Fitting Logic:
  // Measure text width at configured font size.
  // If the student's name is too long to fit inside the dashed line width,
  // dynamically scale down the font size so it fits with a 5% margin.
  let effectiveFontSize = baseFontSize;
  const maxAllowedWidth = Math.max(20, boxWidth * 0.95);

  if (content.length > 0 && font) {
    const measuredWidth = font.widthOfTextAtSize(content, baseFontSize);
    if (measuredWidth > maxAllowedWidth) {
      const scale = maxAllowedWidth / measuredWidth;
      effectiveFontSize = Math.max(minFontSize, Math.floor(baseFontSize * scale * 10) / 10);
    }
  }

  // Calculate final text width and height at effective font size
  const finalWidth = font && content.length > 0
    ? font.widthOfTextAtSize(content, effectiveFontSize)
    : 0;
  const fontHeight = font && content.length > 0
    ? font.heightAtSize(effectiveFontSize)
    : effectiveFontSize;

  // 4. Horizontal Alignment (Left, Center, Right)
  let finalX = boxX;
  if (alignment === 'center') {
    finalX = boxX + ((boxWidth - finalWidth) / 2);
  } else if (alignment === 'right') {
    finalX = boxX + boxWidth - finalWidth;
  } else {
    // 'left'
    finalX = boxX;
  }

  // 5. Vertical Baseline Placement
  // In pdf-lib, drawText(y) specifies the baseline of the text.
  // Position text so it rests comfortably above the bottom edge of the detected box (the dashed line)
  // plus yOffset points (positive moves text upwards, negative moves text downwards).
  const baselinePadding = Math.max(2, effectiveFontSize * 0.15);
  const finalY = boxYBottom + baselinePadding + yOffset;

  return {
    text: content,
    x: finalX,
    y: finalY,
    fontSize: effectiveFontSize,
    textWidth: finalWidth,
    boxX,
    boxYBottom,
    boxWidth,
    boxHeight
  };
}

