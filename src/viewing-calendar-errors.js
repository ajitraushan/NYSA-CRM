export function viewingCalendarFailure(error){
 if(['invalid_grant','invalid_client','unauthorized_client'].includes(error.providerCode)||error.providerStatus===400||error.providerStatus===401)return{status:409,code:'CALENDAR_RECONNECT_REQUIRED',error:'Google Calendar authorization could not be refreshed. Ask the administrator to reconnect Google Calendar, then retry this saved viewing.'};
 if(error.providerStatus===403)return{status:403,code:'CALENDAR_PERMISSION_DENIED',error:'The connected Google account cannot create an event on this calendar. Ask the administrator to check calendar access.'};
 if(/authenticate data|configured/i.test(error.message||''))return{status:503,code:'CALENDAR_CONFIGURATION_REQUIRED',error:'Google Calendar connection configuration requires administrator attention. The viewing remains saved.'};
 return{status:502,code:'CALENDAR_SEND_UNCONFIRMED',error:'The calendar invitation could not be confirmed. The viewing remains saved. Retry this same viewing; the system will reconcile its existing event to avoid duplicate invitations.'};
}
