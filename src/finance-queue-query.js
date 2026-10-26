// One SQL snapshot keeps page rows, counts and totals consistent. Keeping the
// page query separate lets PostgreSQL use indexes before applying its limit.
export function financeQueueQuery(source,{sort='reference',direction='asc',limitIndex,offsetIndex}){
 const order=sort==='amount'?'amount':sort==='date'?"COALESCE(to_jsonb(filtered)->>'date',to_jsonb(filtered)->>'invoice_date','')":'reference';
 return `WITH totals AS (SELECT currency,COUNT(*)::int AS count,SUM(amount) AS amount FROM (${source}) filtered GROUP BY currency),
 paged AS (SELECT * FROM (${source}) filtered ORDER BY ${order} ${direction==='desc'?'DESC':'ASC'},id LIMIT $${limitIndex} OFFSET $${offsetIndex})
 SELECT COALESCE((SELECT SUM(count) FROM totals),0)::int AS count,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('currency',currency,'amount',amount)) FROM totals),'[]'::jsonb) AS totals,
 COALESCE((SELECT jsonb_agg(to_jsonb(paged)) FROM paged),'[]'::jsonb) AS items`;
}
export const financeQueueRow=row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));
