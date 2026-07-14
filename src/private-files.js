import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.env.PRIVATE_STORAGE_DIR||path.join(process.cwd(),'storage','private'));
const TYPES={
  'image/jpeg':{ext:'.jpg',magic:b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff},
  'image/png':{ext:'.png',magic:b=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},
  'image/webp':{ext:'.webp',magic:b=>b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'},
  'application/pdf':{ext:'.pdf',magic:b=>b.subarray(0,5).toString()==='%PDF-'},
  'text/plain':{ext:'.txt',magic:b=>!b.subarray(0,1024).includes(0)},
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{ext:'.docx',magic:b=>b[0]===0x50&&b[1]===0x4b},
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':{ext:'.xlsx',magic:b=>b[0]===0x50&&b[1]===0x4b}
};
export function decodeAndValidateFile({base64,mediaType,fileName,maxBytes,allowedTypes}){
  if(!base64||!mediaType||!fileName)return {error:'fileName, mediaType and base64 are required'};
  const type=TYPES[mediaType];if(!type||!allowedTypes.includes(mediaType))return {error:'Unsupported file type'};
  const encoded=String(base64).replace(/\s/g,'');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4!==0)return {error:'Invalid base64 file data'};
  let buffer;try{buffer=Buffer.from(encoded,'base64');}catch{return {error:'Invalid base64 file data'};}
  if(!buffer.length||buffer.length>maxBytes)return {error:`File must be between 1 and ${maxBytes} bytes`};
  if(!type.magic(buffer))return {error:'File content does not match its declared type'};
  if(buffer.toString('latin1').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')||buffer.subarray(0,2).toString()==='MZ')return {error:'File content was rejected by security validation'};
  const safeName=path.basename(fileName).replace(/[^a-zA-Z0-9._ -]/g,'_');
  if(!safeName.toLowerCase().endsWith(type.ext))return {error:'File extension does not match its declared type'};
  return {buffer,fileName:safeName,fileHash:crypto.createHash('sha256').update(buffer).digest('hex')};
}
export async function savePrivate(buffer,extension=''){
  await fs.mkdir(root,{recursive:true});const key=`${crypto.randomUUID()}${extension}`;await fs.writeFile(path.join(root,key),buffer,{flag:'wx'});return key;
}
export async function readPrivate(key){
  const file=path.resolve(root,path.basename(key));if(!file.startsWith(root+path.sep))throw new Error('Invalid storage key');return fs.readFile(file);
}
export async function removePrivate(key){await fs.unlink(path.join(root,path.basename(key))).catch(()=>{});}
export function privateRoot(){return root;}
