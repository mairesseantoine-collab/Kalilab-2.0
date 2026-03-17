import client from './client';
import { Formation, Competence } from '../types';

export interface CritereEvaluation {
  descriptif: string;
  obligatoire: boolean;
}

export interface Qualification {
  id: number;
  libelle: string;
  duree_heures: number | null;
  description: string | null;
  reevaluation: boolean;
  validite_mois: number | null;
  responsable_id: number | null;
  responsable_nom: string | null;
  sites: string[];
  fonctions_concernees: string[];
  personnel_concerne: number[];
  personnel_concerne_noms: string[];
  criteres_evaluation: CritereEvaluation[];
  docs_admin: number[];
  fichiers_admin: string[];
  docs_user: number[];
  fichiers_user: string[];
  created_at: string;
  updated_at: string;
}

export interface PersonnelRH {
  id: number;
  nom: string;
  prenom: string;
  telephone: string | null;
  site: string;
  fonction: string;
  actif: boolean;
  label: string;
  created_at: string;
  updated_at: string;
}

export interface HabilitationStatus {
  personnel_id: number;
  qualification_id: number;
  habilitation_id: number | null;
  date_habilitation: string | null;
  date_echeance: string | null;
  status: 'valid' | 'expiring_soon' | 'expired' | 'not_habilitated';
}

export interface HabilitationMatrix {
  personnel: { id: number; nom: string; prenom: string; fonction: string; site: string }[];
  qualifications: { id: number; libelle: string; validite_mois: number | null; reevaluation: boolean }[];
  habilitations: HabilitationStatus[];
}

export const hrApi = {
  listCompetences: () => client.get<Competence[]>('/hr/competences'),
  getMatrix: () => client.get<any>('/hr/matrix'),
  updateCompetence: (personnelId: number, competenceId: number, niveau: number) =>
    client.put(`/hr/matrix/${personnelId}/${competenceId}`, { niveau }),
  getHabilitationMatrix: (site?: string) =>
    client.get<HabilitationMatrix>('/hr/matrix/habilitations', { params: site ? { site } : undefined }),
  createHabilitation: (data: { personnel_id: number; qualification_id: number; date_habilitation: string }) =>
    client.post('/hr/habilitations', data),
  deleteHabilitation: (id: number) => client.delete(`/hr/habilitations/${id}`),

  listFormations: () => client.get<Formation[]>('/hr/formations'),
  getFormation: (id: number) => client.get<Formation>(`/hr/formations/${id}`),
  createFormation: (data: Partial<Formation>) =>
    client.post<Formation>('/hr/formations', data),
  updateFormation: (id: number, data: Partial<Formation>) =>
    client.put<Formation>(`/hr/formations/${id}`, data),

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

  listBiologistes: () => client.get<{ id: number; label: string }[]>('/hr/biologistes'),
  listPersonnelRH: (params?: { site?: string; actif?: boolean }) =>
    client.get<PersonnelRH[]>('/hr/personnel-rh', { params }),
  createPersonnelRH: (data: Partial<PersonnelRH>) =>
    client.post<PersonnelRH>('/hr/personnel-rh', data),
  updatePersonnelRH: (id: number, data: Partial<PersonnelRH>) =>
    client.put<PersonnelRH>(`/hr/personnel-rh/${id}`, data),
  deletePersonnelRH: (id: number) => client.delete(`/hr/personnel-rh/${id}`),
};
