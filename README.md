# 🎓 Bulk Certify - AI-Powered Continuous Certificate Generator

**Bulk Certify** is an enterprise-grade full-stack web application designed to generate continuous, customized certificates in PDF format by combining a master template (PNG, JPG, or single-page PDF) with student data uploaded via an Excel or CSV spreadsheet.

Featuring interactive visual field mapping, automated baseline alignment powered by **Google Gemini Vision API** (`gemini-2.5-flash`), dynamic text length auto-fitting, and high-performance streaming ZIP export.

---

## 🌟 Key Features

1. **5-Step Guided Wizard Workflow**:
   - **Step 1: Certificate Template Upload**: Upload PNG, JPG, SVG, or single-page PDF templates. Includes a built-in sample template.
   - **Step 2: Student Spreadsheet Upload**: Upload `.xlsx`, `.xls`, or `.csv` files. Automatically previews records and suggests column mappings (e.g. Student Name, Roll Number).
   - **Step 3: Interactive Visual Preview & Field Mapping Canvas**:
     - Visual draggable & resizable bounding boxes for Name (1st line) and Roll Number (2nd line).
     - **✨ Auto-Detect with Gemini Vision**: Multimodal AI automatically scans the template and positions the text boxes precisely on the detected dashed lines.
     - Full typography controls: Font Family (Helvetica, Times Roman, Courier), Font Size, Text Color, Alignment (Center, Left, Right), and Vertical Baseline Elevation Offset.
     - **Live Text Auto-Fit Preview**: Simulates long names directly on canvas with real-time text scaling.
     - **Test Single PDF Preview**: Instantly renders and previews a sample PDF certificate.
   - **Step 4: Batch PDF Generation**: Generates 100s of certificates with real-time animated progress tracking.
   - **Step 5: Export & Download**:
     - Download all generated certificates packaged in a single `.ZIP` archive.
     - Download individual certificates on demand.

2. **Native Resolution & Zero Pixelation**:
   - Image templates are embedded at 1:1 original pixel resolution.
   - Single-page PDF templates preserve 100% of their original vector graphics, fonts, and sharp borders.

3. **Dynamic Text Length Auto-Fitting**:
   - Automatically measures student name width using font metrics.
   - If a long name (e.g., *"Alexander Montgomery-Fitzgerald III"*) exceeds the dashed line width, it dynamically scales down the font size so the name never overflows or clips.

4. **Robust Security & File Sanitization**:
   - Sanitizes output filenames (`<Student_Name>.pdf`) by stripping illegal filesystem characters across Windows, Linux, and macOS.
   - Secure GEMINI_API_KEY handling client-side in session memory or server-side `.env`.

---

## 📂 Project Directory Structure

```
bulk-certify/
├── .env.example                  # Environment variable configuration template
├── .gitignore                    # Git ignore file (excludes node_modules, .env)
├── package.json                  # Node.js project manifest & dependencies
├── README.md                     # Comprehensive project documentation
├── server/
│   ├── index.js                  # Main Express Server & route mounting
│   ├── config.js                 # Central configuration loader
│   ├── services/
│   │   ├── geminiService.js      # Gemini Vision API integration for line detection
│   │   ├── excelService.js       # Spreadsheet parser (XLSX, CSV) & column inference
│   │   └── pdfService.js         # High-performance PDF generation engine (pdf-lib)
│   ├── utils/
│   │   ├── sanitizer.js          # File & student name sanitizer
│   │   └── coordinateConverter.js # Canvas <-> PDF Points coordinate transformation
│   └── routes/
│       ├── analyze.js            # POST /api/analyze-template (Gemini Vision AI)
│       ├── parseData.js          # POST /api/parse-data (Spreadsheet parser)
│       ├── preview.js            # POST /api/preview-pdf (Single PDF live preview)
│       └── generate.js           # POST /api/generate-batch & /api/generate-single
├── public/
│   ├── index.html                # Modern 5-step wizard UI with Tailwind CSS
│   ├── css/
│   │   └── style.css             # Glassmorphism styling, canvas layout, animations
│   ├── js/
│   │   ├── app.js                # State orchestrator & API communications
│   │   ├── canvasEditor.js       # Interactive canvas engine (drag, resize, handles)
│   │   └── uploader.js           # File upload & PDF.js page rendering engine
│   └── assets/
│       ├── sample-template.svg   # High-resolution sample certificate template
│       ├── sample-template.pdf   # Pre-rendered sample PDF template
│       └── sample-students.csv   # Sample dataset of 10 student records
└── scripts/
    └── generateSampleCertificate.js # Utility script to generate sample PDF template
```

---

## 🧠 Core Technical Implementations

### 1. Gemini Vision API Integration (`geminiService.js`)

The application sends the certificate template image as base64 inline multimodal data to Google Gemini (`gemini-2.5-flash`):

```javascript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    temperature: 0.1
  }
});

const result = await model.generateContent([
  prompt,
  { inlineData: { data: base64Data, mimeType } }
]);
```

**Expected JSON Response:**
```json
{
  "nameField": {
    "xPercent": 20,
    "yPercent": 40,
    "widthPercent": 60,
    "heightPercent": 8,
    "alignment": "center",
    "suggestedFontSize": 32,
    "description": "Primary dashed line for recipient name"
  },
  "rollNumberField": {
    "xPercent": 30,
    "yPercent": 54,
    "widthPercent": 40,
    "heightPercent": 6,
    "alignment": "center",
    "suggestedFontSize": 18,
    "description": "Secondary dashed line for roll number"
  }
}
```

If no Gemini API key is provided, the application falls back gracefully to standard certificate alignment heuristics.

---

### 2. PDF Coordinate Scaling & Baseline Logic (`coordinateConverter.js`)

#### Coordinate Origin Inversion:
- **Web Browser Canvas**: Origin `(0, 0)` is at the **Top-Left**. $Y$ increases downwards.
- **PDF Document (`pdf-lib`)**: Origin `(0, 0)` is at the **Bottom-Left**. $Y$ increases upwards.

```javascript
// Horizontal positioning:
const boxX = (field.xPercent / 100) * pageWidth + xOffset;
const boxWidth = (field.widthPercent / 100) * pageWidth;
const boxHeight = (field.heightPercent / 100) * pageHeight;

// Vertical positioning (Invert Top-Left to Bottom-Left):
const boxYTop = pageHeight - ((field.yPercent / 100) * pageHeight);
const boxYBottom = boxYTop - boxHeight;

// Baseline elevation:
const baselinePadding = Math.max(2, effectiveFontSize * 0.15);
const finalY = boxYBottom + baselinePadding + yOffset;
```

#### Dynamic Text Length Auto-Fitting:
```javascript
let effectiveFontSize = baseFontSize;
const maxAllowedWidth = boxWidth * 0.95;

if (content.length > 0 && font) {
  const measuredWidth = font.widthOfTextAtSize(content, baseFontSize);
  if (measuredWidth > maxAllowedWidth) {
    const scale = maxAllowedWidth / measuredWidth;
    effectiveFontSize = Math.max(10, Math.floor(baseFontSize * scale * 10) / 10);
  }
}
```

---

## 🚀 Quickstart & Local Launch Instructions

### Prerequisites
- **Node.js** (v18.0.0 or higher)
- **npm** (v9.0.0 or higher)

### 1. Clone or Open Workspace
Open your terminal in the project directory:
```bash
cd "c:\Users\preet\Downloads\PDF GENERATOR"
```

### 2. Install Dependencies
Dependencies are already configured in `package.json`:
```bash
npm install
```

### 3. Environment Variables (Optional)
Copy `.env.example` to `.env` (already created):
```bash
cp .env.example .env
```
*(You can specify `GEMINI_API_KEY=your_key_here` in `.env`, or simply enter it directly into the web UI).*

### 4. Start the Application
Run the Express server:
```bash
npm start
```
Or for auto-reloading during development:
```bash
npm run dev
```

### 5. Access the Web Application
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🧪 Testing the Application with Built-in Demo Data

1. **Step 1**: Click **"⚡ Load Sample Certificate Template"**. The sample certificate will load and display immediately. Click **"Next"**.
2. **Step 2**: Click **"⚡ Load Sample Student Data (10 Records)"**. The 10 sample student records will populate. Verify the mapped columns and click **"Next"**.
3. **Step 3**:
   - Click **"✨ Auto-Detect with Gemini Vision"** to align fields using AI (or use the pre-aligned boxes).
   - Drag or resize boxes as desired and test the typography controls.
   - Click **"Test PDF Preview"** to inspect a generated PDF sample.
   - Click **"Continue to Batch Generation"**.
4. **Step 4**: Click **"🚀 Start Batch Generation"**. Watch the progress bar generate all 10 certificates.
5. **Step 5**: Click **"📦 Download All Certificates (.ZIP)"** to save the archive, or download individual student certificates!

---

## 🛡️ License
MIT License &copy; 2026 Bulk Certify Team.

