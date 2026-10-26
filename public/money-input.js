// Shared browser/server parser: resolve shorthand before persisting numeric money.
export function parseReceiptAmount(value) {
  const text=String(value??'').trim();
  const match=text.match(/^((?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)\s*([km])?$/i);
  if(!match)throw new Error('Enter a positive amount, such as 100000, 100K or 1.5M');
  const [whole,fraction='']=match[1].replaceAll(',','').split('.');
  if(whole.length+fraction.length>24)throw new Error('Amount is too large or too precise');
  const scale=match[2]?.toLowerCase()==='m'?1000000n:match[2]?1000n:1n;
  const denominator=10n**BigInt(fraction.length),numerator=BigInt((whole||'0')+fraction)*scale*100n;
  if(numerator%denominator!==0n)throw new Error('Amount must resolve to whole cents (two decimal places)');
  const cents=numerator/denominator;
  if(cents<=0n||cents>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('Enter a positive amount within the supported range');
  return Number(cents)/100;
}
