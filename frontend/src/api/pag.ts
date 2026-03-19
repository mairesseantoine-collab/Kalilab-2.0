import client from './client';

export interface ActionPAG {
  id: number;
  num_pag?: string;
  tache: string;
  attribution?: string;
  avancement_notes?: string;
  avancement_pct: number;
  priorite: string;
  date_fin_prevue?: string;
  cloture: boolean;
  verification_efficacite?: boolean | null;
  groupe?: string;
  annexe?: string;
  famille?: string;
  responsable_pag?: string;
  created_at: string;
  updated_at: string;
}

export interface ActionPAGCreate {
  num_pag?: string;
  tache: string;
  attribution?: string;
  avancement_notes?: string;
  avancement_pct?: number;
  priorite?: string;
  date_fin_prevue?: string;
  cloture?: boolean;
  verification_efficacite?: boolean | null;
  groupe?: string;
  annexe?: string;
  famille?: string;
  responsable_pag?: string;
}

export interface PAGReferentiels {
  priorites: string[];
  groupes: string[];
  annexes: string[];
  familles: string[];
}

export interface PAGFilters {
  attribution?: string;
  priorite?: string;
  groupe?: string;
  annexe?: string;
  cloture?: boolean;
  responsable_pag?: string;
  skip?: number;
  limit?: number;
}

export const pagApi = {
  getReferentiels: () =>
    client.get<PAGReferentiels>('/pag/referentiels'),

  list: (filters: PAGFilters = {}) => {
    const params: Record<string, any> = {};
    if (filters.attribution !== undefined) params.attribution = filters.attribution;
    if (filters.priorite !== undefined) params.priorite = filters.priorite;
    if (filters.groupe !== undefined) params.groupe = filters.groupe;
    if (filters.annexe !== undefined) params.annexe = filters.annexe;
    if (filters.cloture !== undefined) params.cloture = filters.cloture;
    if (filters.responsable_pag !== undefined) params.responsable_pag = filters.responsable_pag;
    if (filters.skip !== undefined) params.skip = filters.skip;
    if (filters.limit !== undefined) params.limit = filters.limit;
    return client.get<ActionPAG[]>('/pag/', { params });
  },

  get: (id: number) =>
    client.get<ActionPAG>(`/pag/${id}`),

  create: (data: ActionPAGCreate) =>
    client.post<ActionPAG>('/pag/', data),

  update: (id: number, data: Partial<ActionPAGCreate>) =>
    client.patch<ActionPAG>(`/pag/${id}`, data),

  delete: (id: number) =>
    client.delete(`/pag/${id}`),
};
