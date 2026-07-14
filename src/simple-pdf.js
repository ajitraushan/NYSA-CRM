function esc(value){return String(value??'').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[^\x20-\x7e]/g,'?');}
export function makeTextPdf(lines){
  const brand=String(lines[0]||'NYSA REALTY').toUpperCase(),wrapped=[];
  for(const raw of lines.slice(1)){const value=String(raw??'');if(!value){wrapped.push('');continue;}for(let rest=value;rest.length;){if(rest.length<=88){wrapped.push(rest);break;}let cut=rest.lastIndexOf(' ',88);if(cut<45)cut=88;wrapped.push(rest.slice(0,cut));rest=rest.slice(cut).trim();}}
  const pages=[];for(let i=0;i<wrapped.length;i+=38)pages.push(wrapped.slice(i,i+38));if(!pages.length)pages.push(['']);
  const objects=[];const add=s=>(objects.push(s),objects.length);const catalog=add(''),pagesId=add('');
  const regular=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'),bold=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');const pageIds=[];
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
    let y=790;const commands=['0.12 0.15 0.18 rg',`BT /F2 17 Tf 50 ${y} Td (${esc(brand)}) Tj ET`,'0.72 0.56 0.22 RG 1.5 w 50 770 m 545 770 l S'];y=745;
    for(const line of pages[pageIndex]){const heading=line&&line===line.toUpperCase()&&line.length<55;if(!line){y-=9;continue;}if(heading)y-=4;commands.push(`0.12 0.15 0.18 rg BT /${heading?'F2':'F1'} ${heading?'12':'10'} Tf 50 ${y} Td (${esc(line)}) Tj ET`);y-=heading?19:14;}
    commands.push(`0.45 0.47 0.50 rg BT /F1 8 Tf 50 28 Td (Private customer proposal - generated ${new Date().toISOString().slice(0,10)}) Tj ET`);
    commands.push(`BT /F1 8 Tf 500 28 Td (Page ${pageIndex+1} of ${pages.length}) Tj ET`);const content=commands.join('\n');
    const stream=add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);pageIds.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objects[catalog-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;objects[pagesId-1]=`<< /Type /Pages /Kids [${pageIds.map(x=>`${x} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
  let out='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(out));out+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(out);out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(out);}
