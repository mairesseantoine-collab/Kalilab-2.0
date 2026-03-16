import client from './client';
import { Formation, Competence } from '../types';

export interface Qualification {
  id: number;
  libelle: string;
  duree_heures: number | null;
  description: string | null;
  reevaluation: boolean;
  responsable_id: number | null;
  responsable_nom: string | null;
  sites: string[];
  fonctions_concernees: string[];
  personnel_concerne: string[];
  docs_admin: number[];
  fichiers_admin: string[];
  docs_user: number[];
  fichiers_user: string[];
  created_at: string;
  updated_at: string;
}

export const hrApi = {
  listCompetences: () => client.get<Competence[]>('/hr/competences'),
  getMatrix: () => client.get<any[]>('/hr/matrix'),
  updateCompetence: (personnelId: number, competenceId: number, niveau: number) =>
    client.put(`/hr/matrix/${personnelId}/${competenceId}`, { niveau }),
  listFormations: () => client.get<Formation[]>('/hr/formations'),
  getFormation: (id: number) => client.get<Formation>(`/hr/formations/${id}`),
  createFormation: (data: Partial<Formation>) =>
    client.post<Formation>('/hr/formations', data),
  updateFormation: (id: number, data: Partial<Formation>) =>
    client.put<Formation>(`/hr/formations/${id}`, data),
  // Qualifications
  listQualifications: (site?: string) =>
    client.get<Qualification[]>('/hr/qualifications', { params: site ? { site } : undefined }),
  createQualification: (data: Partial<Qualification>) =>
    client.post<Qualification>('/hr/qualifications', data),
  updateQualification: (id: number, data: Partial<Qualification>) =>
    client.put<Qualification>(`/hr/qualifications/${id}`, data),
  deleteQualification: (id: number) =>
    client.delete(`/hr/qualifications/${id}`),
  seedQualifications: () =>
    client.post<{ created: number; skipped: number }>('/hr/qualifications/seed'),
};
