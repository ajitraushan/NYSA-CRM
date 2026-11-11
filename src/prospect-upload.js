import {readSheet} from 'read-excel-file/node';
import {createRequire} from 'node:module';
import {isValidEmail,normalizePhone} from './crm-domain.js';

// Use the Excel reader's locked ZIP dependency, including nested npm installs.
const requireFromExcelReader = createRequire(import.meta.resolve('read-excel-file/node'));
const {strToU8, unzipSync, zipSync} = requireFromExcelReader('fflate');

export const UPLOAD_COLUMNS = ['Name', 'Phone', 'Email', 'Notes', 'Source'];
export const UPLOAD_SOURCES = ['diary', 'notebook', 'whatsapp', 'rem', 'other'];
export const MAX_UPLOAD_ROWS = 2000;
export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const CSV_TYPE = 'text/csv';
const EMPTY_SHARED_STRINGS = strToU8('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="0" uniqueCount="0"/>');
const text = value => String(value ?? '').trim();

function csvRows(buffer) {
  const input = new TextDecoder('utf-8', {fatal: true}).decode(buffer);
  const rows = [];
  let row = [], field = '', quoted = false, closed = false;
  function finishRow() {
    row.push(field);
    rows.push(row);
    if (rows.length > MAX_UPLOAD_ROWS + 1) throw new Error('Upload is limited to 2,000 rows');
    row = [];
    field = '';
    closed = false;
  }
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === ',') {
      row.push(field);
      field = '';
      closed = false;
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      finishRow();
    } else if (closed || (char === '"' && field)) {
      throw new Error('CSV contains an invalid quoted value');
    } else if (char === '"') quoted = true;
    else field += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value');
  if (row.length || field || closed) finishRow();
  return rows;
}

async function xlsxRows(buffer) {
  let size = 0, entries = 0;
  const files = unzipSync(buffer, {filter: entry => {
    size += entry.originalSize;
    if (++entries > 128 || size > 16 * 1024 * 1024) throw new Error('Workbook is too large to process');
    return true;
  }});
  // The XLSX reader expects an asynchronous parse for shared strings. Inline-only
  // workbooks may omit that optional part. Supply an empty fallback in memory.
  if (files['xl/sharedStrings.xml']) return readSheet(buffer);
  return readSheet(Buffer.from(zipSync({...files,'xl/sharedStrings.xml':EMPTY_SHARED_STRINGS})));
}

export async function parseProspectUpload(buffer, mediaType) {
  const [headers, ...rows] = mediaType === CSV_TYPE ? csvRows(buffer) : await xlsxRows(buffer);
  if (rows.length > MAX_UPLOAD_ROWS) throw new Error('Upload is limited to 2,000 rows');
  if (!headers || headers.length !== UPLOAD_COLUMNS.length ||
      !UPLOAD_COLUMNS.every((name, index) => text(headers[index]).toLowerCase() === name.toLowerCase())) {
    throw new Error('Use the template columns in order: Name, Phone, Email, Notes, Source');
  }
  if (!rows.length) throw new Error('The file contains no prospect rows');
  return rows.map((cells, index) => {
    const [name, rawPhone, mail, notes, source] = UPLOAD_COLUMNS.map((_, i) => text(cells[i]));
    const digits = rawPhone.replace(/[^0-9]/g, '');
    const phone = /^[+0-9() .-]+$/.test(rawPhone)
      ? normalizePhone(/^05\d{8}$/.test(digits) && !rawPhone.startsWith('+') ? '+971' + digits.slice(1) : rawPhone)
      : null;
    const email = mail.toLowerCase() || null;
    const normalizedSource = source.toLowerCase() || 'other';
    const error = cells.slice(5).some(value => text(value)) ? 'Unexpected extra column'
      : !name ? 'Name is required'
      : !rawPhone && !email ? 'Enter a phone number or email'
      : rawPhone && !phone ? 'Enter a UAE mobile or international phone number'
      : email && !isValidEmail(email) ? 'Email format is invalid'
      : !UPLOAD_SOURCES.includes(normalizedSource) ? 'Source must be diary, notebook, whatsapp, rem or other'
      : name.length > 240 || mail.length > 254 || notes.length > 10000 ? 'Name, email or notes exceed the allowed length'
      : [name, mail, notes].some(value => value.includes('\0')) ? 'Invalid control character'
      : null;
    return {rowNumber: index + 2, name, phone, email, notes, source: normalizedSource, error};
  });
}

export function uploadTemplate(format) {
  if (format === 'csv') return Buffer.from(UPLOAD_COLUMNS.join(',') + '\r\n');
  const main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const rel = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRel = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const xml = {
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels': `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="Prospects" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${packageRel}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml': `<worksheet xmlns="${main}"><sheetData><row r="1">${UPLOAD_COLUMNS.map((name, i) =>
      `<c r="${'ABCDE'[i]}1" t="inlineStr"><is><t>${name}</t></is></c>`).join('')}</row></sheetData></worksheet>`,
  };
  return Buffer.from(zipSync(Object.fromEntries(Object.entries(xml).map(([name, content]) => [name, strToU8(content)]))));
}
