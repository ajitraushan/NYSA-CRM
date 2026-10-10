import {renderApprovedDocumentPdf} from './approved-document-renderer.js';

export const approvedDocumentRuntimeSmokeCodes=Object.freeze([
  'buyer_proposal','financial_illustration','offer_letter','viewing_confirmation',
  'a2a_buyer','a2a_seller','listing_noc','agent_payout','tax_invoice','payout_advice'
]);

const syntheticData=documentCode=>({
  reference:'SYNTHETIC-DEV220',title:'Synthetic renderer verification',version:1,
  issueDate:'6 Oct 2026',customer:{name:'Synthetic Customer'},agent:{name:'Synthetic Agent'},
  header:{Page:'1 of 1'},summary:{},rows:[],properties:[],
  checkboxes:documentCode==='offer_letter'?[{label:'Offer to Purchase'}]:[]
});

export async function verifyApprovedDocumentRuntime(){
  const results=[];
  for(const documentCode of approvedDocumentRuntimeSmokeCodes){
    const pdf=await renderApprovedDocumentPdf(documentCode,syntheticData(documentCode));
    if(pdf.subarray(0,5).toString()!=='%PDF-')throw new Error(`${documentCode} output is not a PDF`);
    results.push({documentCode,bytes:pdf.length});
  }
  return results;
}
