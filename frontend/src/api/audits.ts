import client from './client';
import { Audit, PaginatedResponse } from '../types';

export const auditsApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Audit>>('/audits', { params }),
  get: (id: number) => client.get<Audit>(`/audits/${id}`),
  create: (data: Partial<Audit>) => client.post<Audit>('/audits', data),
  update: (id: number, data: Partial<Audit>) =>
    client.put<Audit>(`/audits/${id}`, data),
  delete: (id: number) => client.delete(`/audits/${id}`),
  addConstat: (id: number, data: { description: string; reference_exigence?: string }) =>
    client.post(`/audits/${id}/constats`, data),
  addEcart: (id: number, data: { description: string; severite: string; action_corrective?: string }) =>
    client.post(`/audits/${id}/ecarts`, data),
  generateReport: (id: number) =>
    client.get(`/audits/${id}/report`, { responseType: 'blob' }),
};
