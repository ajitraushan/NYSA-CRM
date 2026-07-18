import zlib from 'node:zlib';

const PAGE={width:595,height:842,margin:42};
const C={ink:[0.10,0.12,0.11],muted:[0.42,0.44,0.41],gold:[0.62,0.47,0.20],pale:[0.95,0.94,0.91],line:[0.84,0.83,0.79],white:[1,1,1]};
const clean=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7e]/g,' ').replace(/\s+/g,' ').trim();
const pdfText=value=>clean(value).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const color=values=>values.join(' ');
const money=(value,currency='AED')=>value===null||value===undefined?'Not recorded':`${currency} ${Number(value).toLocaleString('en-US',{maximumFractionDigits:0})}`;
const compactMoney=(value,currency='AED')=>{
  if(value===null||value===undefined||value==='')return 'Open';
  const amount=Number(value),format=(divisor,suffix)=>`${(amount/divisor).toLocaleString('en-US',{maximumFractionDigits:2})}${suffix}`;
  return `${currency} ${Math.abs(amount)>=1000000?format(1000000,'m'):Math.abs(amount)>=1000?format(1000,'k'):amount.toLocaleString('en-US',{maximumFractionDigits:0})}`;
};
const date=value=>value?new Intl.DateTimeFormat('en-AE',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value)):'Reconfirm before viewing';
const label=value=>clean(String(value||'').replaceAll('_',' ')).replace(/\b\w/g,x=>x.toUpperCase());

function wrap(value,maxWidth,size=10){
  const words=clean(value).split(' ').filter(Boolean),lines=[];let line='';
  const width=text=>text.length*size*0.51;
  for(const word of words){const next=line?`${line} ${word}`:word;if(width(next)<=maxWidth||!line)line=next;else{lines.push(line);line=word;}}
  if(line)lines.push(line);return lines.length?lines:[''];
}

function jpegSize(buffer){
  let offset=2;while(offset+8<buffer.length){if(buffer[offset]!==0xff){offset++;continue;}const marker=buffer[offset+1],length=buffer.readUInt16BE(offset+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5)};if(length<2)break;offset+=2+length;}return null;
}
function unfilterPng(raw,width,height,channels){
  const stride=width*channels,out=Buffer.alloc(stride*height);let source=0;
  for(let row=0;row<height;row++){const filter=raw[source++];for(let x=0;x<stride;x++){const value=raw[source++],left=x>=channels?out[row*stride+x-channels]:0,up=row?out[(row-1)*stride+x]:0,upperLeft=row&&x>=channels?out[(row-1)*stride+x-channels]:0;let predictor=0;if(filter===1)predictor=left;else if(filter===2)predictor=up;else if(filter===3)predictor=Math.floor((left+up)/2);else if(filter===4){const p=left+up-upperLeft,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upperLeft);predictor=pa<=pb&&pa<=pc?left:pb<=pc?up:upperLeft;}out[row*stride+x]=(value+predictor)&255;}}
  return out;
}
function pngImage(buffer){
  if(buffer.readUInt32BE(0)!==0x89504e47)return null;const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),depth=buffer[24],type=buffer[25],interlace=buffer[28];if(depth!==8||interlace!==0||![0,2,4,6].includes(type))return null;const channels={0:1,2:3,4:2,6:4}[type],chunks=[];for(let p=8;p+12<=buffer.length;){const length=buffer.readUInt32BE(p),name=buffer.subarray(p+4,p+8).toString();if(name==='IDAT')chunks.push(buffer.subarray(p+8,p+8+length));p+=12+length;if(name==='IEND')break;}const pixels=unfilterPng(zlib.inflateSync(Buffer.concat(chunks)),width,height,channels),colors=type===0||type===4?1:3,rgb=Buffer.alloc(width*height*colors),alpha=(type===4||type===6)?Buffer.alloc(width*height):null;for(let i=0,j=0,a=0;i<pixels.length;i+=channels){if(colors===1)rgb[j++]=pixels[i];else{rgb[j++]=pixels[i];rgb[j++]=pixels[i+1];rgb[j++]=pixels[i+2];}if(alpha)alpha[a++]=pixels[i+channels-1];}return{width,height,colors,data:zlib.deflateSync(rgb),alpha:alpha?zlib.deflateSync(alpha):null};
}

class PdfDoc{
  constructor(){this.objects=[];this.pages=[];this.catalog=this.add('');this.pagesId=this.add('');this.regular=this.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');this.bold=this.add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');this.images=[];}
  add(value){this.objects.push(value);return this.objects.length;}
  image(buffer,mediaType){try{if(mediaType==='image/jpeg'){const size=jpegSize(buffer);if(!size)return null;const id=this.add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${size.width} /Height ${size.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${buffer.length} >>\nstream\n`),buffer,Buffer.from('\nendstream')]));return{id,width:size.width,height:size.height};}if(mediaType==='image/png'){const png=pngImage(buffer);if(!png)return null;const smask=png.alpha?this.add(Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${png.width} /Height ${png.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${png.alpha.length} >>\nstream\n`),png.alpha,Buffer.from('\nendstream')])):null;const dict=`<< /Type /XObject /Subtype /Image /Width ${png.width} /Height ${png.height} /ColorSpace /Device${png.colors===1?'Gray':'RGB'} /BitsPerComponent 8 /Filter /FlateDecode${smask?` /SMask ${smask} 0 R`:''} /Length ${png.data.length} >>\nstream\n`;const id=this.add(Buffer.concat([Buffer.from(dict),png.data,Buffer.from('\nendstream')]));return{id,width:png.width,height:png.height};}}catch{}return null;}
  page(commands,images={}){const content=commands.join('\n'),stream=this.add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`),xobjects=Object.entries(images).map(([name,img])=>`/${name} ${img.id} 0 R`).join(' '),page=this.add(`<< /Type /Page /Parent ${this.pagesId} 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${this.regular} 0 R /F2 ${this.bold} 0 R >>${xobjects?` /XObject << ${xobjects} >>`:''} >> /Contents ${stream} 0 R >>`);this.pages.push(page);}
  finish(){this.objects[this.catalog-1]=`<< /Type /Catalog /Pages ${this.pagesId} 0 R >>`;this.objects[this.pagesId-1]=`<< /Type /Pages /Kids [${this.pages.map(x=>`${x} 0 R`).join(' ')}] /Count ${this.pages.length} >>`;let out=Buffer.from('%PDF-1.4\n'),offsets=[0];for(let i=0;i<this.objects.length;i++){offsets.push(out.length);const object=Buffer.isBuffer(this.objects[i])?this.objects[i]:Buffer.from(this.objects[i]);out=Buffer.concat([out,Buffer.from(`${i+1} 0 obj\n`),object,Buffer.from('\nendobj\n')]);}const xref=out.length;out=Buffer.concat([out,Buffer.from(`xref\n0 ${this.objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size ${this.objects.length+1} /Root ${this.catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`)]);return out;}
}

function canvas(){const c=[];return{c,rect(x,y,w,h,fill=C.pale,stroke=null){c.push(`${color(fill)} rg${stroke?` ${color(stroke)} RG`:''} ${x} ${PAGE.height-y-h} ${w} ${h} re ${stroke?'B':'f'}`);},circle(x,y,r,fill=C.gold){const k=.55228475*r,py=PAGE.height-y;c.push(`${color(fill)} rg ${x+r} ${py} m ${x+r} ${py+k} ${x+k} ${py+r} ${x} ${py+r} c ${x-k} ${py+r} ${x-r} ${py+k} ${x-r} ${py} c ${x-r} ${py-k} ${x-k} ${py-r} ${x} ${py-r} c ${x+k} ${py-r} ${x+r} ${py-k} ${x+r} ${py} c f`);},line(x1,y1,x2,y2,stroke=C.line,width=1){c.push(`${color(stroke)} RG ${width} w ${x1} ${PAGE.height-y1} m ${x2} ${PAGE.height-y2} l S`);},text(value,x,y,{size=10,bold=false,fill=C.ink}={}){c.push(`${color(fill)} rg BT /F${bold?'2':'1'} ${size} Tf ${x} ${PAGE.height-y-size} Td (${pdfText(value)}) Tj ET`);},paragraph(value,x,y,width,{size=10,bold=false,fill=C.ink,leading=size*1.32,maxLines=99}={}){const lines=wrap(value,width,size).slice(0,maxLines);lines.forEach((line,i)=>this.text(line,x,y+i*leading,{size,bold,fill}));return lines.length*leading;},image(name,img,x,y,w,h){const scale=Math.min(w/img.width,h/img.height),dw=img.width*scale,dh=img.height*scale,dx=x+(w-dw)/2,dy=PAGE.height-y-(h+dh)/2;c.push(`q ${dw} 0 0 ${dh} ${dx} ${dy} cm /${name} Do Q`);}};}
function header(draw,organization,logo,pageNo,total){if(logo)draw.image('Logo',logo,PAGE.margin,28,70,46);draw.text(organization.displayName||'NYSA Realty',logo?122:PAGE.margin,36,{size:13,bold:true});draw.text('PRIVATE BUYER PROPOSAL',logo?122:PAGE.margin,56,{size:7,bold:true,fill:C.gold});draw.text(`Page ${pageNo} of ${total}`,500,47,{size:7,fill:C.muted});draw.line(PAGE.margin,86,PAGE.width-PAGE.margin,86,C.gold,1.5);}
function footer(draw,organization,disclaimer){draw.line(PAGE.margin,790,PAGE.width-PAGE.margin,790,C.line,.7);draw.paragraph(disclaimer,PAGE.margin,798,390,{size:6.5,fill:C.muted,maxLines:2,leading:8});draw.text(organization.proposalFooter||`${organization.displayName} | Private customer proposal`,405,809,{size:6.5,fill:C.muted});}
function chipWidth(value){return Math.min(178,Math.max(48,clean(value).length*4.6+18));}
function chip(draw,value,x,y){const width=chipWidth(value);draw.rect(x,y,width,22,C.pale,C.line);draw.text(value,x+9,y+6,{size:7.2});return width;}
function journey(draw,stages,top){
  draw.text('INDICATIVE PURCHASE JOURNEY',PAGE.margin,top,{size:9,bold:true,fill:C.gold});
  const values=(stages||[]).slice(0,6),nodeY=top+31,startX=62,endX=533,spacing=values.length>1?(endX-startX)/(values.length-1):0;
  if(values.length>1)draw.line(startX,nodeY,endX,nodeY,C.gold,1.2);
  values.forEach((stage,i)=>{const x=startX+i*spacing;draw.circle(x,nodeY,10,C.gold);draw.text(String(i+1),x-2.5,nodeY-4,{size:6.5,bold:true,fill:C.white});draw.paragraph(stage.label,x-37,nodeY+17,74,{size:6.2,bold:true,maxLines:2,leading:7.5});draw.paragraph(stage.guidance,x-37,nodeY+34,74,{size:5.4,fill:C.muted,maxLines:2,leading:6.5});});
  return top+92;
}
function nextSteps(draw,top){
  draw.text('NEXT STEPS',PAGE.margin,top,{size:9,bold:true,fill:C.gold});
  ['Confirm shortlist','Arrange viewing','Verify finance readiness'].forEach((value,i)=>{const x=PAGE.margin+i*170;draw.rect(x,top+17,160,42,C.pale,C.line);draw.circle(x+20,top+38,9,C.gold);draw.text(String(i+1),x+17.5,top+34.5,{size:6.5,bold:true,fill:C.white});draw.paragraph(value,x+38,top+28,112,{size:7.2,bold:true,maxLines:2,leading:8.5});});
  return top+59;
}

export function makeProposalPdf(data){
  const {proposal,version,organization,recipient,requirement,properties,narrative,disclaimer,media=[],logo=null}=data,doc=new PdfDoc(),logoImage=logo?doc.image(logo.buffer,logo.mediaType):null,mediaImages=new Map();
  for(const item of media){const image=doc.image(item.buffer,item.mediaType);if(image)mediaImages.set(item.id,image);}
  const total=1+Math.max(1,properties.length);
  {
    const d=canvas(),images={};if(logoImage)images.Logo=logoImage;header(d,organization,logoImage,1,total);
    d.text('YOUR DUBAI PROPERTY SHORTLIST',PAGE.margin,108,{size:19,bold:true,fill:C.gold});d.text(clean(proposal.proposalNumber),PAGE.margin,135,{size:8.5,bold:true,fill:C.gold});d.paragraph(`${clean(proposal.title)} | Version ${version}`,PAGE.margin,148,511,{size:7.5,fill:C.muted,maxLines:1});
    d.rect(PAGE.margin,163,511,68,C.pale,C.line);const identity=recipient.idDocumentType&&recipient.idDocumentLast4?`${recipient.idDocumentType==='emirates_id'?'Emirates ID':'Passport'} ending ${recipient.idDocumentLast4}`:'Not recorded';
    [['PREPARED FOR',recipient.fullName],['CUSTOMER ADDRESS',recipient.postalAddress||'Not recorded'],['MOBILE',recipient.phone||'Not recorded']].forEach(([k,v],i)=>{const x=PAGE.margin+(i%2)*255,y=175+Math.floor(i/2)*31;d.text(k,x+12,y,{size:6,bold:true,fill:C.gold});d.text(v,x+12,y+12,{size:8.5,bold:true});});
    d.text(`Identity reference: ${identity}`,PAGE.margin,239,{size:7,fill:C.muted});d.text('YOUR REQUIREMENTS',PAGE.margin,265,{size:9.5,bold:true,fill:C.gold});
    const currency=organization.defaultCurrency||'AED',budget=requirement.budgetMin||requirement.budgetMax?`${compactMoney(requirement.budgetMin,currency)} - ${compactMoney(requirement.budgetMax,currency)}`:null,chips=[label(requirement.businessLine),label(requirement.purpose),...(requirement.areas||[]).slice(0,2),...(requirement.propertyTypes||[]).slice(0,2),requirement.bedroomsMin?`${requirement.bedroomsMin}+ bedrooms`:null,budget,label(requirement.fundingMethod),requirement.timelineCode].filter(Boolean);
    let x=PAGE.margin,y=285;for(const value of chips){const width=chipWidth(value);if(x+width>PAGE.width-PAGE.margin){x=PAGE.margin;y+=27;}x+=chip(d,value,x,y)+6;}
    y+=38;d.text('RECOMMENDED MATCHES',PAGE.margin,y,{size:9.5,bold:true,fill:C.gold});d.text(`${properties.length} shortlisted ${properties.length===1?'property':'properties'}`,430,y,{size:7,fill:C.muted});y+=20;
    properties.forEach((p,i)=>{d.rect(PAGE.margin,y,511,56,i%2?C.white:C.pale,C.line);d.text(`MATCH ${i+1}`,PAGE.margin+10,y+9,{size:6.5,bold:true,fill:C.gold});d.paragraph(p.project,PAGE.margin+62,y+7,230,{size:9.5,bold:true,maxLines:1});d.text(`Inventory ID: ${p.inventoryReference||'Not recorded'}`,PAGE.margin+62,y+24,{size:6.5,fill:C.muted});d.text(`${p.area} | ${p.propertyType} | ${p.bedrooms||'-'} bed | ${p.sizeSqft?Number(p.sizeSqft).toLocaleString('en-US')+' sq ft':'Size not recorded'}`,PAGE.margin+62,y+38,{size:7.2});d.text(money(p.price,p.currency||currency),430,y+10,{size:8.5,bold:true,fill:C.gold});d.text(`Available: ${date(p.availabilityConfirmedAt)}`,394,y+35,{size:6.2,fill:C.muted});y+=56;});
    const afterJourney=journey(d,narrative.indicativeTimeline?.stages,y+15),afterNext=nextSteps(d,afterJourney+5),preparedY=Math.min(758,afterNext+12);d.text('Prepared by',PAGE.margin,preparedY,{size:6.5,bold:true,fill:C.gold});d.text(`${data.agent.name} | ${data.preparedAt}`,PAGE.margin,preparedY+12,{size:7.2});footer(d,organization,disclaimer);doc.page(d.c,images);
  }
  properties.forEach((p,index)=>{
    const d=canvas(),images={};if(logoImage)images.Logo=logoImage;header(d,organization,logoImage,index+2,total);d.text(`MATCH ${index+1} OF ${properties.length}`,PAGE.margin,106,{size:7,bold:true,fill:C.gold});d.paragraph(p.project,PAGE.margin,122,330,{size:17,bold:true,maxLines:2,leading:20});d.text(`${p.area} | ${p.propertyType} | ${p.handoverDate||'Handover not recorded'}`,PAGE.margin,158,{size:8,fill:C.muted});d.text(money(p.price,p.currency||organization.defaultCurrency),420,124,{size:13,bold:true,fill:C.gold});
    const chosen=media.filter(x=>x.listingId===p.id).slice(0,2);for(let slot=0;slot<2;slot++){const item=chosen[slot],img=item&&mediaImages.get(item.id),name=`M${index}_${slot}`;d.rect(PAGE.margin+slot*258,181,247,220,C.pale,C.line);if(img){images[name]=img;d.image(name,img,PAGE.margin+slot*258+3,184,241,197);d.text(item.caption||item.title||`Approved image ${slot+1}`,PAGE.margin+slot*258+8,385,{size:6.5,fill:C.muted});}else d.text('No approved image selected',PAGE.margin+slot*258+65,285,{size:8,fill:C.muted});}
    const facts=[['INVENTORY ID',p.inventoryReference||'Not recorded'],['BUILT-UP AREA',p.sizeSqft?`${Number(p.sizeSqft).toLocaleString('en-US')} sq ft`:'Not recorded'],['DEVELOPER',p.developer||'Not recorded'],['BEDROOMS',p.bedrooms||'Not recorded'],['PARKING',p.parkingSpaces||'Not recorded'],['AVAILABILITY',date(p.availabilityConfirmedAt)]];facts.forEach(([k,v],i)=>{const col=i%3,row=Math.floor(i/3),x=PAGE.margin+col*170,y=422+row*58;d.rect(x,y,162,50,C.pale,C.line);d.text(k,x+9,y+8,{size:6.2,bold:true,fill:C.gold});d.paragraph(v,x+9,y+22,144,{size:8.5,bold:true,maxLines:2});});
    [['WHY IT MATCHES',narrative.suitability||'Selected against the recorded customer requirements and current inventory facts.'],['HIGHLIGHTS',narrative.highlights||'Review the verified property facts, availability and approved media above.'],['IMPORTANT TRADE-OFFS',narrative.assumptions||'Availability, price and property particulars remain subject to reconfirmation.']].forEach(([k,v],i)=>{const x=PAGE.margin+i*170;d.rect(x,548,162,154,i%2?C.white:C.pale,C.line);d.text(k,x+10,560,{size:6.5,bold:true,fill:C.gold});d.paragraph(v,x+10,578,142,{size:8.2,leading:10.5,maxLines:10});});footer(d,organization,disclaimer);doc.page(d.c,images);
  });
  return doc.finish();
}
