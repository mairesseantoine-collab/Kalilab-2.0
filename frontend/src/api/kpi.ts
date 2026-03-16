import client from './client';
import { IndicateurQualite, MesureKPI, PaginatedResponse } from '../types';

export const kpiApi = {
  listIndicateurs: () => client.get<IndicateurQualite[]>('/kpi/indicateurs'),
  getIndicateur: (id: number) => client.get<IndicateurQualite>(`/kpi/indicateurs/${id}`),
  createIndicateur: (data: Partial<IndicateurQualite>) =>
    client.post<IndicateurQualite>('/kpi/indicateurs', data),
  updateIndicateur: (id: number, data: Partial<IndicateurQualite>) =>
    client.put<IndicateurQualite>(`/kpi/indicateurs/${id}`, data),
  listMesures: (indicateurId?: number, params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<MesureKPI>>('/kpi/mesures', {
      params: { indicateur_id: indicateurId, ...params },
    }),
  createMesure: (data: Partial<MesureKPI>) =>
    client.post<MesureKPI>('/kpi/mesures', data),
};
