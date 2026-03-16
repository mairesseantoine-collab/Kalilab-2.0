import client from './client';
import { Equipement, Calibration, Maintenance, PaginatedResponse } from '../types';

export const equipmentApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<Equipement>>('/equipment', { params }),
  get: (id: number) => client.get<Equipement>(`/equipment/${id}`),
  create: (data: Partial<Equipement>) => client.post<Equipement>('/equipment', data),
  update: (id: number, data: Partial<Equipement>) =>
    client.put<Equipement>(`/equipment/${id}`, data),
  delete: (id: number) => client.delete(`/equipment/${id}`),
  addCalibration: (id: number, data: Partial<Calibration>) =>
    client.post<Calibration>(`/equipment/${id}/calibrations`, data),
  addMaintenance: (id: number, data: Partial<Maintenance>) =>
    client.post<Maintenance>(`/equipment/${id}/maintenances`, data),
  block: (id: number) => client.post(`/equipment/${id}/block`),
  unblock: (id: number) => client.post(`/equipment/${id}/unblock`),
};
