import client from './client';
import { Equipement, Calibration, Maintenance, PaginatedResponse } from '../types';

export interface Panne {
  id: number;
  date_debut: string;
  date_fin: string | null;
  description: string;
  cause: string | null;
  resolution: string | null;
  impact: 'faible' | 'moyen' | 'critique';
  signale_par: string | null;
  en_cours: boolean;
  duree_heures: number | null;
}

export interface PannesResponse {
  pannes: Panne[];
  mtbf_jours: number | null;
  total_pannes: number;
  pannes_en_cours: number;
  total_downtime_heures: number;
}

export interface Piece {
  id: number;
  designation: string;
  reference: string | null;
  article_id: number | null;
  quantite_min: number | null;
  notes: string | null;
}

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
  // Pannes
  listPannes: (id: number) => client.get<PannesResponse>(`/equipment/${id}/pannes`),
  createPanne: (id: number, data: Partial<Panne> & { date_debut: string; description: string }) =>
    client.post(`/equipment/${id}/pannes`, data),
  updatePanne: (id: number, panneId: number, data: Partial<Panne>) =>
    client.put(`/equipment/${id}/pannes/${panneId}`, data),
  deletePanne: (id: number, panneId: number) =>
    client.delete(`/equipment/${id}/pannes/${panneId}`),
  // Pièces de rechange
  listPieces: (id: number) => client.get<Piece[]>(`/equipment/${id}/pieces`),
  createPiece: (id: number, data: Omit<Piece, 'id'>) =>
    client.post(`/equipment/${id}/pieces`, data),
  deletePiece: (id: number, pieceId: number) =>
    client.delete(`/equipment/${id}/pieces/${pieceId}`),
};

