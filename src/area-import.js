import { readSheet } from 'read-excel-file/node';

export const AREA_IMPORT_HEADERS=Object.freeze([
  'stable_area_code',
  'customer_facing_area',
  'emirate',
  'display_order'
]);

export const UAE_EMIRATES=Object.freeze([
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain'
]);

const cellText=value=>value===null||value===undefined?'':String(value).trim();
const normalizedHeader=value=>cellText(value).toLowerCase().replace(/[\s-]+/g,'_');

export function validateAreaImportRows(sourceRows,{existingCodes=[],existingLabels=[]}={}){
  const codes=new Set(existingCodes.map(x=>String(x).toLowerCase()));
  const labels=new Set(existingLabels.map(x=>String(x).toLowerCase()));
  const workbookCodes=new Set(),workbookLabels=new Set();
  return sourceRows.map((source,index)=>{
    const rowNumber=Number(source.rowNumber||index+2),stableCode=cellText(source.stableCode).toLowerCase(),businessLabel=cellText(source.businessLabel),emirate=cellText(source.emirate),displayOrder=Number(source.displayOrder),errors=[];
    if(!stableCode)errors.push('Stable area code is required');
    else if(!/^[a-z][a-z0-9_]*$/.test(stableCode))errors.push('Stable area code must use lowercase snake_case');
    if(!businessLabel)errors.push('Customer-facing area is required');
    if(!UAE_EMIRATES.includes(emirate))errors.push('Select one of the seven maintained UAE Emirates');
    if(!Number.isInteger(displayOrder)||displayOrder<0||displayOrder>9999)errors.push('Display order must be a whole number from 0 to 9999');
    const codeKey=stableCode.toLowerCase(),labelKey=businessLabel.toLowerCase();
    if(stableCode&&codes.has(codeKey))errors.push('Stable area code already exists');
    if(businessLabel&&labels.has(labelKey))errors.push('An active customer-facing area with this name already exists');
    if(stableCode&&workbookCodes.has(codeKey))errors.push('Stable area code is duplicated in this workbook');
    if(businessLabel&&workbookLabels.has(labelKey))errors.push('Customer-facing area is duplicated in this workbook');
    if(stableCode)workbookCodes.add(codeKey);
    if(businessLabel)workbookLabels.add(labelKey);
    return {rowNumber,stableCode,businessLabel,emirate,displayOrder:Number.isFinite(displayOrder)?displayOrder:null,errors};
  });
}

export async function parseAreaWorkbook(buffer){
  const workbookRows=await readSheet(buffer);
  if(!workbookRows.length)throw new Error('The workbook is empty');
  const headers=workbookRows[0].map(normalizedHeader);
  if(AREA_IMPORT_HEADERS.some((header,index)=>headers[index]!==header)||headers.length!==AREA_IMPORT_HEADERS.length)throw new Error(`Use the approved template with these columns in this order: ${AREA_IMPORT_HEADERS.join(', ')}`);
  const dataRows=workbookRows.slice(1).map((row,index)=>({rowNumber:index+2,stableCode:row[0],businessLabel:row[1],emirate:row[2],displayOrder:row[3]})).filter(row=>[row.stableCode,row.businessLabel,row.emirate,row.displayOrder].some(value=>cellText(value)!==''));
  if(!dataRows.length)throw new Error('The workbook contains no area rows');
  if(dataRows.length>500)throw new Error('A single area import cannot contain more than 500 rows');
  return dataRows;
}
