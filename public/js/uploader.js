/**
 * Bulk Certify - File Upload & Template Processing Engine
 * Supports PNG, JPG, and single-page PDF rendering via PDF.js.
 */

export class TemplateUploader {
  constructor(options = {}) {
    this.onTemplateReady = options.onTemplateReady || (() => {});
    this.onError = options.onError || console.error;
    this.currentFile = null;
    this.currentDataUrl = null;
    this.isPdf = false;
  }

  /**
   * Process a dropped or selected file.
   */
  async handleFile(file) {
    if (!file) return;

    this.currentFile = file;
    const mime = file.type || '';

    try {
      if (mime === 'application/pdf' || file.name.endsWith('.pdf')) {
        this.isPdf = true;
        const renderedDataUrl = await this.renderPdfPageToImage(file);
        this.currentDataUrl = renderedDataUrl;
        this.onTemplateReady({
          file,
          dataUrl: renderedDataUrl,
          isPdf: true,
          name: file.name
        });
      } else if (file.type.startsWith('image/') || file.name.match(/\.(png|jpe?g|svg)$/i)) {
        this.isPdf = false;
        const dataUrl = await this.readFileAsDataUrl(file);
        this.currentDataUrl = dataUrl;
        this.onTemplateReady({
          file,
          dataUrl,
          isPdf: false,
          name: file.name
        });
      } else {
        throw new Error('Unsupported template format. Please upload PNG, JPG, or PDF.');
      }
    } catch (err) {
      this.onError(err);
    }
  }

  /**
   * Reads standard image file into base64 DataURL.
   */
  readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Renders the first page of a PDF file to high-resolution PNG DataURL using PDF.js.
   */
  async renderPdfPageToImage(file) {
    if (!window.pdfjsLib) {
      throw new Error('PDF rendering library is still initializing. Please wait a moment.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    const pdfDoc = await loadingTask.promise;

    if (pdfDoc.numPages < 1) {
      throw new Error('The uploaded PDF has no pages.');
    }

    // Get 1st page
    const page = await pdfDoc.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for crisp sharpness

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    return canvas.toDataURL('image/png');
  }

  /**
   * Loads the pre-packaged sample certificate SVG or PDF.
   */
  async loadSampleTemplate() {
    try {
      const response = await fetch('/assets/sample-template.svg');
      if (!response.ok) throw new Error('Sample template file not found.');
      const svgText = await response.text();

      // Convert SVG string to data URL
      const blob = new Blob([svgText], { type: 'image/svg+xml' });
      const sampleFile = new File([blob], 'sample-certificate-template.svg', { type: 'image/svg+xml' });

      return this.handleFile(sampleFile);
    } catch (err) {
      this.onError(err);
    }
  }
}

