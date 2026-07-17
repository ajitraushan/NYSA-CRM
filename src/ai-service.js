const DEFAULT_MODEL='gpt-5.6-luna';
const DEFAULT_URL='https://api.openai.com/v1/responses';

export class AiServiceError extends Error{
  constructor(message,{code='ai_request_failed',status=502}={}){super(message);this.name='AiServiceError';this.code=code;this.status=status;}
}

export function aiConfiguration(){return{
  configured:Boolean(process.env.OPENAI_API_KEY),
  model:process.env.OPENAI_MODEL||DEFAULT_MODEL,
  endpoint:process.env.OPENAI_API_BASE_URL||DEFAULT_URL,
  timeoutMs:Number(process.env.OPENAI_TIMEOUT_MS||30000),
  maxInputChars:Number(process.env.AI_MAX_INPUT_CHARS||12000)
};}

export function redactSensitiveText(value){return String(value||'')
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'[email removed]')
  .replace(/\b784[-\s]?\d{4}[-\s]?\d{7}[-\s]?\d\b/g,'[identity number removed]')
  .replace(/\b(passport|emirates\s*id|eid)\s*(number|no\.?|#)?\s*[:\-]?\s*[A-Z0-9-]{5,}\b/gi,'$1 [identity number removed]')
  .replace(/(?:\+?\d[\s()-]?){9,15}/g,'[phone removed]')
  .trim();}

function outputText(response){
  if(typeof response?.output_text==='string'&&response.output_text)return response.output_text;
  for(const item of response?.output||[])for(const part of item?.content||[]){
    if(part?.type==='refusal')throw new AiServiceError('The AI service declined this request',{code:'ai_refusal',status:422});
    if(part?.type==='output_text'&&typeof part.text==='string')return part.text;
  }
  throw new AiServiceError('The AI service returned no structured output',{code:'ai_empty_output'});
}

export async function requestStructuredOutput({name,instructions,input,schema,fetchImpl=globalThis.fetch}){
  const config=aiConfiguration();
  if(!config.configured)throw new AiServiceError('AI assistance is not configured',{code:'ai_not_configured',status:503});
  const serialized=JSON.stringify(input);
  if(serialized.length>config.maxInputChars)throw new AiServiceError(`AI input exceeds the ${config.maxInputChars}-character limit`,{code:'ai_input_too_large',status:413});
  if(typeof fetchImpl!=='function')throw new AiServiceError('Server fetch capability is unavailable',{code:'ai_transport_unavailable',status:503});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),config.timeoutMs);
  let response,data;
  try{
    response=await fetchImpl(config.endpoint,{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({model:config.model,store:false,instructions,input:serialized,text:{format:{type:'json_schema',name,strict:true,schema}}})});
    data=await response.json().catch(()=>({}));
  }catch(error){
    if(error?.name==='AbortError')throw new AiServiceError('AI request timed out',{code:'ai_timeout',status:504});
    throw new AiServiceError('AI service is temporarily unavailable',{code:'ai_transport_error',status:502});
  }finally{clearTimeout(timer);}
  if(!response.ok){const safeCode=typeof data?.error?.code==='string'?data.error.code:'provider_error';throw new AiServiceError('AI service request failed',{code:`ai_${safeCode}`,status:502});}
  let result;try{result=JSON.parse(outputText(data));}catch(error){if(error instanceof AiServiceError)throw error;throw new AiServiceError('AI output could not be validated',{code:'ai_invalid_output'});}
  return{result,responseId:data.id||null,model:data.model||config.model,usage:data.usage||null};
}

const stringArray={type:'array',items:{type:'string'},maxItems:12};
const propertyTypeArray={type:'array',items:{type:'string',enum:['Apartment','Villa','Townhouse','Penthouse','Duplex','Plot','Bulk deal']},maxItems:7};
const nullableNumber={type:['number','null']};
const nullableInteger={type:['integer','null']};
const nullableString={type:['string','null']};

export const AI_SCHEMAS={
  requirements_draft:{type:'object',additionalProperties:false,required:['summary','requirementOptions','unansweredQuestions','confidence','warnings'],properties:{
    summary:{type:'string'},confidence:{type:'string',enum:['low','medium','high']},unansweredQuestions:stringArray,warnings:stringArray,
    requirementOptions:{type:'array',minItems:1,maxItems:3,items:{type:'object',additionalProperties:false,required:['optionLabel','businessLine','purpose','propertyTypes','areas','projects','developers','budgetMin','budgetMax','fundingMethod','bedroomsMin','bedroomsMax','timelineCode','mustHaves','preferences','exclusions'],properties:{
      optionLabel:{type:'string'},businessLine:{type:'string',enum:['Sale','Rental','Off-plan','Commercial']},purpose:{type:'string',enum:['own_use','investment','business','other']},propertyTypes:propertyTypeArray,areas:stringArray,projects:stringArray,developers:stringArray,budgetMin:nullableNumber,budgetMax:nullableNumber,fundingMethod:{type:'string',enum:['cash','mortgage','mixed','unknown']},bedroomsMin:nullableInteger,bedroomsMax:nullableInteger,timelineCode:nullableString,mustHaves:stringArray,preferences:stringArray,exclusions:stringArray
    }}}
  }},
  match_explanation:{type:'object',additionalProperties:false,required:['headline','whyItMatches','tradeOffs','customerSummary','evidenceUsed','requiresAgentReview','warning'],properties:{headline:{type:'string'},whyItMatches:{...stringArray,maxItems:4},tradeOffs:{...stringArray,maxItems:4},customerSummary:{type:'string'},evidenceUsed:stringArray,requiresAgentReview:{type:'boolean'},warning:nullableString}},
  missing_information:{type:'object',additionalProperties:false,required:['blocking','recommended','questions','canProceed'],properties:{blocking:{type:'array',items:{type:'object',additionalProperties:false,required:['field','sourceRecord','reason'],properties:{field:{type:'string'},sourceRecord:{type:'string'},reason:{type:'string'}}}},recommended:{type:'array',items:{type:'object',additionalProperties:false,required:['field','sourceRecord','reason'],properties:{field:{type:'string'},sourceRecord:{type:'string'},reason:{type:'string'}}}},questions:stringArray,canProceed:{type:'boolean'}}}
};

export const AI_INSTRUCTIONS={
  requirements_draft:'You assist a Dubai real-estate professional. Convert only the supplied conversation notes into one to three draft requirement options. Never invent facts. Put uncertain or absent details into unansweredQuestions. Separate must-haves, preferences and exclusions. The result is a draft that requires agent and customer confirmation and must not be saved automatically.',
  match_explanation:'You explain a deterministic property comparison. Use only the supplied requirement, property facts and computed comparison evidence. Never change eligibility, create a score, hide failed criteria, claim availability beyond the recorded evidence, or invent amenities. Keep the explanation concise and customer-friendly, and require agent review.',
  missing_information:'Identify information missing for a reliable property match or proposal using only the supplied records and required-field catalogue. Blocking items prevent reliable completion; recommended items improve quality but do not automatically block. Ask concise business questions. Do not request full identity numbers, identity-document images or unrelated personal data.'
};
