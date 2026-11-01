import {SpreadsheetFile,Workbook} from '@oai/artifact-tool';
import fs from 'node:fs/promises';
import path from 'node:path';

const output=path.resolve('public/templates/whatsapp-recipient-import-template.xlsx');
const workbook=Workbook.create(),font='Arial',navy='#14232C',gold='#9A712C',sand='#F4F0E8',border='#D7D0C3';
const recipients=workbook.worksheets.add('Recipients'),instructions=workbook.worksheets.add('Instructions'),dropdowns=workbook.worksheets.add('Dropdown values');

recipients.showGridLines=false;recipients.freezePanes.freezeRows(1);
recipients.getRange('A1:J2').values=[
  ['name','phone','email','tags','source_detail','consent_status','consent_evidence_ref','business_type','area','budget_max'],
  [null,null,null,null,null,'evidence_pending',null,null,null,null]
];
recipients.getRange('A1:J1').format={fill:navy,font:{name:font,size:10,bold:true,color:'#FFFFFF'},wrapText:true,verticalAlignment:'center',horizontalAlignment:'center',borders:{preset:'inside',style:'thin',color:'#FFFFFF'}};
recipients.getRange('A2:J5001').format.font={name:font,size:10,color:'#1F2933'};
recipients.getRange('A2:J5001').format.verticalAlignment='center';
recipients.getRange('A1:J5001').format.borders={insideHorizontal:{style:'thin',color:border},bottom:{style:'thin',color:border}};
recipients.getRange('A:A').format.columnWidth=24;recipients.getRange('B:B').format.columnWidth=19;recipients.getRange('C:C').format.columnWidth=30;recipients.getRange('D:E').format.columnWidth=24;recipients.getRange('F:G').format.columnWidth=23;recipients.getRange('H:I').format.columnWidth=22;recipients.getRange('J:J').format.columnWidth=16;
recipients.getRange('F2:F5001').dataValidation={rule:{type:'list',values:['verified','evidence_pending','withdrawn','denied']}};
recipients.getRange('H2:H5001').dataValidation={rule:{type:'list',values:['Sale','Rental','Off-plan','Commercial']}};
recipients.getRange('J2:J5001').format.numberFormat='#,##0';
recipients.getRange('A2:J2').format.fill='#FFF7DB';
recipients.tables.add('A1:J2',true,'WhatsAppRecipients');

instructions.showGridLines=false;instructions.getRange('A2:F2').merge();instructions.getRange('A2').values=[['NYSA CORE WhatsApp recipient import']];instructions.getRange('A2:F2').format={font:{name:font,size:16,bold:true,color:navy},borders:{bottom:{style:'medium',color:gold}}};
instructions.getRange('A4:B14').values=[
  ['Rule','Required value'],
  ['Imported sheet','Only the sheet named Recipients is read. Other sheets are never guessed or combined.'],
  ['Required columns','name and phone'],
  ['Phone','E.164 with country code, for example +971501234567'],
  ['Multiple values','Separate tags or areas with |'],
  ['Consent','verified requires consent_evidence_ref. evidence_pending is not eligible for sending.'],
  ['Source provenance','Selected in CORE for the whole batch; purchased lists require supplier and acquisition evidence.'],
  ['Duplicate handling','Preview identifies workbook and CORE matches. A user must choose Link, Keep separate or Exclude.'],
  ['Rows per file','Maximum 5,000'],
  ['Raw upload retention','30 days; governed recipient/audit records remain under policy.'],
  ['Sending','Importing never creates a campaign send.']
];
instructions.getRange('A4:B4').format={fill:navy,font:{name:font,size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center'};
instructions.getRange('A5:B14').format={font:{name:font,size:10,color:'#1F2933'},wrapText:true,verticalAlignment:'top',borders:{insideHorizontal:{style:'thin',color:border}}};instructions.getRange('A:A').format.columnWidth=24;instructions.getRange('B:B').format.columnWidth=88;instructions.getRange('A5:A14').format.fill=sand;

dropdowns.showGridLines=false;dropdowns.getRange('A1:C1').values=[['source_type','consent_status','business_type']];dropdowns.getRange('A1:C1').format={fill:navy,font:{name:font,size:10,bold:true,color:'#FFFFFF'},horizontalAlignment:'center'};
const sources=['existing_crm','website_ctwa','property_portal','event','referral','purchased_list','other'],consents=['verified','evidence_pending','withdrawn','denied'],business=['Sale','Rental','Off-plan','Commercial'];
const rows=Array.from({length:7},(_,index)=>[sources[index]||null,consents[index]||null,business[index]||null]);dropdowns.getRange('A2:C8').values=rows;dropdowns.getRange('A2:C8').format={font:{name:font,size:10,color:'#1F2933'},borders:{insideHorizontal:{style:'thin',color:border}}};dropdowns.getRange('A:C').format.columnWidth=25;

workbook.recalculate();
await fs.mkdir(path.dirname(output),{recursive:true});const blob=await SpreadsheetFile.exportXlsx(workbook);await blob.save(output);
const check=await workbook.inspect({kind:'table',range:'Recipients!A1:J2',include:'values,formulas',tableMaxRows:3,tableMaxCols:10});
const errors=await workbook.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:50},summary:'recipient template formula error scan'});
console.log(JSON.stringify({output,inspect:check.ndjson,errorScan:errors.ndjson}));
