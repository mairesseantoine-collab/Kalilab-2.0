import client from './client';
import { Risque, PaginatedResponse } from '../types';

export const risksApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Risque>>('/risks', { params }),
  get: (id: number) => client.get<Risque>(`/risks/${id}`),
  create: (data: Partial<Risque>) => client.post<Risque>('/risks', data),
  update: (id: number, data: Partial<Risque>) =>
    client.put<Risque>(`/risks/${id}`, data),
  delete: (id: number) => client.delete(`/risks/${id}`),
};
