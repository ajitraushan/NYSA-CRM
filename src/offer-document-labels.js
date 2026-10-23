const small=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function integerWords(n){if(n<20)return small[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+small[n%10]:'');if(n<1000)return small[Math.floor(n/100)]+' hundred'+(n%100?' '+integerWords(n%100):'');for(const [scale,label] of [[1e12,'trillion'],[1e9,'billion'],[1e6,'million'],[1000,'thousand']])if(n>=scale)return integerWords(Math.floor(n/scale))+' '+label+(n%scale?' '+integerWords(n%scale):'');}
export function offerAmountWords(amount,currency='AED'){
 const cents=Math.round(Number(amount)*100);if(!Number.isSafeInteger(cents)||cents<0)throw Object.assign(new Error('Offer amount cannot be represented accurately in words'),{statusCode:400});
 const whole=Math.floor(cents/100),fraction=cents%100,unit=currency==='AED'?'UAE dirhams':new Intl.DisplayNames(['en'],{type:'currency'}).of(currency);
 const words=integerWords(whole)+' '+unit+(fraction?' and '+integerWords(fraction)+(currency==='AED'?' fils':' hundredths'):'')+' only';return words[0].toUpperCase()+words.slice(1);
}
export function offerDownloadName({listing={},revision={}}){
 const clean=value=>String(value||'').normalize('NFKC').replace(/[^\p{L}\p{N} -]/gu,' ').trim().replace(/[\s-]+/g,'-').slice(0,70);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(revision.createdAt));
 return ['NYSA_Offer_Letter',clean(listing.project||listing.building||'Property'),listing.unitReference?'Unit-'+clean(listing.unitReference):null,day,'Rev-'+Number(revision.revisionNumber)].filter(Boolean).join('_')+'.pdf';
}
export function pdfDisposition(name,inline=true){const ascii=String(name).replace(/[^\x20-\x7e]|["\\\r\n]/g,'_');return `${inline?'inline':'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g,x=>'%'+x.charCodeAt(0).toString(16).toUpperCase())}`;}
