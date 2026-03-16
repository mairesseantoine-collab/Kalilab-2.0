import client from './client';
import { Formation, Competence } from '../types';

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
};
