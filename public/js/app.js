import { CanvasEditor } from './canvasEditor.js';
import { TemplateUploader } from './uploader.js';

/**
 * Bulk Certify - Main Frontend Application Controller
 * Coordinates the 5-step workflow, Gemini AI alignment, and bulk PDF generation.
 */

class BulkCertifyApp {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;

    // State
    this.templateData = {
      file: null,
      dataUrl: null,
      isPdf: false,
      mimeType: 'image/png'
    };

    this.spreadsheetData = {
      file: null,
      headers: [],
      rows: [],
      nameColumn: '',
      rollNumberColumn: '',
      totalRows: 0
    };

    this.canvasEditor = null;
    this.templateUploader = null;
    this.geminiApiKey = sessionStorage.getItem('BULK_CERTIFY_GEMINI_KEY') || '';

    this.init();
  }

  init() {
    this.setupStepper();
    this.setupCanvas();
    this.setupTemplateUpload();
    this.setupSpreadsheetUpload();
    this.setupFieldControls();
    this.setupGeminiModal();
    this.setupGeneration();
  }

  // ==========================================
  // STEPPER NAVIGATION
  // ==========================================
  setupStepper() {
    this.updateStepUI();

    // Step navigation buttons
    document.getElementById('nextToStep2')?.addEventListener('click', () => {
      if (!this.templateData.dataUrl) {
        this.showToast('Please upload or select a certificate template first.', 'warning');
        return;
      }
      this.goToStep(2);
    });

    document.getElementById('prevToStep1')?.addEventListener('click', () => this.goToStep(1));

    document.getElementById('nextToStep3')?.addEventListener('click', () => {
      if (!this.spreadsheetData.rows.length) {
        this.showToast('Please upload an Excel or CSV file first.', 'warning');
        return;
      }
      this.goToStep(3);
    });

    document.getElementById('prevToStep2')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('nextToStep4')?.addEventListener('click', () => this.goToStep(4));
    document.getElementById('prevToStep3')?.addEventListener('click', () => this.goToStep(3));
    document.getElementById('startNewBatch')?.addEventListener('click', () => this.goToStep(1));
  }

  goToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > this.totalSteps) return;

    this.currentStep = stepNumber;
    this.updateStepUI();

    // Trigger canvas render when entering Step 3
    if (stepNumber === 3 && this.canvasEditor && this.templateData.dataUrl) {
      setTimeout(() => {
        this.canvasEditor.render();
      }, 50);
    }
  }

  updateStepUI() {
    // Update step containers visibility
    for (let i = 1; i <= this.totalSteps; i++) {
      const el = document.getElementById(`stepContainer${i}`);
      if (el) {
        if (i === this.currentStep) {
          el.classList.remove('hidden');
          el.classList.add('block');
        } else {
          el.classList.add('hidden');
          el.classList.remove('block');
        }
      }

      // Update stepper header indicators
      const stepItem = document.getElementById(`stepHeader${i}`);
      if (stepItem) {
        stepItem.classList.remove('active', 'completed');
        if (i < this.currentStep) {
          stepItem.classList.add('completed');
        } else if (i === this.currentStep) {
          stepItem.classList.add('active');
        }
      }
    }

    // Scroll to top of content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // STEP 1: TEMPLATE UPLOAD
  // ==========================================
  setupTemplateUpload() {
    const dropzone = document.getElementById('templateDropzone');
    const fileInput = document.getElementById('templateFileInput');
    const loadSampleBtn = document.getElementById('loadSampleTemplateBtn');

    this.templateUploader = new TemplateUploader({
      onTemplateReady: async (data) => {
        this.templateData = {
          file: data.file,
          dataUrl: data.dataUrl,
          isPdf: data.isPdf,
          mimeType: data.file.type || 'image/png'
        };

        // Update preview in Step 1
        const previewImg = document.getElementById('templatePreviewImg');
        const previewContainer = document.getElementById('templatePreviewContainer');
        const filenameLabel = document.getElementById('templateFilenameLabel');

        if (previewImg && previewContainer) {
          previewImg.src = data.dataUrl;
          previewContainer.classList.remove('hidden');
          if (filenameLabel) filenameLabel.textContent = data.name;
        }

        // Load into Step 3 canvas
        if (this.canvasEditor) {
          await this.canvasEditor.loadTemplate(data.dataUrl);
        }

        this.showToast('Certificate template loaded successfully!', 'success');
      },
      onError: (err) => {
        this.showToast(err.message, 'error');
      }
    });

    // File input change (triggered natively by <label for="templateFileInput">)
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        this.templateUploader.handleFile(file);
        fileInput.value = '';
      }
    });

    // Drag and drop events
    ['dragenter', 'dragover'].forEach(name => {
      dropzone?.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone?.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone?.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) this.templateUploader.handleFile(file);
    });

    // Load sample template button
    loadSampleBtn?.addEventListener('click', async () => {
      loadSampleBtn.disabled = true;
      loadSampleBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg> Loading Sample...
      `;
      try {
        await this.templateUploader.loadSampleTemplate();
      } finally {
        loadSampleBtn.disabled = false;
        loadSampleBtn.innerHTML = `⚡ Load Sample Certificate Template`;
      }
    });
  }

  // ==========================================
  // STEP 2: SPREADSHEET UPLOAD
  // ==========================================
  setupSpreadsheetUpload() {
    const dropzone = document.getElementById('dataDropzone');
    const fileInput = document.getElementById('dataFileInput');
    const loadSampleDataBtn = document.getElementById('loadSampleDataBtn');

    // High-speed client-side spreadsheet parser using SheetJS (runs 100% in-browser)
    const parseClientSide = async (file) => {
      if (!window.XLSX) return null;
      const arrayBuffer = await file.arrayBuffer();
      const workbook = window.XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('Spreadsheet has no readable sheets.');

      const worksheet = workbook.Sheets[firstSheetName];
      const rawRows = window.XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rawRows || rawRows.length === 0) throw new Error('Spreadsheet appears to be empty.');

      const rawHeaders = rawRows[0] || [];
      const headers = rawHeaders
        .map((h, idx) => (h ? String(h).trim() : `Column_${idx + 1}`))
        .filter(Boolean);

      if (headers.length === 0) throw new Error('No valid column headers found.');

      const allRows = [];
      for (let i = 1; i < rawRows.length; i++) {
        const rowArray = rawRows[i];
        const hasData = rowArray && rowArray.some(val => val !== null && val !== undefined && String(val).trim() !== '');
        if (!hasData) continue;

        const rowObj = {};
        headers.forEach((header, colIndex) => {
          const val = rowArray[colIndex];
          rowObj[header] = val !== undefined && val !== null ? String(val).trim() : '';
        });
        allRows.push(rowObj);
      }

      if (allRows.length === 0) throw new Error('No student data rows found below the header row.');

      // Intelligent column heuristic detection
      const nameKeywords = ['student name', 'student_name', 'name', 'full name', 'fullname', 'candidate', 'recipient', 'participant'];
      const rollKeywords = ['roll no', 'roll_no', 'roll number', 'roll', 'registration no', 'reg no', 'reg_no', 'student id', 'id', 'enrollment'];

      let nameColumn = headers[0];
      let rollNumberColumn = headers[1] || headers[0];
      const lowerHeaders = headers.map(h => h.toLowerCase().trim());

      for (const kw of nameKeywords) {
        const idx = lowerHeaders.findIndex(h => h === kw || h.includes(kw));
        if (idx !== -1) { nameColumn = headers[idx]; break; }
      }
      for (const kw of rollKeywords) {
        const idx = lowerHeaders.findIndex(h => h === kw || h.includes(kw));
        if (idx !== -1 && headers[idx] !== nameColumn) { rollNumberColumn = headers[idx]; break; }
      }

      return {
        headers,
        totalRows: allRows.length,
        previewRows: allRows.slice(0, 10),
        allRows,
        suggestedMapping: { nameColumn, rollNumberColumn }
      };
    };

    const handleDataFile = async (file) => {
      if (!file) return;

      this.showToast('Processing spreadsheet data...', 'info');

      try {
        let parsedData = null;

        // 1. Try instant client-side parsing first (fastest, offline-resilient, zero server overhead)
        try {
          parsedData = await parseClientSide(file);
        } catch (clientErr) {
          console.warn('Client-side parsing fallback to API:', clientErr);
        }

        // 2. If client-side was unavailable, fallback to backend API
        if (!parsedData) {
          const formData = new FormData();
          formData.append('dataFile', file);

          const res = await fetch('/api/parse-data', {
            method: 'POST',
            body: formData
          });

          if (!res.ok) {
            const errorText = await res.text();
            let errorMsg = `Server error (${res.status})`;
            try {
              const json = JSON.parse(errorText);
              errorMsg = json.error || errorMsg;
            } catch {
              errorMsg = errorText.slice(0, 100) || errorMsg;
            }
            throw new Error(errorMsg);
          }

          parsedData = await res.json();
          if (!parsedData.success) throw new Error(parsedData.error || 'Failed to parse spreadsheet.');
        }

        this.spreadsheetData = {
          file,
          headers: parsedData.headers,
          rows: parsedData.allRows,
          nameColumn: parsedData.suggestedMapping.nameColumn,
          rollNumberColumn: parsedData.suggestedMapping.rollNumberColumn,
          totalRows: parsedData.totalRows
        };

        this.renderSpreadsheetPreview(parsedData);
        this.populateColumnSelectors(parsedData.headers, parsedData.suggestedMapping);

        // Update sample text in canvas editor with real 1st row data
        if (parsedData.allRows.length > 0) {
          const first = parsedData.allRows[0];
          if (this.canvasEditor) {
            this.canvasEditor.fields.nameField.sampleText = first[this.spreadsheetData.nameColumn] || 'Alexander Montgomery';
            this.canvasEditor.fields.rollNumberField.sampleText = first[this.spreadsheetData.rollNumberColumn] || 'CS-2026-101';
            this.canvasEditor.render();
          }
        }

        this.showToast(`Loaded ${parsedData.totalRows} student records successfully!`, 'success');
      } catch (err) {
        this.showToast(err.message, 'error');
      }
    };

    // File input change (triggered natively by <label for="dataFileInput">)
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleDataFile(file);
        fileInput.value = '';
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropzone?.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dropzone?.addEventListener(name, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone?.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file) handleDataFile(file);
    });

    // Load sample student CSV
    loadSampleDataBtn?.addEventListener('click', async () => {
      try {
        const res = await fetch('/assets/sample-students.csv');
        const csvBlob = await res.blob();
        const sampleCsvFile = new File([csvBlob], 'sample-students.csv', { type: 'text/csv' });
        handleDataFile(sampleCsvFile);
      } catch (err) {
        this.showToast('Could not load sample CSV file.', 'error');
      }
    });
  }

  renderSpreadsheetPreview(data) {
    const previewContainer = document.getElementById('dataPreviewContainer');
    const tableHeader = document.getElementById('dataTableHeader');
    const tableBody = document.getElementById('dataTableBody');
    const rowCountBadge = document.getElementById('totalRowCountBadge');

    if (!previewContainer) return;
    previewContainer.classList.remove('hidden');

    if (rowCountBadge) {
      rowCountBadge.textContent = `${data.totalRows} Students Detected`;
    }

    // Build Table Header
    if (tableHeader) {
      tableHeader.innerHTML = data.headers
        .map(h => `<th class="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">${h}</th>`)
        .join('');
    }

    // Build Table Body (preview first 5 rows)
    if (tableBody) {
      tableBody.innerHTML = data.previewRows
        .slice(0, 5)
        .map((row, idx) => {
          const cells = data.headers
            .map(h => `<td class="px-4 py-3 whitespace-nowrap text-sm text-slate-600">${row[h] || '-'}</td>`)
            .join('');
          return `<tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} hover:bg-indigo-50 transition-colors">${cells}</tr>`;
        })
        .join('');
    }
  }

  populateColumnSelectors(headers, mapping) {
    const nameSelect = document.getElementById('nameColumnSelect');
    const rollSelect = document.getElementById('rollColumnSelect');

    const optionsHtml = headers
      .map(h => `<option value="${h}">${h}</option>`)
      .join('');

    if (nameSelect) {
      nameSelect.innerHTML = optionsHtml;
      nameSelect.value = mapping.nameColumn || headers[0];
      nameSelect.addEventListener('change', (e) => {
        this.spreadsheetData.nameColumn = e.target.value;
        this.updateCanvasSampleText();
      });
    }

    if (rollSelect) {
      rollSelect.innerHTML = optionsHtml;
      rollSelect.value = mapping.rollNumberColumn || headers[1] || headers[0];
      rollSelect.addEventListener('change', (e) => {
        this.spreadsheetData.rollNumberColumn = e.target.value;
        this.updateCanvasSampleText();
      });
    }
  }

  updateCanvasSampleText() {
    if (!this.canvasEditor || !this.spreadsheetData.rows.length) return;
    const firstRow = this.spreadsheetData.rows[0];
    const nameVal = firstRow[this.spreadsheetData.nameColumn];
    const rollVal = firstRow[this.spreadsheetData.rollNumberColumn];

    if (nameVal) this.canvasEditor.fields.nameField.sampleText = nameVal;
    if (rollVal) this.canvasEditor.fields.rollNumberField.sampleText = rollVal;
    this.canvasEditor.render();
  }

  // ==========================================
  // STEP 3: CANVAS & FIELD CONTROLS
  // ==========================================
  setupCanvas() {
    const canvasEl = document.getElementById('certificateCanvas');
    if (!canvasEl) return;

    this.canvasEditor = new CanvasEditor(canvasEl, {
      onFieldChange: (field) => this.syncControlsWithField(field),
      onFieldSelect: (field) => {
        this.syncControlsWithField(field);
        this.updateFieldTabButtons(field.id);
      }
    });

    // Tab buttons to toggle between editing Name vs Roll Number
    document.getElementById('selectNameFieldTab')?.addEventListener('click', () => {
      this.canvasEditor.setActiveField('nameField');
      this.updateFieldTabButtons('nameField');
    });

    document.getElementById('selectRollFieldTab')?.addEventListener('click', () => {
      this.canvasEditor.setActiveField('rollNumberField');
      this.updateFieldTabButtons('rollNumberField');
    });

    // Toggle sample text preview
    const sampleToggle = document.getElementById('toggleSampleTextCheckbox');
    sampleToggle?.addEventListener('change', (e) => {
      this.canvasEditor.showSampleText = e.target.checked;
      this.canvasEditor.render();
    });

    // Preview Single PDF modal button
    document.getElementById('previewSinglePdfBtn')?.addEventListener('click', () => this.generatePreviewPdf());
  }

  updateFieldTabButtons(activeId) {
    const nameTab = document.getElementById('selectNameFieldTab');
    const rollTab = document.getElementById('selectRollFieldTab');

    if (activeId === 'nameField') {
      nameTab?.classList.add('bg-indigo-600', 'text-white', 'shadow');
      nameTab?.classList.remove('bg-slate-100', 'text-slate-600');
      rollTab?.classList.remove('bg-indigo-600', 'text-white', 'shadow');
      rollTab?.classList.add('bg-slate-100', 'text-slate-600');
    } else {
      rollTab?.classList.add('bg-indigo-600', 'text-white', 'shadow');
      rollTab?.classList.remove('bg-slate-100', 'text-slate-600');
      nameTab?.classList.remove('bg-indigo-600', 'text-white', 'shadow');
      nameTab?.classList.add('bg-slate-100', 'text-slate-600');
    }
  }

  setupFieldControls() {
    const bindControl = (id, property, parser = (v) => v) => {
      const el = document.getElementById(id);
      el?.addEventListener('input', (e) => {
        this.canvasEditor.updateActiveField({ [property]: parser(e.target.value) });
      });
    };

    bindControl('controlFontSize', 'fontSize', v => Number(v));
    bindControl('controlFontFamily', 'fontFamily');
    bindControl('controlTextColor', 'textColor');
    bindControl('controlAlignment', 'alignment');
    bindControl('controlYOffset', 'yOffset', v => Number(v));
    bindControl('controlXPercent', 'xPercent', v => Number(v));
    bindControl('controlYPercent', 'yPercent', v => Number(v));
    bindControl('controlWidthPercent', 'widthPercent', v => Number(v));
    bindControl('controlHeightPercent', 'heightPercent', v => Number(v));
  }

  syncControlsWithField(field) {
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && document.activeElement !== el) el.value = val;
    };

    setVal('controlFontSize', field.fontSize);
    setVal('controlFontFamily', field.fontFamily);
    setVal('controlTextColor', field.textColor);
    setVal('controlAlignment', field.alignment);
    setVal('controlYOffset', field.yOffset || 0);
    setVal('controlXPercent', field.xPercent);
    setVal('controlYPercent', field.yPercent);
    setVal('controlWidthPercent', field.widthPercent);
    setVal('controlHeightPercent', field.heightPercent);

    // Update labels showing percentage readout
    const xVal = document.getElementById('xPercentVal');
    const yVal = document.getElementById('yPercentVal');
    const wVal = document.getElementById('wPercentVal');
    if (xVal) xVal.textContent = `${field.xPercent}%`;
    if (yVal) yVal.textContent = `${field.yPercent}%`;
    if (wVal) wVal.textContent = `${field.widthPercent}%`;
  }

  // ==========================================
  // GEMINI VISION AI ALIGNMENT
  // ==========================================
  setupGeminiModal() {
    const triggerBtn = document.getElementById('geminiDetectBtn');
    const modal = document.getElementById('geminiModal');
    const cancelBtn = document.getElementById('geminiModalCancel');
    const submitBtn = document.getElementById('geminiModalSubmit');
    const apiKeyInput = document.getElementById('geminiApiKeyInput');

    if (apiKeyInput && this.geminiApiKey) {
      apiKeyInput.value = this.geminiApiKey;
    }

    triggerBtn?.addEventListener('click', () => {
      modal?.classList.remove('hidden');
      modal?.classList.add('flex');
    });

    cancelBtn?.addEventListener('click', () => {
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
    });

    submitBtn?.addEventListener('click', async () => {
      const enteredKey = apiKeyInput?.value.trim() || '';
      if (enteredKey) {
        this.geminiApiKey = enteredKey;
        sessionStorage.setItem('BULK_CERTIFY_GEMINI_KEY', enteredKey);
      }

      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
      await this.runGeminiVisionDetection();
    });
  }

  async runGeminiVisionDetection() {
    const triggerBtn = document.getElementById('geminiDetectBtn');
    if (!this.templateData.dataUrl) {
      this.showToast('Please upload a template first before running AI detection.', 'warning');
      return;
    }

    const originalText = triggerBtn.innerHTML;
    triggerBtn.disabled = true;
    triggerBtn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg> Analyzing Template with Gemini Vision...
    `;

    try {
      this.showToast('Analyzing certificate layout with Gemini Vision...', 'info');

      const payload = {
        imageBase64: this.templateData.dataUrl,
        mimeType: this.templateData.mimeType,
        apiKey: this.geminiApiKey
      };

      const res = await fetch('/api/analyze-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gemini-api-key': this.geminiApiKey
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `Server error (${res.status})`;
        try {
          const json = JSON.parse(errorText);
          errorMsg = json.error || errorMsg;
        } catch {
          errorMsg = errorText.slice(0, 100) || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (!data.success && !data.fields) {
        throw new Error(data.error || 'Gemini Vision detection failed.');
      }

      // Apply detected coordinates to Canvas
      this.canvasEditor.applyGeminiCoordinates(data.fields);

      if (data.mode === 'gemini_vision') {
        this.showToast('✨ Gemini Vision accurately aligned Name and Roll Number baselines!', 'success');
      } else {
        this.showToast(data.message, 'info');
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      triggerBtn.disabled = false;
      triggerBtn.innerHTML = originalText;
    }
  }

  // ==========================================
  // LIVE PDF PREVIEW
  // ==========================================
  async generatePreviewPdf() {
    const previewBtn = document.getElementById('previewSinglePdfBtn');
    const originalText = previewBtn.innerHTML;
    previewBtn.disabled = true;
    previewBtn.innerHTML = `Generating Preview...`;

    try {
      const sampleRow = this.spreadsheetData.rows[0] || {};
      const sampleName = sampleRow[this.spreadsheetData.nameColumn] || 'Alexander Montgomery-Fitzgerald';
      const sampleRoll = sampleRow[this.spreadsheetData.rollNumberColumn] || 'CS-2026-103';

      const payload = {
        templateBase64: this.templateData.dataUrl,
        templateMime: this.templateData.mimeType,
        sampleName,
        sampleRoll,
        fields: JSON.stringify(this.canvasEditor.fields)
      };

      const res = await fetch('/api/preview-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `Failed to generate preview (${res.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorMsg;
        } catch {
          errorMsg = errorText.slice(0, 100) || errorMsg;
        }
        throw new Error(errorMsg);
      }

      const pdfBlob = await res.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Open preview in new tab
      window.open(pdfUrl, '_blank');
      this.showToast('Preview PDF generated and opened in a new tab!', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      previewBtn.disabled = false;
      previewBtn.innerHTML = originalText;
    }
  }

  // ==========================================
  // STEP 4 & 5: BATCH GENERATION & DOWNLOAD
  // ==========================================
  setupGeneration() {
    const generateBtn = document.getElementById('startBatchGenerateBtn');

    generateBtn?.addEventListener('click', async () => {
      await this.runBatchGeneration();
    });
  }

  async runBatchGeneration() {
    const generateBtn = document.getElementById('startBatchGenerateBtn');
    const progressBar = document.getElementById('batchProgressBar');
    const progressPercent = document.getElementById('batchProgressPercent');
    const progressStatus = document.getElementById('batchProgressStatus');

    if (!this.templateData.dataUrl) {
      this.showToast('Missing certificate template.', 'error');
      return;
    }

    if (!this.spreadsheetData.rows.length) {
      this.showToast('Missing student spreadsheet records.', 'error');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = `Generating Certificates...`;

    // Reset progress UI
    if (progressBar) progressBar.style.width = '15%';
    if (progressPercent) progressPercent.textContent = '15%';
    if (progressStatus) progressStatus.textContent = `Packaging ${this.spreadsheetData.rows.length} certificates...`;

    try {
      const payload = {
        templateBase64: this.templateData.dataUrl,
        templateMime: this.templateData.mimeType,
        students: JSON.stringify(this.spreadsheetData.rows),
        nameColumn: this.spreadsheetData.nameColumn,
        rollNumberColumn: this.spreadsheetData.rollNumberColumn,
        fields: JSON.stringify(this.canvasEditor.fields)
      };

      // Progress animation ticker
      let simPercent = 20;
      const interval = setInterval(() => {
        if (simPercent < 85) {
          simPercent += 5;
          if (progressBar) progressBar.style.width = `${simPercent}%`;
          if (progressPercent) progressPercent.textContent = `${simPercent}%`;
        }
      }, 300);

      const res = await fetch('/api/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(interval);

      if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = `Batch generation failed (${res.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMsg = errorJson.error || errorMsg;
        } catch {
          errorMsg = errorText.slice(0, 100) || errorMsg;
        }
        throw new Error(errorMsg);
      }

      if (progressBar) progressBar.style.width = '100%';
      if (progressPercent) progressPercent.textContent = '100%';
      if (progressStatus) progressStatus.textContent = 'All certificates generated successfully!';

      const zipBlob = await res.blob();
      const zipUrl = URL.createObjectURL(zipBlob);

      // Populate Step 5 download section
      this.setupDownloadSection(zipUrl, zipBlob.size);
      this.goToStep(5);
      this.showToast('🎉 Batch PDF generation completed successfully!', 'success');
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = `🚀 Start Batch Generation`;
    }
  }

  setupDownloadSection(zipUrl, zipSize) {
    const downloadZipBtn = document.getElementById('downloadAllZipBtn');
    const zipSizeLabel = document.getElementById('zipFileSizeLabel');
    const tableBody = document.getElementById('downloadTableBody');
    const countLabel = document.getElementById('downloadCountLabel');

    if (downloadZipBtn) {
      downloadZipBtn.href = zipUrl;
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadZipBtn.download = `BulkCertificates_${timestamp}.zip`;
    }

    if (zipSizeLabel) {
      const mb = (zipSize / (1024 * 1024)).toFixed(2);
      zipSizeLabel.textContent = `ZIP Archive Size: ${mb} MB`;
    }

    if (countLabel) {
      countLabel.textContent = `${this.spreadsheetData.rows.length} Certificates Ready`;
    }

    // Render individual download rows
    if (tableBody) {
      tableBody.innerHTML = this.spreadsheetData.rows.map((row, idx) => {
        const name = row[this.spreadsheetData.nameColumn] || `Student_${idx + 1}`;
        const roll = row[this.spreadsheetData.rollNumberColumn] || '-';

        return `
          <tr class="hover:bg-slate-50 transition-colors border-b border-slate-100">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">${idx + 1}. ${name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">${roll}</td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Ready
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
              <button data-student-index="${idx}" class="download-single-btn px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-md transition-colors">
                Download PDF
              </button>
            </td>
          </tr>
        `;
      }).join('');

      // Attach single download event listeners
      tableBody.querySelectorAll('.download-single-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const idx = Number(btn.getAttribute('data-student-index'));
          await this.downloadSingleStudentPdf(idx, btn);
        });
      });
    }
  }

  async downloadSingleStudentPdf(index, btnEl) {
    const row = this.spreadsheetData.rows[index];
    if (!row) return;

    const originalText = btnEl.textContent;
    btnEl.disabled = true;
    btnEl.textContent = 'Downloading...';

    try {
      const studentName = row[this.spreadsheetData.nameColumn] || `Student_${index + 1}`;
      const rollNumber = row[this.spreadsheetData.rollNumberColumn] || '';

      const payload = {
        templateBase64: this.templateData.dataUrl,
        templateMime: this.templateData.mimeType,
        studentName,
        rollNumber,
        fields: JSON.stringify(this.canvasEditor.fields)
      };

      const res = await fetch('/api/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to generate individual certificate.');

      const pdfBlob = await res.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${studentName.replace(/[/\\?%*:|"<>]/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      btnEl.disabled = false;
      btnEl.textContent = originalText;
    }
  }

  // Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    const colors = {
      success: 'bg-emerald-600 text-white',
      error: 'bg-rose-600 text-white',
      warning: 'bg-amber-500 text-white',
      info: 'bg-indigo-600 text-white'
    };

    toast.className = `flex items-center px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0 ${colors[type] || colors.info}`;
    toast.textContent = message;

    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Initialize application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.bulkCertifyApp = new BulkCertifyApp();
});

