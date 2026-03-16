import client from './client';

export interface Localisation {
  id: number;
  service_id: number;
  parent_id: number | null;
  nom: string;
  ordre: number;
  actif: boolean;
  enfants: Localisation[];
}

export interface Service {
  id: number;
  label: string;
  nom: string;
  site: 'STE' | 'STM' | 'both';
  ordre: number;
  actif: boolean;
  created_at: string;
  localisations: Localisation[];
  nb_zones: number;
}

export const servicesApi = {
  list: (params?: { site?: string; actif?: boolean }) =>
    client.get<Service[]>('/services/', { params }),
  create: (data: { label: string; nom: string; site: string; ordre?: number }) =>
    client.post<Service>('/services/', data),
  update: (id: number, data: Partial<Service>) =>
    client.put<Service>(`/services/${id}`, data),
  delete: (id: number) =>
    client.delete(`/services/${id}`),
  addLocalisation: (serviceId: number, data: { nom: string; parent_id?: number; ordre?: number }) =>
    client.post<Localisation>(`/services/${serviceId}/localisations`, data),
  updateLocalisation: (id: number, data: Partial<Localisation>) =>
    client.put<Localisation>(`/services/localisations/${id}`, data),
  deleteLocalisation: (id: number) =>
    client.delete(`/services/localisations/${id}`),
};
