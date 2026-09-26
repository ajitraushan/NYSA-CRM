const normalizedPath=value=>String(value||'').replace(/^\/api(?=\/)/,'').replace(/\/$/,'');
const frozen=value=>Object.freeze(value);

export const JOB_ROLE=frozen({
  ADMINISTRATOR:'admin', SALES_AGENT:'sales_agent',
  LISTING_AGENT:'listing_agent', MANAGER:'manager', DIRECTOR:'director', ACCOUNTANT:'accountant'
});

export const CAPABILITY=frozen({
  SESSION_SELF:'session.self', SYSTEM_CONFIGURATION:'system.configuration',
  CONFIGURATION_REFERENCE_READ:'configuration.reference.read', TEAM_CONFIGURATION:'configuration.teams',
  STAFF_CONFIGURATION_REFERENCE_READ:'configuration.staff.read', LEAVE_SELF:'leave.self',
  LEAVE_ADMINISTER:'leave.administer', LEAVE_DECIDE:'leave.decide', PERSONAL_TASKS:'tasks.personal',
  PURCHASED_DATA_IMPORT:'purchased_data.import', INVENTORY_CREATE:'inventory.create'
});

export const ROLE_ACCESS_POLICY=frozen({
  admin:frozen({label:'Admin',accountRole:'admin',jobRole:JOB_ROLE.ADMINISTRATOR,capabilities:frozen([
    CAPABILITY.SESSION_SELF,CAPABILITY.SYSTEM_CONFIGURATION,CAPABILITY.CONFIGURATION_REFERENCE_READ,
    CAPABILITY.TEAM_CONFIGURATION,CAPABILITY.STAFF_CONFIGURATION_REFERENCE_READ,CAPABILITY.LEAVE_SELF,
    CAPABILITY.LEAVE_ADMINISTER,CAPABILITY.LEAVE_DECIDE,CAPABILITY.PERSONAL_TASKS,
    CAPABILITY.PURCHASED_DATA_IMPORT
  ]),workspaceTabs:frozen(['admin','purchasedDataImport','myLeave','leaveAdministration']),dashboard:'admin',deniedMessage:'Admin access is limited to configuration, purchased-data intake and leave administration'})
});

// Operational role permissions live beside the governed Admin profile so the
// browser and API use one policy instead of repeating role-name conditions.
export const OPERATIONAL_ROLE_CAPABILITIES=frozen({
  sales_agent:frozen([CAPABILITY.PURCHASED_DATA_IMPORT,CAPABILITY.INVENTORY_CREATE]),
  listing_agent:frozen([CAPABILITY.INVENTORY_CREATE]),
  manager:frozen([CAPABILITY.INVENTORY_CREATE]),
  director:frozen([]), accountant:frozen([])
});

const RETIRED_ADMIN_ASSISTANT_PROFILE=frozen({label:'Role retired',accountRole:null,jobRole:'admin_assistant',capabilities:frozen([CAPABILITY.SESSION_SELF]),workspaceTabs:frozen([]),dashboard:'retired',deniedMessage:'This legacy role is retired; Admin must assign the Admin role'});

// First match wins. Specific governed modules intentionally precede the general
// /admin namespace so a new module cannot silently inherit configuration access.
export const GOVERNED_API_POLICY=frozen([
  frozen({methods:frozen(['GET']),pattern:/^\/me$/,capability:CAPABILITY.SESSION_SELF}),
  frozen({methods:frozen(['POST']),pattern:/^\/auth\/logout$/,capability:CAPABILITY.SESSION_SELF}),
  frozen({methods:frozen(['GET','POST']),pattern:/^\/marketing-material-compliance\/(?:configuration|material-types|material-type-versions\/[a-f0-9-]{36}\/activate|channel-rules(?:\/[a-f0-9-]{36}\/(?:activate|retire))?)$/,capability:CAPABILITY.SYSTEM_CONFIGURATION}),
  frozen({methods:frozen(['GET','POST','PATCH']),pattern:/^\/admin\/(?:leave-|agent-employment)/,capability:CAPABILITY.LEAVE_ADMINISTER}),
  frozen({methods:frozen(['GET','POST','PUT','PATCH','DELETE']),pattern:/^\/admin(?:\/|$)/,capability:CAPABILITY.SYSTEM_CONFIGURATION}),
  frozen({methods:frozen(['GET','POST','PATCH']),pattern:/^\/crm\/teams(?:\/[a-f0-9-]{36})?$/,capability:CAPABILITY.TEAM_CONFIGURATION}),
  frozen({methods:frozen(['GET']),pattern:/^\/crm\/staff$/,capability:CAPABILITY.STAFF_CONFIGURATION_REFERENCE_READ}),
  frozen({methods:frozen(['GET']),pattern:/^\/crm\/(?:controlled-values\/.*|organization)$/,capability:CAPABILITY.CONFIGURATION_REFERENCE_READ}),
  frozen({methods:frozen(['GET','POST']),pattern:/^\/crm\/my-(?:employment|leave-balances|leave-applications)(?:\/.*)?$/,capability:CAPABILITY.LEAVE_SELF}),
  frozen({methods:frozen(['GET','POST']),pattern:/^\/crm\/leave-applications\/[a-f0-9-]{36}\/(?:review|decision)$/,capability:CAPABILITY.LEAVE_DECIDE}),
  frozen({methods:frozen(['GET','POST']),pattern:/^\/crm\/purchased-data-import(?:\/.*)?$/,capability:CAPABILITY.PURCHASED_DATA_IMPORT}),
  frozen({methods:frozen(['GET']),pattern:/^\/crm\/tasks$/,capability:CAPABILITY.PERSONAL_TASKS}),
  frozen({methods:frozen(['PATCH']),pattern:/^\/crm\/tasks\/[a-f0-9-]{36}$/,capability:CAPABILITY.PERSONAL_TASKS})
]);

export const LEAVE_WORKFLOW_POLICY=frozen({decisionCapability:CAPABILITY.LEAVE_DECIDE,approverAccountRole:'admin',approverJobRole:JOB_ROLE.ADMINISTRATOR,routingReason:'leave_to_admin',approverLabel:'Admin'});

export function governedAccessProfile(actor){
  if(actor?.role==='admin')return ROLE_ACCESS_POLICY.admin;
  if(actor?.jobRole==='admin_assistant')return RETIRED_ADMIN_ASSISTANT_PROFILE;
  return null;
}
export const isSystemAdministrator=actor=>governedAccessProfile(actor)===ROLE_ACCESS_POLICY.admin;
export const isGovernedNonBusinessRole=actor=>Boolean(governedAccessProfile(actor));
export function capabilitiesFor(actor){const governed=governedAccessProfile(actor);if(governed)return governed.capabilities;return OPERATIONAL_ROLE_CAPABILITIES[actor?.jobRole]||frozen([]);}
export function hasCapability(actor,capability){return capabilitiesFor(actor).includes(capability);}
export function principalForCapability(capability){const profile=Object.values(ROLE_ACCESS_POLICY).find(item=>item.capabilities.includes(capability));return profile?{accountRole:profile.accountRole,jobRole:profile.jobRole}:null;}
export function governedRoleRequestDecision(actor,method,requestPath){
  const profile=governedAccessProfile(actor);if(!profile)return{allowed:true,profile:null,capability:null,message:null};
  const path=normalizedPath(requestPath),verb=String(method||'GET').toUpperCase();
  const rule=GOVERNED_API_POLICY.find(item=>item.pattern.test(path)&&item.methods.includes(verb));
  const allowed=Boolean(rule&&profile.capabilities.includes(rule.capability));
  return{allowed,profile,capability:rule?.capability||null,message:allowed?null:profile.deniedMessage};
}
export const governedRoleRequestAllowed=(actor,method,requestPath)=>governedRoleRequestDecision(actor,method,requestPath).allowed;
