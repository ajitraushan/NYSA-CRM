const DISABLED_RESULT=Object.freeze({accepted:false,reasonCode:'connector_disabled',retryable:false});

export function createDisabledCommunicationConnector(){
  return Object.freeze({
    enabled:false,
    providerKey:'disabled',
    async dispatch(){return DISABLED_RESULT;}
  });
}

export function requireEnabledCommunicationConnector(connector){
  if(!connector||connector.enabled!==true)throw new Error('Communication connector is disabled');
  if(typeof connector.dispatch!=='function')throw new Error('Communication connector does not implement dispatch');
  return connector;
}
