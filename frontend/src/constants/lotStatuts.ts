export const LOT_STATUTS: Record<string, { label: string; color: string; bg: string }> = {
  quarantaine: { label: 'Quarantaine', color: '#8b5cf6', bg: '#f5f3ff' },
  accepte:     { label: 'Accepté',     color: '#10b981', bg: '#ecfdf5' },
  refuse:      { label: 'Refusé',      color: '#ef4444', bg: '#fef2f2' },
  en_attente:  { label: 'En attente',  color: '#f59e0b', bg: '#fffbeb' },
  consomme:    { label: 'Consommé',    color: '#6b7280', bg: '#f3f4f6' },
}
