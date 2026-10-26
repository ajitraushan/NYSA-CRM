import {mkdir,writeFile} from 'node:fs/promises';
import {buildQuarterPayoutStatement} from '../src/commission-payout-domain.js';
import {makeCommissionPayoutSheetPdf} from '../src/commission-payout-sheet-pdf.js';

const rows=[
  {receiptDate:'2026-09-05',quarterKey:'2026-Q3',currency:'AED',payoutReference:'PAY-SYN-1',tierAgentName:'Synthetic Executing Agent',propertySold:'Marina Residence · Tower A · Unit 897',opportunityReference:'NYSA-OP-SYN-000001',dealReference:'NYSA-DL-SYN-000001',salePrice:2000000,grossCommissionReceivedExVat:23809.52,quarterGrossCumulative:23809.52,currentCreditedAmount:17857.14,agentCommissionSharePercent:75,achievedRate:55,quarterTrueUpAmount:0,agentPayoutAmount:9821.43,releasedAmount:0,status:'calculated'},
  {receiptDate:'2026-09-12',quarterKey:'2026-Q3',currency:'AED',payoutReference:'PAY-SYN-2',tierAgentName:'Synthetic Executing Agent',propertySold:'Marina Quays · Unit Q404',opportunityReference:'NYSA-OP-SYN-000002',dealReference:'NYSA-DL-SYN-000002',salePrice:2900000,grossCommissionReceivedExVat:100000,quarterGrossCumulative:123809.52,currentCreditedAmount:100000,agentCommissionSharePercent:100,achievedRate:60,quarterTrueUpAmount:892.86,agentPayoutAmount:60892.86,releasedAmount:0,status:'calculated'}
];
const statement=buildQuarterPayoutStatement(rows),pdf=makeCommissionPayoutSheetPdf({agent:'Synthetic Servicing Agent',quarter:'2026-Q3',currency:'AED',rows:statement.rows,summary:statement.summary,organization:{displayName:'NYSA Realty LLC',proposalFooter:'NYSA Realty LLC · Internal'},generatedDate:'2026-09-15'}),directory=new URL('../output/pdf/',import.meta.url),file=new URL('NYSA-Agent-Payout-Calculation-DEV198-preview.pdf',directory);
await mkdir(directory,{recursive:true});await writeFile(file,pdf);console.log(file.pathname);
