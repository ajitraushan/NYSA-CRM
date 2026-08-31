import {
  evaluateCommunicationPolicy,validateCommunicationAttempt,evaluateDispatchGate,
  transitionCommunicationState,validateProviderEventEnvelope,providerEventIdempotencyKey
} from '/modules/communication-domain.js';
import {createLocalCommunicationConnector} from '/modules/communication-local-connector.js';

const $=selector=>document.querySelector(selector);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const scenarioNames={
  happy:'Accepted → delivered → read',retry:'Temporary failure → retry → delivered',
  permanent:'Permanent provider rejection',unknown:'Unknown outcome → manual reconciliation',
  duplicate:'Duplicate delivery event',replay:'Replay attack rejected',policy:'Policy decision blocks dispatch'
};
const state={steps:[],ledger:[],dispatches:0,events:0,duplicates:0,finalState:'Not run',sequence:0};

function resetView(){
  Object.assign(state,{steps:[],ledger:[],dispatches:0,events:0,duplicates:0,finalState:'Not run',sequence:0});
  $('#timeline').innerHTML='<li class="empty-state"><span>◇</span><div><b>No simulation yet</b><small>Select a scenario and run it to inspect every decision.</small></div></li>';
  $('#ledger').innerHTML='<tr><td colspan="5" class="table-empty">No events recorded.</td></tr>';
  $('#dispatch-count').textContent='0';$('#event-count').textContent='0';$('#duplicate-count').textContent='0';$('#final-state').textContent='Not run';
  $('#scenario-label').textContent='Awaiting simulation';setRunState('Ready','idle');
}

function setRunState(label,kind){const el=$('#run-state');el.textContent=label;el.className=`status-dot ${kind}`;}
function timeLabel(){return new Intl.DateTimeFormat('en',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date());}
function safeText(value){return String(value??'').replace(/[^A-Za-z0-9_.: -]/g,'').slice(0,80)}

function addStep(title,detail,kind='ok'){
  state.sequence+=1;state.steps.push({title,detail,kind,time:timeLabel()});
  $('#timeline').innerHTML=state.steps.map((step,index)=>`<li class="${step.kind}"><span class="node">${index+1}</span><div><b>${safeText(step.title)}</b><small>${safeText(step.detail)}</small></div><time>${step.time}</time></li>`).join('');
}

function addLedger(source,event,result,reference,resultKind='ok'){
  state.ledger.push({source,event,result,reference,resultKind});
  $('#ledger').innerHTML=state.ledger.map((row,index)=>`<tr><td>${String(index+1).padStart(2,'0')}</td><td>${safeText(row.source)}</td><td>${safeText(row.event)}</td><td class="result-${row.resultKind}">${safeText(row.result)}</td><td>${safeText(row.reference)}</td></tr>`).join('');
}

function updateMetrics(){
  $('#dispatch-count').textContent=state.dispatches;$('#event-count').textContent=state.events;
  $('#duplicate-count').textContent=state.duplicates;$('#final-state').textContent=state.finalState.replaceAll('_',' ');
}

function policyInput(scenario){
  const checks=Object.fromEntries([...document.querySelectorAll('[data-policy]')].map(input=>[input.dataset.policy,input.checked]));
  if(scenario==='policy')checks.consentPermits=false;
  return {subjectRef:'subject-ref-console',scopeRef:'scope-ref-console',channelRef:'channel-ref-console',actorRef:'actor-ref-console',
    purpose:'transactional_share',channel:'whatsapp',policyVersion:'policy-v-console',
    evaluatedAt:'2032-01-01T10:00:00.000Z',validUntil:'2032-01-01T10:10:00.000Z',...checks};
}

function connectorFor(scenario){
  const scenarioByAttempt={};
  if(scenario==='retry')scenarioByAttempt['attempt-ref-console']=['temporary_failure','accepted'];
  if(scenario==='permanent')scenarioByAttempt['attempt-ref-console']=['permanent_failure'];
  if(scenario==='unknown')scenarioByAttempt['attempt-ref-console']=['outcome_unknown'];
  return createLocalCommunicationConnector({scenarioByAttempt,clock:()=>new Date('2032-01-01T10:05:00.000Z')});
}

function processEvents(connector,events,seen){
  for(const event of events){
    const validation=validateProviderEventEnvelope(event);
    const key=providerEventIdempotencyKey({providerKey:connector.providerKey,...event});
    state.events+=1;
    if(validation.error){addLedger('Local provider',event.eventType,'Rejected',event.providerEventRef,'fail');addStep('Provider event rejected',validation.error,'fail');continue;}
    if(seen.has(key)){state.duplicates+=1;addLedger('Idempotency guard',event.eventType,'Duplicate ignored',event.providerEventRef,'warn');addStep('Duplicate ignored','Existing provider event key preserved','warn');continue;}
    seen.add(key);addLedger('Local provider',event.eventType,'Accepted',event.providerEventRef,'ok');
  }
}

async function runSimulation(){
  const button=$('#run'),scenario=$('#scenario').value;button.disabled=true;setRunState('Running','running');
  Object.assign(state,{steps:[],ledger:[],dispatches:0,events:0,duplicates:0,finalState:'running',sequence:0});
  $('#timeline').innerHTML='';$('#ledger').innerHTML='';$('#scenario-label').textContent=scenarioNames[scenario];updateMetrics();
  try{
    const policy=evaluateCommunicationPolicy(policyInput(scenario)).value;policy.id='policy-ref-console';
    addStep('Policy evaluated',policy.outcome==='allowed'?'All dispatch-time controls passed':`Blocked by ${policy.reasonCodes.join(', ')}`,policy.outcome==='allowed'?'ok':'fail');
    addLedger('CORE policy','dispatch_decision',policy.outcome,policy.id,policy.outcome==='allowed'?'ok':'fail');await wait(180);
    if(policy.outcome!=='allowed'){state.finalState='policy_denied';setRunState('Blocked','blocked');updateMetrics();return;}

    const attempt=validateCommunicationAttempt({id:'attempt-ref-console',subjectRef:policy.subjectRef,scopeRef:policy.scopeRef,
      channelRef:policy.channelRef,actorRef:policy.actorRef,policyDecisionRef:policy.id,purpose:policy.purpose,channel:policy.channel,
      direction:'outbound',state:'queued',payloadRef:'restricted-ref-console',payloadDigest:'digest-console'}).value;
    const gate=evaluateDispatchGate({attempt,policyDecision:policy,connectorEnabled:true,now:'2032-01-01T10:05:00.000Z'});
    addStep('Dispatch gate opened',gate.reasonCode,'ok');addLedger('CORE gate','dispatch_allowed','Allowed',attempt.id,'ok');await wait(180);

    const connector=connectorFor(scenario),seen=new Set();
    transitionCommunicationState('queued','claim_dispatch');addStep('Dispatch claimed','Generation 1 entered local simulator','info');
    state.dispatches+=1;let result=await connector.dispatch({attemptRef:attempt.id,dispatchGeneration:1,payloadRef:attempt.payloadRef,payloadDigest:attempt.payloadDigest});
    addLedger('Local connector','dispatch_generation_1',result.reasonCode,attempt.id,result.accepted?'ok':result.retryable?'warn':'fail');await wait(180);

    if(result.retryable){
      state.finalState=transitionCommunicationState('dispatching','temporary_failure').value.nextState;
      addStep('Temporary failure','Queued for a controlled retry','warn');await wait(180);
      addStep('Retry claimed','Generation 2 entered local simulator','info');state.dispatches+=1;
      result=await connector.dispatch({attemptRef:attempt.id,dispatchGeneration:2,payloadRef:attempt.payloadRef,payloadDigest:attempt.payloadDigest});
      addLedger('Local connector','dispatch_generation_2',result.reasonCode,attempt.id,result.accepted?'ok':'fail');
    }

    if(result.outcomeUnknown){
      state.finalState=transitionCommunicationState('dispatching','unknown_outcome').value.nextState;
      addStep('Outcome unknown','Automatic retry stopped to prevent duplication','warn');await wait(180);
      state.finalState=transitionCommunicationState('outcome_unknown','reconcile').value.nextState;
      addStep('Manually reconciled','Opaque evidence resolved the uncertain attempt','info');
    }else if(!result.accepted){
      state.finalState=transitionCommunicationState('dispatching','permanent_failure').value.nextState;
      addStep('Permanent failure','Attempt closed without automatic retry','fail');
    }else{
      state.finalState=transitionCommunicationState('dispatching','provider_accept').value.nextState;
      addStep('Provider accepted','Acceptance recorded separately from delivery','ok');
      processEvents(connector,connector.drainEvents(),seen);await wait(180);
      if(scenario==='replay'){
        connector.emitReplay(result.providerCorrelationRef,'delivered');processEvents(connector,connector.drainEvents(),seen);
      }else{
        const delivered=connector.emitProviderEvent(result.providerCorrelationRef,'delivered');
        if(scenario==='duplicate')connector.duplicateProviderEvent(delivered.providerEventRef);
        processEvents(connector,connector.drainEvents(),seen);
        state.finalState=transitionCommunicationState('accepted','confirm_delivery').value.nextState;
        addStep('Delivery confirmed','Normalized delivery event projected once','ok');await wait(180);
        if(scenario==='happy'){
          connector.emitProviderEvent(result.providerCorrelationRef,'read');processEvents(connector,connector.drainEvents(),seen);
          state.finalState=transitionCommunicationState('delivered','confirm_read').value.nextState;
          addStep('Read confirmed','Lifecycle reached its final observed state','ok');
        }
      }
    }
    setRunState('Complete','complete');updateMetrics();
  }catch(error){state.finalState='simulation_error';addStep('Simulation stopped',error.message,'fail');setRunState('Stopped','blocked');updateMetrics();}
  finally{button.disabled=false;}
}

$('#run').addEventListener('click',runSimulation);$('#reset').addEventListener('click',resetView);
$('#scenario').addEventListener('change',event=>{$('#scenario-label').textContent=scenarioNames[event.target.value]});
resetView();
