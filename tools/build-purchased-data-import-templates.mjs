import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const deps=process.env.NYSA_NODE_DEPS;
if(!deps)throw new Error('NYSA_NODE_DEPS is required');
const {Workbook,SpreadsheetFile}=await import(pathToFileURL(path.join(deps,'@oai','artifact-tool','dist','artifact_tool.mjs')).href);
const outputDir=path.resolve('public','templates'),previewDir=path.resolve('.tmp','purchased-data-template-previews');
const gold='#B88A3B',navy='#17212D',pale='#F3EFE6',line='#D9D9D9';
const batchFields=['contract_version','module_type','source_system_code','supplier_name','acquisition_batch_reference','acquisition_date','campaign_reference','processing_basis'];
const customerHeaders=['external_row_reference','full_name','email','phone','preferred_channel','source_notes','restriction_status'];
const leadHeaders=['external_row_reference','customer_reference','email','phone','lead_title','business_type','budget_min','budget_max','preferred_areas','property_type','bedrooms_min','objective','purpose','timeline','campaign_reference','source_notes'];

function styleHeader(range){range.format.fill=navy;range.format.font={bold:true,color:'#FFFFFF'};range.format.wrapText=true;range.format.verticalAlignment='center';range.format.borders={preset:'all',style:'thin',color:line};range.format.rowHeight=36;}
function styleBody(range){range.format.borders={preset:'all',style:'thin',color:line};range.format.verticalAlignment='center';range.format.wrapText=true;}
async function build({moduleType,dataSheet,headers,fileName}){
  const workbook=Workbook.create(),instructions=workbook.worksheets.add('Instructions'),batch=workbook.worksheets.add('Batch'),data=workbook.worksheets.add(dataSheet);
  instructions.showGridLines=false;batch.showGridLines=false;data.showGridLines=false;
  instructions.getRange('A1:F1').merge();instructions.getRange('A1').values=[[moduleType==='customer_only'?'NYSA Bulk Customer Import Template':'NYSA Purchased Lead Import Template']];instructions.getRange('A1:F1').format.fill=navy;instructions.getRange('A1:F1').format.font={bold:true,color:'#FFFFFF',size:16};instructions.getRange('A1:F1').format.rowHeight=34;
  const notes=moduleType==='customer_only'?
    [['Purpose','Creates or matches Customer Master records only. It does not create Leads, assignments or Opportunities.'],['Minimum identity','Provide full_name and at least one of email or phone.'],['Duplicate handling','Exact matches are linked without overwriting ownership or verified data. Ambiguous matches are held for review.'],['Restrictions','Use restriction_status values allowed, restricted or do_not_contact.'],['Process','Complete Batch, add rows in Customers, upload, review every result, then confirm the unchanged workbook.']]:
    [['Purpose','Creates Leads only against existing Customers. It never creates a Customer.'],['Customer match','Use customer_reference where possible; otherwise provide an unambiguous email or phone.'],['Basic rows','Lead title and business type are required. Preference columns may remain blank.'],['Enriched rows','If preferences are supplied, purpose and timeline are required; missing values are not invented.'],['Process','Complete Batch, add rows in Leads, upload, review every result, then confirm the unchanged workbook.']];
  instructions.getRange('A3:B7').values=notes;styleBody(instructions.getRange('A3:B7'));instructions.getRange('A3:A7').format.fill=pale;instructions.getRange('A3:A7').format.font={bold:true,color:gold};instructions.getRange('A:B').format.columnWidth=28;instructions.getRange('B:B').format.columnWidth=92;instructions.freezePanes.freezeRows(1);
  batch.getRange('A1:B1').values=[['field','value']];styleHeader(batch.getRange('A1:B1'));
  const examples={contract_version:'purchased-data-v1',module_type:moduleType,source_system_code:'replace_supplier_code',supplier_name:'Replace supplier name',acquisition_batch_reference:'REPLACE-BATCH-001',acquisition_date:'2026-09-19',campaign_reference:'replace_campaign_or_delete',processing_basis:'Replace with approved processing basis'};
  const metadata=batchFields.map(field=>[field,examples[field]]);batch.getRange(`A2:B${metadata.length+1}`).values=metadata;styleBody(batch.getRange(`A2:B${metadata.length+1}`));batch.getRange(`A2:A${metadata.length+1}`).format.fill=pale;batch.getRange(`A2:A${metadata.length+1}`).format.font={bold:true,color:gold};batch.getRange('A:A').format.columnWidth=36;batch.getRange('B:B').format.columnWidth=52;batch.getRange('B7').setNumberFormat('yyyy-mm-dd');batch.freezePanes.freezeRows(1);
  data.getRangeByIndexes(0,0,1,headers.length).values=[headers];styleHeader(data.getRangeByIndexes(0,0,1,headers.length));styleBody(data.getRangeByIndexes(1,0,20,headers.length));data.getRangeByIndexes(0,0,21,headers.length).format.columnWidth=22;data.getRangeByIndexes(0,0,21,headers.length).format.autofitRows();data.freezePanes.freezeRows(1);
  data.getRange('A2:D1001').setNumberFormat('@');
  const sample=moduleType==='customer_only'?['REPLACE-CUSTOMER-001','Replace customer name','replace@example.test','REPLACE-PHONE','Email','Replace with source notes','allowed']:['REPLACE-LEAD-001','NYSA-CUS-REPLACE','replace@example.test','REPLACE-PHONE','Replace lead title','Sale','1000000','2000000','Dubai Marina','Apartment','1','buy','investment','0_3_months','replace_campaign_or_delete','Replace with source notes'];
  data.getRangeByIndexes(1,0,1,headers.length).values=[sample];
  if(moduleType==='customer_only'){data.getRange('E2:E1001').dataValidation={rule:{type:'list',values:['Phone','Email','WhatsApp','SMS']}};data.getRange('G2:G1001').dataValidation={rule:{type:'list',values:['allowed','restricted','do_not_contact']}};}
  else{data.getRange('F2:F1001').dataValidation={rule:{type:'list',values:['Sale','Rental','Off-plan','Commercial']}};data.getRange('M2:M1001').dataValidation={rule:{type:'list',values:['own_use','investment','business','other']}};data.getRange('G2:H1001').setNumberFormat('#,##0.00');data.getRange('K2:K1001').setNumberFormat('0');}
  workbook.recalculate();await fs.mkdir(outputDir,{recursive:true});await fs.mkdir(previewDir,{recursive:true});
  const blob=await SpreadsheetFile.exportXlsx(workbook);await blob.save(path.join(outputDir,fileName));
  const preview=await workbook.render({sheetName:dataSheet,range:`A1:${String.fromCharCode(64+Math.min(headers.length,26))}8`,scale:1,format:'png'});await fs.writeFile(path.join(previewDir,fileName.replace('.xlsx','.png')),new Uint8Array(await preview.arrayBuffer()));
  const inspected=await workbook.inspect({kind:'region',sheetId:dataSheet,range:`A1:${String.fromCharCode(64+Math.min(headers.length,26))}4`,maxChars:4000});console.log(fileName,inspected.ndjson);
}

await build({moduleType:'customer_only',dataSheet:'Customers',headers:customerHeaders,fileName:'purchased-customer-import-template.xlsx'});
await build({moduleType:'lead',dataSheet:'Leads',headers:leadHeaders,fileName:'purchased-lead-import-template.xlsx'});
