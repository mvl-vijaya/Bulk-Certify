import * as XLSX from 'xlsx';

/**
 * Bulk Certify - Excel / CSV Parser Service
 * Parses spreadsheets (.xlsx, .xls, .csv), detects headers, and suggests column mappings.
 */

/**
 * Parses a spreadsheet buffer into structured JSON data and identifies column candidates.
 *
 * @param {Buffer} fileBuffer - Spreadsheet buffer
 * @returns {Object} { headers, previewRows, totalRows, allRows, suggestedMapping }
 */
export function parseSpreadsheet(fileBuffer) {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error('Spreadsheet file buffer is empty.');
  }

  // Read workbook from buffer
  const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    throw new Error('The uploaded spreadsheet does not contain any readable sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];

  // Convert worksheet to 2D array of rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawRows.length === 0) {
    throw new Error('The spreadsheet sheet appears to be completely empty.');
  }

  // Header row is typically the 1st row
  const rawHeaders = rawRows[0] || [];
  const headers = rawHeaders
    .map((h, idx) => (h ? String(h).trim() : `Column_${idx + 1}`))
    .filter(Boolean);

  if (headers.length === 0) {
    throw new Error('No valid column headers detected in the spreadsheet.');
  }

  // Parse remaining rows into objects keyed by header names
  const allRows = [];
  for (let i = 1; i < rawRows.length; i++) {
    const rowArray = rawRows[i];
    // Skip empty lines
    const hasData = rowArray.some(val => val !== null && val !== undefined && String(val).trim() !== '');
    if (!hasData) continue;

    const rowObj = {};
    headers.forEach((header, colIndex) => {
      const val = rowArray[colIndex];
      rowObj[header] = val !== undefined && val !== null ? String(val).trim() : '';
    });
    allRows.push(rowObj);
  }

  if (allRows.length === 0) {
    throw new Error('No student data records found below the header row.');
  }

  // Automatically detect the most likely columns for Name and Roll Number
  const suggestedMapping = inferColumnMappings(headers);

  return {
    sheetName: firstSheetName,
    headers,
    totalRows: allRows.length,
    previewRows: allRows.slice(0, 10),
    allRows,
    suggestedMapping
  };
}

/**
 * Heuristically infers which columns map to "Name" and "Roll Number".
 *
 * @param {string[]} headers - Array of detected header names
 * @returns {{ nameColumn: string, rollNumberColumn: string }}
 */
function inferColumnMappings(headers) {
  const nameKeywords = [
    'student name', 'student_name', 'name', 'full name', 'fullname',
    'candidate', 'recipient', 'participant', 'student', 'attendee'
  ];

  const rollKeywords = [
    'roll no', 'roll_no', 'roll number', 'rollnumber', 'roll',
    'registration no', 'reg no', 'reg_no', 'registration number',
    'student id', 'student_id', 'id', 'enrollment', 'enrollment no', 'sr no'
  ];

  let nameColumn = '';
  let rollNumberColumn = '';

  const lowerHeaders = headers.map(h => h.toLowerCase().trim());

  // Check exact keyword match first, then partial match
  for (const keyword of nameKeywords) {
    const idx = lowerHeaders.findIndex(h => h === keyword || h.includes(keyword));
    if (idx !== -1) {
      nameColumn = headers[idx];
      break;
    }
  }

  for (const keyword of rollKeywords) {
    const idx = lowerHeaders.findIndex(h => h === keyword || h.includes(keyword));
    if (idx !== -1 && headers[idx] !== nameColumn) {
      rollNumberColumn = headers[idx];
      break;
    }
  }

  // Fallback defaults if keywords were not matched
  if (!nameColumn && headers.length > 0) {
    nameColumn = headers[0];
  }
  if (!rollNumberColumn && headers.length > 1) {
    rollNumberColumn = headers[1];
  } else if (!rollNumberColumn) {
    rollNumberColumn = headers[0];
  }

  return {
    nameColumn,
    rollNumberColumn
  };
}

