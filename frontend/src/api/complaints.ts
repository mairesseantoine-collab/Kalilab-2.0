import client from './client';
import { Plainte, PaginatedResponse } from '../types';

export const complaintsApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Plainte>>('/complaints', { params }),
  get: (id: number) => client.get<Plainte>(`/complaints/${id}`),
  create: (data: Partial<Plainte>) => client.post<Plainte>('/complaints', data),
  update: (id: number, data: Partial<Plainte>) =>
    client.put<Plainte>(`/complaints/${id}`, data),
  changeStatus: (id: number, statut: string) =>
    client.post(`/complaints/${id}/status`, { statut }),
  linkNC: (id: number, ncId: number) =>
    client.post(`/complaints/${id}/link-nc`, { nc_id: ncId }),
};
