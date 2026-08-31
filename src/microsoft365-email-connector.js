const disabled=Object.freeze({accepted:false,retryable:false,reasonCode:'connector_disabled'});

export function createDisabledMicrosoft365Connector(){
  return Object.freeze({enabled:false,providerKey:'microsoft365-email',async dispatch(){return disabled;},async fetchMessage(){return null;}});
}

export function createLocalMicrosoft365Connector({outcome='accepted'}={}){
  const sent=[],messages=new Map();let sequence=0;
  return Object.freeze({
    enabled:true,providerKey:'microsoft365-email-local',networkEnabled:false,
    async dispatch(attempt){
      const fingerprint=String(attempt?.fingerprint||'');
      if(!fingerprint)throw new Error('Email attempt fingerprint is required');
      const existing=sent.find(item=>item.fingerprint===fingerprint);if(existing)return{...existing,replayed:true};
      if(outcome==='temporary_failure')return{accepted:false,retryable:true,reasonCode:'provider_temporarily_unavailable'};
      if(outcome==='unknown')return{accepted:false,retryable:false,outcomeUnknown:true,reasonCode:'provider_outcome_unknown'};
      if(outcome==='rejected')return{accepted:false,retryable:false,reasonCode:'provider_rejected'};
      const result={accepted:true,retryable:false,reasonCode:'provider_accepted',providerMessageRef:`local-message-${++sequence}`,providerConversationRef:`local-thread-${sequence}`,fingerprint};
      sent.push(result);messages.set(result.providerMessageRef,Object.freeze({...result,direction:'outbound'}));return result;
    },
    async fetchMessage(ref){return messages.get(ref)||null;},
    injectReply({providerConversationRef,fingerprint}){const item=Object.freeze({providerMessageRef:`local-message-${++sequence}`,providerConversationRef,fingerprint,direction:'inbound'});messages.set(item.providerMessageRef,item);return item;},
    sent:()=>sent.map(item=>({...item}))
  });
}

export function createMicrosoft365GraphConnector({fetchImpl=globalThis.fetch,enabled=false}={}){
  if(enabled!==true)return createDisabledMicrosoft365Connector();
  if(typeof fetchImpl!=='function')throw new Error('Microsoft Graph fetch implementation is required');
  return Object.freeze({
    enabled:true,providerKey:'microsoft365-email',networkEnabled:true,
    async dispatch({accessToken,message,fingerprint}={}){
      if(!accessToken||!message||!fingerprint)throw new Error('Authorized Email dispatch context is incomplete');
      const response=await fetchImpl('https://graph.microsoft.com/v1.0/me/sendMail',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json','Idempotency-Key':fingerprint},body:JSON.stringify({message,saveToSentItems:true})});
      if(response.status===202)return{accepted:true,retryable:false,reasonCode:'provider_accepted',providerRequestRef:response.headers.get('request-id')||null};
      if(response.status===408||response.status===429||response.status>=500)return{accepted:false,retryable:true,reasonCode:'provider_temporarily_unavailable'};
      return{accepted:false,retryable:false,reasonCode:'provider_rejected'};
    },
    async fetchMessage({accessToken,resourceRef}={}){
      if(!accessToken||!resourceRef)throw new Error('Authorized message read context is incomplete');
      const response=await fetchImpl(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(resourceRef)}?$select=id,conversationId,internetMessageId,receivedDateTime,sentDateTime,subject,body,from,toRecipients`,{headers:{Authorization:`Bearer ${accessToken}`}});
      if(response.status===404)return null;if(!response.ok)throw new Error('Microsoft message could not be reconciled');return response.json();
    }
  });
}
