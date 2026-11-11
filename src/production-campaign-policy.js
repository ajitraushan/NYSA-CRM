export function productionCampaignsDisabled(env = process.env) {
  return env.PGDATABASE === 'nysareal_nysacrm' ||
    [env.LEAD_RESPONSE_ENVIRONMENT,env.NYSA_ENVIRONMENT].some(value => value === 'production');
}
