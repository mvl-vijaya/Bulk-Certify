import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseSpreadsheet } from '../server/services/excelService.js';
import { generateSingleCertificate, generateBatchZip } from '../server/services/pdfService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function runVerificationTests() {
  console.log('🧪 Starting Bulk Certify Verification Test Suite...\n');

  // Test 1: Test CSV parsing
  console.log('1. Testing Excel/CSV Parser with sample-students.csv...');
  const csvPath = path.join(projectRoot, 'public/assets/sample-students.csv');
  const csvBuffer = fs.readFileSync(csvPath);
  const parsedData = parseSpreadsheet(csvBuffer);

  console.log(`   ✅ Parsed ${parsedData.totalRows} student rows successfully!`);
  console.log(`   ✅ Headers detected:`, parsedData.headers);
  console.log(`   ✅ Suggested mapping:`, parsedData.suggestedMapping);

  if (parsedData.totalRows !== 10) {
    throw new Error(`Expected 10 rows, got ${parsedData.totalRows}`);
  }

  // Test 2: Test Single PDF Generation with PDF template
  console.log('\n2. Testing Single Certificate Generation with sample-template.pdf...');
  const pdfTemplatePath = path.join(projectRoot, 'public/assets/sample-template.pdf');
  const pdfTemplateBuffer = fs.readFileSync(pdfTemplatePath);

  const sampleFields = {
    nameField: {
      xPercent: 18,
      yPercent: 41,
      widthPercent: 64,
      heightPercent: 7,
      fontSize: 30,
      fontFamily: 'Helvetica-Bold',
      alignment: 'center',
      fontColor: '#1e3a8a',
      yOffset: 0
    },
    rollNumberField: {
      xPercent: 32,
      yPercent: 63,
      widthPercent: 36,
      heightPercent: 5,
      fontSize: 16,
      fontFamily: 'Helvetica',
      alignment: 'center',
      fontColor: '#4b5563',
      yOffset: 0
    }
  };

  const singlePdfBytes = await generateSingleCertificate({
    templateBuffer: pdfTemplateBuffer,
    templateMime: 'application/pdf',
    studentName: 'Alexander Montgomery-Fitzgerald III',
    rollNumber: 'CS-2026-103',
    fields: sampleFields
  });

  console.log(`   ✅ Single certificate generated successfully! Size: ${singlePdfBytes.length} bytes`);
  if (singlePdfBytes.length < 1000) {
    throw new Error('Generated PDF byte length is suspiciously small.');
  }

  // Test 3: Test Batch ZIP generation
  console.log('\n3. Testing Batch ZIP Generation for all 10 students...');
  const zipBuffer = await generateBatchZip({
    templateBuffer: pdfTemplateBuffer,
    templateMime: 'application/pdf',
    students: parsedData.allRows,
    nameColumn: parsedData.suggestedMapping.nameColumn,
    rollNumberColumn: parsedData.suggestedMapping.rollNumberColumn,
    fields: sampleFields,
    onProgress: (p) => {
      console.log(`   ⏳ Progress: ${p.percent}% - Generated "${p.studentName}.pdf"`);
    }
  });

  console.log(`\n   ✅ Batch ZIP generated successfully! Total Archive Size: ${zipBuffer.length} bytes`);
  if (zipBuffer.length < 5000) {
    throw new Error('Generated ZIP buffer is too small.');
  }

  console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY! 🚀');
}

runVerificationTests().catch(err => {
  console.error('\n❌ Verification Test Failed:', err);
  process.exit(1);
});

