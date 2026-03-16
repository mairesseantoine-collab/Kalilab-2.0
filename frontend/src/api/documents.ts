import client from './client';
import { DocumentQualite, PaginatedResponse } from '../types';

export const documentsApi = {
  list: (params?: Record<string, unknown>) =>
    client.get<PaginatedResponse<DocumentQualite>>('/documents', { params }),
  get: (id: number) => client.get<DocumentQualite>(`/documents/${id}`),
  create: (data: Partial<DocumentQualite>) => client.post<DocumentQualite>('/documents', data),
  update: (id: number, data: Partial<DocumentQualite>) =>
    client.put<DocumentQualite>(`/documents/${id}`, data),
  delete: (id: number) => client.delete(`/documents/${id}`),
  sign: (id: number, data: { type_signature: string; commentaire?: string }) =>
    client.post(`/documents/${id}/sign`, data),
  changeStatus: (id: number, statut: string) =>
    client.post(`/documents/${id}/status`, { statut }),
  uploadFile: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post<{ fichier_path: string; nom_fichier: string; version: string }>(
      `/documents/${id}/upload`, formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  getDownloadUrl: (id: number) =>
    client.get<{ url: string; nom_fichier: string; fichier_path: string }>(`/documents/${id}/download`),
  remplacerFichier: (id: number, file: File, commentaire?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (commentaire) formData.append('commentaire', commentaire);
    return client.post<{ fichier_path: string; nom_fichier: string; version: string }>(
      `/documents/${id}/remplacer-fichier`, formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },
  getHistory: (id: number) => client.get<{ versions: any[]; signatures: any[] }>(`/documents/${id}/history`),
};
