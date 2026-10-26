import fs from 'node:fs/promises';
import path from 'node:path';
import {makeCommissionPayoutSheetPdf} from '../src/commission-payout-sheet-pdf.js';

const output=path.resolve('output/pdf/NYSA-Agent-Payout-Calculation-Sheet-Corrected-Preview.pdf');
const logoPath=path.resolve('public/brand/nysa/raster/nysa-horizontal-light@2x.png');
const logo={buffer:await fs.readFile(logoPath),mediaType:'image/png'};
const rows=[
  {receiptDate:'2026-09-05',quarterKey:'2026-Q3',opportunityReference:'NYSA-OP-202608-000001',dealReference:'NYSA-DL-202609-000001',propertySold:'NYSA-INV-000101 · Sobha Siniya Island · Unit BR-TL-A544',salePrice:10000000,dealGrossCommissionExVat:200000,grossCommissionReceivedExVat:100000,quarterGrossCumulative:100000,agentCommissionSharePercent:75,agentRoleSplit:'Servicing 75.00%',eligibleCommissionPool:55000,currentCreditedAmount:75000,resultingCumulativeAmount:75000,achievedRate:55,currentDealPayout:41250,quarterTrueUpAmount:0,agentPayoutAmount:41250},
  {receiptDate:'2026-09-18',quarterKey:'2026-Q3',opportunityReference:'NYSA-OP-202609-000002',dealReference:'NYSA-DL-202609-000002',propertySold:'NYSA-INV-000208 · Marina Residence · Unit 1204',salePrice:2000000,dealGrossCommissionExVat:50000,grossCommissionReceivedExVat:50000,quarterGrossCumulative:150000,agentCommissionSharePercent:25,agentRoleSplit:'Originating 25.00%',eligibleCommissionPool:30000,currentCreditedAmount:12500,resultingCumulativeAmount:87500,achievedRate:60,currentDealPayout:7500,quarterTrueUpAmount:0,agentPayoutAmount:7500}
];
const pdf=makeCommissionPayoutSheetPdf({agent:'Sample Agent',quarter:'2026-Q3',currency:'AED',rows,organization:{displayName:'NYSA Realty LLC',proposalFooter:'NYSA Realty LLC | Internal'},logo,generatedDate:'2026-09-06'});
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,pdf);
console.log(output);
