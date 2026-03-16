import client from './client';

export interface PersonnelItem {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  label: string;
}

export const usersApi = {
  listPersonnel: () => client.get<PersonnelItem[]>('/users/personnel'),
};
