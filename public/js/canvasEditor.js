/**
 * Bulk Certify - Interactive Visual Field Mapping Canvas Engine
 * Enables manual drag-and-drop, box resizing, live font rendering, and AI alignment.
 */

export class CanvasEditor {
  constructor(canvasElement, options = {}) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');
    this.templateImage = null;

    // Field configurations stored in normalized percentages (0 - 100%)
    this.fields = {
      nameField: {
        id: 'nameField',
        label: 'Student Name (1st Line)',
        color: '#4f46e5', // Indigo
        textColor: '#1e3a8a',
        xPercent: 20,
        yPercent: 40,
        widthPercent: 60,
        heightPercent: 8,
        fontSize: 32,
        fontFamily: 'Helvetica-Bold',
        alignment: 'center',
        yOffset: 0,
        xOffset: 0,
        sampleText: 'Alexander Montgomery-Fitzgerald'
      },
      rollNumberField: {
        id: 'rollNumberField',
        label: 'Roll Number (2nd Line)',
        color: '#8b5cf6', // Violet
        textColor: '#374151',
        xPercent: 30,
        yPercent: 54,
        widthPercent: 40,
        heightPercent: 6,
        fontSize: 18,
        fontFamily: 'Helvetica',
        alignment: 'center',
        yOffset: 0,
        xOffset: 0,
        sampleText: 'CS-2026-103'
      }
    };

    this.activeFieldId = 'nameField';
    this.showSampleText = true;
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.dragStart = { x: 0, y: 0 };
    this.initialFieldState = null;

    this.onFieldChange = options.onFieldChange || (() => {});
    this.onFieldSelect = options.onFieldSelect || (() => {});

    this.initEvents();
  }

  /**
   * Load an image (or rendered PDF page) into the canvas.
   */
  async loadTemplate(imageSource) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.templateImage = img;
        this.canvas.width = img.naturalWidth || img.width;
        this.canvas.height = img.naturalHeight || img.height;
        this.render();
        resolve(img);
      };
      img.onerror = (e) => reject(new Error('Failed to load certificate template image.'));
      img.src = typeof imageSource === 'string' ? imageSource : URL.createObjectURL(imageSource);
    });
  }

  /**
   * Updates fields from Gemini Vision AI analysis.
   */
  applyGeminiCoordinates(geminiData) {
    if (!geminiData) return;

    if (geminiData.nameField) {
      this.fields.nameField.xPercent = Number(geminiData.nameField.xPercent) || this.fields.nameField.xPercent;
      this.fields.nameField.yPercent = Number(geminiData.nameField.yPercent) || this.fields.nameField.yPercent;
      this.fields.nameField.widthPercent = Number(geminiData.nameField.widthPercent) || this.fields.nameField.widthPercent;
      this.fields.nameField.heightPercent = Number(geminiData.nameField.heightPercent) || this.fields.nameField.heightPercent;
      if (geminiData.nameField.alignment) this.fields.nameField.alignment = geminiData.nameField.alignment;
      if (geminiData.nameField.suggestedFontSize) this.fields.nameField.fontSize = geminiData.nameField.suggestedFontSize;
    }

    if (geminiData.rollNumberField) {
      this.fields.rollNumberField.xPercent = Number(geminiData.rollNumberField.xPercent) || this.fields.rollNumberField.xPercent;
      this.fields.rollNumberField.yPercent = Number(geminiData.rollNumberField.yPercent) || this.fields.rollNumberField.yPercent;
      this.fields.rollNumberField.widthPercent = Number(geminiData.rollNumberField.widthPercent) || this.fields.rollNumberField.widthPercent;
      this.fields.rollNumberField.heightPercent = Number(geminiData.rollNumberField.heightPercent) || this.fields.rollNumberField.heightPercent;
      if (geminiData.rollNumberField.alignment) this.fields.rollNumberField.alignment = geminiData.rollNumberField.alignment;
      if (geminiData.rollNumberField.suggestedFontSize) this.fields.rollNumberField.fontSize = geminiData.rollNumberField.suggestedFontSize;
    }

    this.render();
    this.onFieldChange(this.fields[this.activeFieldId]);
  }

  /**
   * Set active field to edit (nameField or rollNumberField).
   */
  setActiveField(fieldId) {
    if (this.fields[fieldId]) {
      this.activeFieldId = fieldId;
      this.render();
      this.onFieldSelect(this.fields[fieldId]);
    }
  }

  /**
   * Update active field properties (from UI inputs).
   */
  updateActiveField(updates) {
    const field = this.fields[this.activeFieldId];
    if (!field) return;

    Object.assign(field, updates);
    this.render();
    this.onFieldChange(field);
  }

  /**
   * Converts percentage-based field coordinates to canvas pixel space.
   */
  fieldToPixels(field) {
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    return {
      x: (field.xPercent / 100) * cw,
      y: (field.yPercent / 100) * ch,
      w: (field.widthPercent / 100) * cw,
      h: (field.heightPercent / 100) * ch
    };
  }

  /**
   * Main render loop.
   */
  render() {
    if (!this.templateImage || !this.ctx) return;

    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // 1. Draw base certificate image
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(this.templateImage, 0, 0, cw, ch);

    // 2. Render each field box
    Object.keys(this.fields).forEach(fieldId => {
      const field = this.fields[fieldId];
      const isSelected = fieldId === this.activeFieldId;
      const box = this.fieldToPixels(field);

      ctx.save();

      // Field boundary highlight
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.strokeStyle = isSelected ? field.color : 'rgba(100, 116, 139, 0.6)';
      ctx.setLineDash(isSelected ? [6, 4] : [4, 4]);
      ctx.strokeRect(box.x, box.y, box.w, box.h);

      // Light semi-transparent fill
      ctx.fillStyle = isSelected ? `${field.color}15` : 'rgba(241, 245, 249, 0.2)';
      ctx.fillRect(box.x, box.y, box.w, box.h);

      // Baseline indicator line (shows where the text sits right above the dash line)
      const baselineY = box.y + box.h - (field.yOffset || 0);
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isSelected ? `${field.color}99` : 'rgba(148, 163, 184, 0.4)';
      ctx.moveTo(box.x, baselineY);
      ctx.lineTo(box.x + box.w, baselineY);
      ctx.stroke();

      // Field pill badge
      ctx.fillStyle = field.color;
      ctx.font = '600 12px "Plus Jakarta Sans", sans-serif';
      const labelText = field.label;
      const badgeWidth = ctx.measureText(labelText).width + 16;
      ctx.fillRect(box.x, box.y - 20, badgeWidth, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, box.x + 8, box.y - 6);

      // Render Resize Handles for active field
      if (isSelected) {
        this.drawHandles(ctx, box, field.color);
      }

      // 3. Render Sample Text Overlay with Auto-Fitting
      if (this.showSampleText) {
        this.renderSampleText(ctx, field, box);
      }

      ctx.restore();
    });
  }

  /**
   * Renders sample student text with dynamic font scaling to preview auto-fit.
   */
  renderSampleText(ctx, field, box) {
    const text = field.sampleText || 'Sample Text';
    const baseFontSize = Number(field.fontSize) || 28;

    // Map pdf-lib font to CSS font family
    let fontFamily = 'sans-serif';
    let fontWeight = 'normal';
    if (field.fontFamily.includes('Times')) {
      fontFamily = '"Times New Roman", Georgia, serif';
      if (field.fontFamily.includes('Bold')) fontWeight = 'bold';
    } else if (field.fontFamily.includes('Courier')) {
      fontFamily = 'Courier, monospace';
      if (field.fontFamily.includes('Bold')) fontWeight = 'bold';
    } else {
      fontFamily = 'Helvetica, Arial, sans-serif';
      if (field.fontFamily.includes('Bold')) fontWeight = 'bold';
    }

    // Measure and auto-fit text width
    ctx.font = `${fontWeight} ${baseFontSize}px ${fontFamily}`;
    let measuredWidth = ctx.measureText(text).width;
    let effectiveFontSize = baseFontSize;
    const maxAllowedWidth = box.w * 0.95;

    if (measuredWidth > maxAllowedWidth) {
      const scale = maxAllowedWidth / measuredWidth;
      effectiveFontSize = Math.max(10, Math.floor(baseFontSize * scale));
      ctx.font = `${fontWeight} ${effectiveFontSize}px ${fontFamily}`;
      measuredWidth = ctx.measureText(text).width;
    }

    // Horizontal alignment
    let textX = box.x;
    if (field.alignment === 'center') {
      textX = box.x + (box.w - measuredWidth) / 2;
    } else if (field.alignment === 'right') {
      textX = box.x + box.w - measuredWidth;
    }

    // Baseline Y placement
    const textY = box.y + box.h - (field.yOffset || 0) - (effectiveFontSize * 0.15);

    ctx.fillStyle = field.textColor || '#000000';
    ctx.fillText(text, textX, textY);
  }

  /**
   * Draws 8 resize handles around the active field box.
   */
  drawHandles(ctx, box, color) {
    const handleSize = 8;
    const handles = this.getHandleCoordinates(box);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    Object.values(handles).forEach(h => {
      ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize);
    });
  }

  getHandleCoordinates(box) {
    return {
      nw: { x: box.x, y: box.y },
      n:  { x: box.x + box.w / 2, y: box.y },
      ne: { x: box.x + box.w, y: box.y },
      e:  { x: box.x + box.w, y: box.y + box.h / 2 },
      se: { x: box.x + box.w, y: box.y + box.h },
      s:  { x: box.x + box.w / 2, y: box.y + box.h },
      sw: { x: box.x, y: box.y + box.h },
      w:  { x: box.x, y: box.y + box.h / 2 }
    };
  }

  /**
   * Mouse and touch event setup for drag-and-drop & interactive resizing.
   */
  initEvents() {
    this.canvas.addEventListener('mousedown', this.onPointerDown.bind(this));
    window.addEventListener('mousemove', this.onPointerMove.bind(this));
    window.addEventListener('mouseup', this.onPointerUp.bind(this));

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        this.onPointerDown(this.touchToMouseEvent(touch));
      }
    });
    window.addEventListener('touchmove', (e) => {
      if (this.isDragging || this.isResizing) {
        const touch = e.touches[0];
        this.onPointerMove(this.touchToMouseEvent(touch));
      }
    });
    window.addEventListener('touchend', this.onPointerUp.bind(this));
  }

  touchToMouseEvent(touch) {
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => {}
    };
  }

  getCanvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  onPointerDown(e) {
    if (!this.templateImage) return;

    const pt = this.getCanvasPoint(e);
    const activeField = this.fields[this.activeFieldId];
    const activeBox = this.fieldToPixels(activeField);

    // Check if clicking resize handles of active field
    const handle = this.hitTestHandles(pt, activeBox);
    if (handle) {
      this.isResizing = true;
      this.resizeHandle = handle;
      this.dragStart = pt;
      this.initialFieldState = { ...activeField };
      return;
    }

    // Check if clicking inside active field box
    if (this.hitTestBox(pt, activeBox)) {
      this.isDragging = true;
      this.dragStart = pt;
      this.initialFieldState = { ...activeField };
      return;
    }

    // Check if clicking inside another field
    const otherFieldId = Object.keys(this.fields).find(id => {
      if (id === this.activeFieldId) return false;
      const b = this.fieldToPixels(this.fields[id]);
      return this.hitTestBox(pt, b);
    });

    if (otherFieldId) {
      this.setActiveField(otherFieldId);
      this.isDragging = true;
      this.dragStart = pt;
      this.initialFieldState = { ...this.fields[otherFieldId] };
    }
  }

  onPointerMove(e) {
    if (!this.templateImage) return;

    const pt = this.getCanvasPoint(e);
    const activeField = this.fields[this.activeFieldId];
    const activeBox = this.fieldToPixels(activeField);

    // Update cursor style
    if (!this.isDragging && !this.isResizing) {
      const handle = this.hitTestHandles(pt, activeBox);
      if (handle) {
        this.canvas.style.cursor = `${handle}-resize`;
      } else if (this.hitTestBox(pt, activeBox)) {
        this.canvas.style.cursor = 'move';
      } else {
        this.canvas.style.cursor = 'crosshair';
      }
      return;
    }

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const dx = pt.x - this.dragStart.x;
    const dy = pt.y - this.dragStart.y;
    const dxPercent = (dx / cw) * 100;
    const dyPercent = (dy / ch) * 100;

    // Handle Drag Movement
    if (this.isDragging && this.initialFieldState) {
      const newX = Math.min(Math.max(0, this.initialFieldState.xPercent + dxPercent), 100 - activeField.widthPercent);
      const newY = Math.min(Math.max(0, this.initialFieldState.yPercent + dyPercent), 100 - activeField.heightPercent);

      activeField.xPercent = Math.round(newX * 10) / 10;
      activeField.yPercent = Math.round(newY * 10) / 10;

      this.render();
      this.onFieldChange(activeField);
      return;
    }

    // Handle Resizing
    if (this.isResizing && this.initialFieldState && this.resizeHandle) {
      let { xPercent, yPercent, widthPercent, heightPercent } = this.initialFieldState;
      const handle = this.resizeHandle;

      if (handle.includes('e')) widthPercent += dxPercent;
      if (handle.includes('s')) heightPercent += dyPercent;
      if (handle.includes('w')) {
        xPercent += dxPercent;
        widthPercent -= dxPercent;
      }
      if (handle.includes('n')) {
        yPercent += dyPercent;
        heightPercent -= dyPercent;
      }

      // Safe constraints
      if (widthPercent >= 5 && xPercent >= 0 && xPercent + widthPercent <= 100) {
        activeField.xPercent = Math.round(xPercent * 10) / 10;
        activeField.widthPercent = Math.round(widthPercent * 10) / 10;
      }
      if (heightPercent >= 2 && yPercent >= 0 && yPercent + heightPercent <= 100) {
        activeField.yPercent = Math.round(yPercent * 10) / 10;
        activeField.heightPercent = Math.round(heightPercent * 10) / 10;
      }

      this.render();
      this.onFieldChange(activeField);
    }
  }

  onPointerUp() {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.initialFieldState = null;
  }

  hitTestBox(pt, box) {
    return pt.x >= box.x && pt.x <= box.x + box.w && pt.y >= box.y && pt.y <= box.y + box.h;
  }

  hitTestHandles(pt, box) {
    const handleRadius = 10;
    const handles = this.getHandleCoordinates(box);

    for (const [key, h] of Object.entries(handles)) {
      if (Math.abs(pt.x - h.x) <= handleRadius && Math.abs(pt.y - h.y) <= handleRadius) {
        return key;
      }
    }
    return null;
  }
}

