import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(process.env.PRIVATE_STORAGE_DIR||path.join(process.cwd(),'storage','private'));
const TYPES={
  'image/jpeg':{extensions:['.jpg','.jpeg'],magic:b=>b[0]===0xff&&b[1]===0xd8&&b[2]===0xff},
  'image/png':{extensions:['.png'],magic:b=>b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))},
  'image/webp':{extensions:['.webp'],magic:b=>b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP'},
  'application/pdf':{extensions:['.pdf'],magic:b=>b.subarray(0,5).toString()==='%PDF-'},
  'text/plain':{extensions:['.txt'],magic:b=>!b.subarray(0,1024).includes(0)},
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':{extensions:['.docx'],magic:b=>b[0]===0x50&&b[1]===0x4b},
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':{extensions:['.xlsx'],magic:b=>b[0]===0x50&&b[1]===0x4b}
};
export const PROPERTY_IMAGE_POLICY=Object.freeze({maxBytes:5*1024*1024,minShortEdge:720,minLongEdge:1200,maxEdge:6000,maxPixels:24000000,minAspectRatio:0.5,maxAspectRatio:2});
const uint24le=(buffer,offset)=>buffer[offset]|(buffer[offset+1]<<8)|(buffer[offset+2]<<16);
export function imageDimensions(buffer,mediaType){
  if(mediaType==='image/png'&&buffer.length>=24)return{width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(mediaType==='image/jpeg'){
    let offset=2;while(offset+8<buffer.length){if(buffer[offset]!==0xff){offset++;continue;}const marker=buffer[offset+1];if(marker===0xd8||marker===0xd9){offset+=2;continue;}if(offset+4>buffer.length)break;const length=buffer.readUInt16BE(offset+2);if(length<2||offset+2+length>buffer.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:buffer.readUInt16BE(offset+7),height:buffer.readUInt16BE(offset+5)};offset+=2+length;}
  }
  if(mediaType==='image/webp'&&buffer.length>=30){const chunk=buffer.subarray(12,16).toString('ascii');if(chunk==='VP8X')return{width:uint24le(buffer,24)+1,height:uint24le(buffer,27)+1};if(chunk==='VP8 '&&buffer.length>=30&&buffer.subarray(23,26).equals(Buffer.from([0x9d,0x01,0x2a])))return{width:buffer.readUInt16LE(26)&0x3fff,height:buffer.readUInt16LE(28)&0x3fff};if(chunk==='VP8L'&&buffer.length>=25&&buffer[20]===0x2f){const bits=buffer.readUInt32LE(21);return{width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};}}
  return null;
}
export function validatePropertyImage(buffer,mediaType,policy=PROPERTY_IMAGE_POLICY){
  const dimensions=imageDimensions(buffer,mediaType);if(!dimensions||!dimensions.width||!dimensions.height)return{error:'Image dimensions could not be read safely'};
  const {width,height}=dimensions,shortEdge=Math.min(width,height),longEdge=Math.max(width,height),aspect=width/height;
  if(shortEdge<policy.minShortEdge||longEdge<policy.minLongEdge)return{error:`Image is too small (${width}×${height}); use at least ${policy.minLongEdge}px on the long edge and ${policy.minShortEdge}px on the short edge`};
  if(longEdge>policy.maxEdge||width*height>policy.maxPixels)return{error:`Image dimensions are too large (${width}×${height}); maximum ${policy.maxEdge}px on either edge and ${policy.maxPixels/1000000} megapixels`};
  if(aspect<policy.minAspectRatio||aspect>policy.maxAspectRatio)return{error:`Image aspect ratio is too extreme (${width}×${height}); use a ratio between 1:2 and 2:1`};
  return dimensions;
}
export function decodeAndValidateFile({base64,mediaType,fileName,maxBytes,allowedTypes}){
  if(!base64||!mediaType||!fileName)return {error:'fileName, mediaType and base64 are required'};
  const type=TYPES[mediaType];if(!type||!allowedTypes.includes(mediaType))return {error:'Unsupported file type'};
  const encoded=String(base64).replace(/\s/g,'');if(!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)||encoded.length%4!==0)return {error:'Invalid base64 file data'};
  let buffer;try{buffer=Buffer.from(encoded,'base64');}catch{return {error:'Invalid base64 file data'};}
  if(!buffer.length||buffer.length>maxBytes)return {error:`File must be between 1 and ${maxBytes} bytes`};
  if(!type.magic(buffer))return {error:'File content does not match its declared type'};
  if(buffer.toString('latin1').includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')||buffer.subarray(0,2).toString()==='MZ')return {error:'File content was rejected by security validation'};
  const safeName=path.basename(fileName).replace(/[^a-zA-Z0-9._ -]/g,'_');
  if(!type.extensions.some(extension=>safeName.toLowerCase().endsWith(extension)))return {error:`File extension does not match its declared type; use ${type.extensions.join(' or ')}`};
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
