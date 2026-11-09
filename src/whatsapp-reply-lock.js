import {one} from './db.js';

export const DEFAULT_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES=30;
export const MIN_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES=5;
export const MAX_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES=240;

let configured;

const wholeMinutes=value=>{
  const text=String(value??'').trim();
  if(!/^[0-9]+$/.test(text))return null;
  const parsed=Number(text);
  return Number.isSafeInteger(parsed)?parsed:null;
};

export function parseWhatsAppReplyLockConfig(env=process.env){
  const present=Object.prototype.hasOwnProperty.call(env,'WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES');
  const parsed=present?wholeMinutes(env.WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES):DEFAULT_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES;
  if(parsed===null||parsed<MIN_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES||parsed>MAX_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES){
    throw new Error(`WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES must be a whole number from ${MIN_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES} to ${MAX_WHATSAPP_REPLY_LOCK_TIMEOUT_MINUTES}`);
  }
  return Object.freeze({timeoutMinutes:parsed,source:present?'environment':'default'});
}

export function configureWhatsAppReplyLock(env=process.env){
  const next=parseWhatsAppReplyLockConfig(env);
  if(configured&&configured.timeoutMinutes!==next.timeoutMinutes){
    throw new Error('WhatsApp reply-lock configuration is already frozen for this process');
  }
  configured??=next;
  return configured;
}

export function whatsAppReplyLockConfig(){
  return configured??configureWhatsAppReplyLock(process.env);
}

export async function selectConversationWithReplyLock(client,conversationId,{forUpdate=false,timeoutMinutes=whatsAppReplyLockConfig().timeoutMinutes}={}){
  const row=await one(`SELECT c.*,locker.name AS reply_lock_owner_name,NOW() AS reply_lock_database_now,
    CASE WHEN c.reply_lock_owner_id IS NOT NULL AND c.reply_lock_acquired_at IS NOT NULL
      THEN c.reply_lock_acquired_at+make_interval(mins=>$2::integer) ELSE NULL END AS reply_lock_expires_at,
    CASE WHEN c.reply_lock_owner_id IS NOT NULL AND c.reply_lock_acquired_at IS NOT NULL
      THEN NOW()<c.reply_lock_acquired_at+make_interval(mins=>$2::integer) ELSE FALSE END AS reply_lock_active
    FROM wa_conversations c LEFT JOIN brokers locker ON locker.id=c.reply_lock_owner_id
    WHERE c.id=$1 ${forUpdate?'FOR UPDATE OF c':''}`,[conversationId,timeoutMinutes],client);
  if(row)assertReplyLockIntegrity(row);
  return row;
}

export function assertReplyLockIntegrity(conversation){
  const hasOwner=Boolean(conversation?.replyLockOwnerId),hasTime=Boolean(conversation?.replyLockAcquiredAt);
  if(hasOwner!==hasTime){
    throw Object.assign(new Error('WhatsApp reply-lock state is inconsistent'),{code:'WHATSAPP_REPLY_LOCK_INVALID_STATE'});
  }
  return conversation;
}

export function replyLockState(conversation,broker,{timeoutMinutes=whatsAppReplyLockConfig().timeoutMinutes}={}){
  assertReplyLockIntegrity(conversation);
  const ownerId=conversation.replyLockOwnerId||null;
  const active=Boolean(conversation.replyLockActive);
  const heldByCurrentUser=Boolean(ownerId&&String(ownerId)===String(broker?.id));
  const manager=Boolean(['manager','director'].includes(broker?.jobRole));
  return{
    ownerId,
    ownerName:conversation.replyLockOwnerName||null,
    acquiredAt:conversation.replyLockAcquiredAt||null,
    expiresAt:conversation.replyLockExpiresAt||null,
    databaseNow:conversation.replyLockDatabaseNow||null,
    active,
    expired:Boolean(ownerId&&!active),
    timeoutMinutes,
    heldByCurrentUser,
    canRelease:Boolean(!ownerId||heldByCurrentUser||manager),
    canSend:Boolean(!active||heldByCurrentUser)
  };
}

export function replyLockConflict(state){
  const name=state.ownerName||'another user';
  const until=state.expiresAt?new Date(state.expiresAt).toISOString():'the configured expiry';
  return Object.assign(new Error(`Reply lock held by ${name} until ${until}`),{
    statusCode:409,
    code:'WHATSAPP_REPLY_LOCK_HELD',
    responseBody:{error:`Reply lock held by ${name} until ${until}`,code:'WHATSAPP_REPLY_LOCK_HELD',replyLock:state}
  });
}

export function assertReplySendAllowed(conversation,broker,options){
  const state=replyLockState(conversation,broker,options);
  if(!state.canSend)throw replyLockConflict(state);
  return state;
}

export async function writeReplyLock(client,conversationId,ownerId){
  await one(`UPDATE wa_conversations SET reply_lock_owner_id=$1::uuid,
    reply_lock_acquired_at=CASE WHEN $1::uuid IS NULL THEN NULL ELSE NOW() END,updated_at=NOW()
    WHERE id=$2 RETURNING id`,[ownerId||null,conversationId],client);
  return selectConversationWithReplyLock(client,conversationId);
}

export async function refreshReplyLockAfterSend(client,conversation,broker,{timeoutMinutes=whatsAppReplyLockConfig().timeoutMinutes}={}){
  const state=replyLockState(conversation,broker,{timeoutMinutes});
  if(!state.active||!state.heldByCurrentUser)return{refreshed:false,state};
  await one(`UPDATE wa_conversations SET reply_lock_acquired_at=NOW(),last_activity_at=COALESCE(last_activity_at,NOW()),updated_at=NOW()
    WHERE id=$1 AND reply_lock_owner_id=$2::uuid RETURNING id`,[conversation.id,broker.id],client);
  const updated=await selectConversationWithReplyLock(client,conversation.id,{timeoutMinutes});
  return{refreshed:true,state:replyLockState(updated,broker,{timeoutMinutes})};
}
