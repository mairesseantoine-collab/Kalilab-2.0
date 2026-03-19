import client from './client';
import { IndicateurQualite, MesureKPI, PaginatedResponse } from '../types';

export const kpiApi = {
  listIndicateurs: () => client.get<IndicateurQualite[]>('/kpi/indicators'),
  getIndicateur: (id: number) => client.get<IndicateurQualite>(`/kpi/indicators/${id}`),
  createIndicateur: (data: Partial<IndicateurQualite>) =>
    client.post<IndicateurQualite>('/kpi/indicators', data),
  updateIndicateur: (id: number, data: Partial<IndicateurQualite>) =>
    client.put<IndicateurQualite>(`/kpi/indicators/${id}`, data),
  uploadExcel: (id: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<{ fichier_excel: string; nom_fichier: string }>(
      `/kpi/indicators/${id}/upload-excel`, form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  listMesures: (indicateurId?: number, params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<MesureKPI>>('/kpi/mesures', {
      params: { indicateur_id: indicateurId, ...params },
    }),
  createMesure: (data: Partial<MesureKPI>) =>
    client.post<MesureKPI>('/kpi/mesures', data),
};
