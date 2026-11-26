export function unavailableAdapter(source, reason) {
  return async () => ({ok:false,source,status:"not_configured",message:reason,checkedAt:new Date().toISOString()});
}
