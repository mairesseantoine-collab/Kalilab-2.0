import client from './client';
import { NonConformite, PaginatedResponse } from '../types';

export const nonConformitiesApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<NonConformite>>('/nonconformities', { params }),
  get: (id: number) => client.get<NonConformite>(`/nonconformities/${id}`),
  create: (data: Partial<NonConformite>) =>
    client.post<NonConformite>('/nonconformities', data),
  update: (id: number, data: Partial<NonConformite>) =>
    client.put<NonConformite>(`/nonconformities/${id}`, data),
  changeStatus: (id: number, new_status: string, commentaire?: string) =>
    client.put(`/nonconformities/${id}/status`, { new_status, commentaire }),
};
