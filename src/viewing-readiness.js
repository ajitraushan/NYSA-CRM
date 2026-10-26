export const VIEWING_NEXT_DECISIONS=['more_viewings_required','ready_for_offer','not_proceeding','undecided'];

// Null decisions identify historical outcomes recorded before explicit decisions existed.
// They retain their former qualification; newly recorded completions require a decision.
export function viewingReadiness(rows){
  if(rows.some(row=>row.status==='scheduled'))return {ready:false,reason:'Complete or cancel the pending viewing for this property, recording a reason.'};
  const latest=rows.filter(row=>row.status==='completed'&&String(row.feedback||'').trim())
    .sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0))[0];
  return {ready:Boolean(latest&&(!latest.customerNextDecision||latest.customerNextDecision==='ready_for_offer')),viewingId:latest?.id||null,
    reason:latest?'Record Ready for Offer when the Customer is ready to proceed.':'Complete the property viewing and record Customer feedback.'};
}
