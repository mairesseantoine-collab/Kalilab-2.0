import client from './client';

export interface DossierVerif {
  id: number;
  titre: string;
  methode?: string;
  type_methode: string;
  data?: Record<string, unknown>;
  statut: string;
  redacteur_id?: number;
  created_at?: string;
  updated_at?: string;
}

export const redactionApi = {
  // Dossiers de vérification
  listDossiers: () => client.get<DossierVerif[]>('/redaction/dossiers-verification'),
  getDossier: (id: number) => client.get<DossierVerif>(`/redaction/dossiers-verification/${id}`),
  createDossier: (data: Record<string, unknown>) =>
    client.post<{ id: number; titre: string; statut: string }>('/redaction/dossiers-verification', data),
  updateDossierData: (id: number, data: Record<string, unknown>) =>
    client.put(`/redaction/dossiers-verification/${id}/data`, { data }),
  exportDocx: (id: number) =>
    client.get(`/redaction/dossiers-verification/${id}/export-docx`, { responseType: 'blob' }),

  // AMDEC
  listAmdec: () => client.get<any[]>('/redaction/amdec'),
  getAmdec: (id: number) => client.get<any>(`/redaction/amdec/${id}`),
  createAmdec: (data: { analyseur: string; type_analyseur?: string }) =>
    client.post<{ id: number; analyseur: string; statut: string }>('/redaction/amdec', data),
  saveAmdecData: (id: number, data: Record<string, unknown>) =>
    client.put(`/redaction/amdec/${id}/data`, { data }),
  updateAmdecStatut: (id: number, body: { statut: string; responsable_nom?: string; commentaire?: string }) =>
    client.put(`/redaction/amdec/${id}/statut`, body),
  exportAmdecDocx: (id: number) =>
    client.get(`/redaction/amdec/${id}/export-docx`, { responseType: 'blob' }),

  // Procédures Mammouth
  listProcedures: () => client.get<any[]>('/redaction/procedures-mammouth'),
  getProcedure: (id: number) => client.get<any>(`/redaction/procedures-mammouth/${id}`),
  createProcedure: (data: Record<string, unknown>) =>
    client.post<any>('/redaction/procedures-mammouth', data),
  updateProcedure: (id: number, data: Record<string, unknown>) =>
    client.put<any>(`/redaction/procedures-mammouth/${id}`, data),
  addSection: (procedureId: number, data: { titre: string; contenu: string; ordre: number }) =>
    client.post<any>(`/redaction/procedures-mammouth/${procedureId}/sections`, data),
};
