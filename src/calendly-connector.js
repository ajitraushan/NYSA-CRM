const disabled=Object.freeze({prepared:false,reasonCode:'connector_disabled'});

export function createDisabledCalendlyConnector(){
  return Object.freeze({enabled:false,providerKey:'calendly',async createSchedulingLink(){return disabled;},async getScheduledEvent(){return null;}});
}

export function createLocalCalendlyConnector(){
  const links=new Map(),events=new Map();let sequence=0;
  return Object.freeze({
    enabled:true,providerKey:'calendly-local',networkEnabled:false,
    async createSchedulingLink({eventTypeRef,correlationRef}={}){
      if(!eventTypeRef||!correlationRef)throw new Error('Mapped event type and correlation reference are required');
      if(links.has(correlationRef))return{...links.get(correlationRef),replayed:true};
      const value=Object.freeze({prepared:true,providerLinkRef:`local-link-${++sequence}`,schedulingUrl:`http://127.0.0.1/calendly/${sequence}`,correlationRef});links.set(correlationRef,value);return value;
    },
    async getScheduledEvent(ref){return events.get(ref)||null;},
    emitBooking({correlationRef,eventTypeRef,hostRef,startsAt,endsAt,timezone='Asia/Dubai'}={}){const event=Object.freeze({providerEventRef:`local-provider-event-${++sequence}`,eventRef:`local-event-${sequence}`,inviteeRef:`local-invitee-${sequence}`,eventFamily:'invitee.created',correlationRef,eventTypeRef,hostRef,startsAt,endsAt,timezone});events.set(event.eventRef,event);return event;},
    emitCancellation(eventRef){const original=events.get(eventRef);if(!original)throw new Error('Local Calendly event is unknown');return Object.freeze({...original,providerEventRef:`local-provider-event-${++sequence}`,eventFamily:'invitee.canceled'});}
  });
}

export function createCalendlyApiConnector({fetchImpl=globalThis.fetch,enabled=false}={}){
  if(enabled!==true)return createDisabledCalendlyConnector();
  if(typeof fetchImpl!=='function')throw new Error('Calendly fetch implementation is required');
  return Object.freeze({
    enabled:true,providerKey:'calendly',networkEnabled:true,
    async createSchedulingLink({accessToken,eventTypeRef}={}){
      if(!accessToken||!eventTypeRef)throw new Error('Authorized Calendly scheduling context is incomplete');
      const response=await fetchImpl('https://api.calendly.com/scheduling_links',{method:'POST',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({max_event_count:1,owner:eventTypeRef,owner_type:'EventType'})});
      if(!response.ok)throw new Error('Calendly scheduling link could not be prepared');const body=await response.json();return{prepared:true,providerLinkRef:body.resource?.booking_url||body.resource?.uri||null,schedulingUrl:body.resource?.booking_url||null};
    },
    async getScheduledEvent({accessToken,eventRef}={}){
      if(!accessToken||!eventRef)throw new Error('Authorized Calendly event context is incomplete');
      const response=await fetchImpl(eventRef,{headers:{Authorization:`Bearer ${accessToken}`}});if(response.status===404)return null;if(!response.ok)throw new Error('Calendly event could not be reconciled');return response.json();
    }
  });
}
