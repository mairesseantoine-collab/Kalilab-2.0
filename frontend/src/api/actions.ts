import client from './client';
import { Action, PaginatedResponse } from '../types';

export const actionsApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Action>>('/actions', { params }),
  get: (id: number) => client.get<Action>(`/actions/${id}`),
  create: (data: Partial<Action>) => client.post<Action>('/actions', data),
  update: (id: number, data: Partial<Action>) =>
    client.put<Action>(`/actions/${id}`, data),
  delete: (id: number) => client.delete(`/actions/${id}`),
  complete: (id: number) => client.post(`/actions/${id}/complete`),
};
