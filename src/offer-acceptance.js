export const acceptanceSide=role=>['customer','buyer','tenant'].includes(role)?'buyer':['seller','landlord','developer'].includes(role)?'seller':null;
export function bilateralDecision(revision,events,role,evidence){
 if(!revision.requiresBilateralAcceptance)return{complete:true,side:null};
 const side=acceptanceSide(role);if(!side)return{error:'Select Buyer/Tenant or Seller/Landlord for acceptance'};
 if(!String(evidence||'').trim())return{error:'Acceptance evidence reference is required for this party and exact revision'};
 const accepted=new Set(events.filter(x=>x.eventType==='accepted'&&x.offerRevisionId===revision.id).map(x=>x.acceptingSide));
 if(accepted.has(side))return{error:'This party already accepted this exact revision; reload the Offer'};
 accepted.add(side);return{side,complete:accepted.has('buyer')&&accepted.has('seller')};
}
export async function assertBilateralBooking(revisionId,one){const revision=await one('SELECT requires_bilateral_acceptance FROM offer_revisions WHERE id=$1',[revisionId]);if(revision?.requiresBilateralAcceptance){const accepted=await one("SELECT COUNT(DISTINCT accepting_side)::int AS count FROM negotiation_events WHERE offer_revision_id=$1 AND event_type='accepted' AND accepting_side IN ('buyer','seller') AND acceptance_evidence IS NOT NULL AND accepting_party_id IS NOT NULL",[revisionId]);if(accepted?.count!==2)throw Object.assign(new Error('Both Buyer and Seller must accept this exact Offer revision before Booking or Deal creation'),{statusCode:409});}}
