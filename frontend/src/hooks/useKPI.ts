import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { kpiApi } from '../api/kpi';
import { IndicateurQualite, MesureKPI } from '../types';

export const useIndicateurs = () => {
  return useQuery({
    queryKey: ['kpi', 'indicateurs'],
    queryFn: () => kpiApi.listIndicateurs().then((r) => r.data),
  });
};

export const useIndicateur = (id: number) => {
  return useQuery({
    queryKey: ['kpi', 'indicateurs', id],
    queryFn: () => kpiApi.getIndicateur(id).then((r) => r.data),
    enabled: !!id,
  });
};

export const useMesures = (indicateurId?: number, params?: Record<string, unknown>) => {
  return useQuery({
    queryKey: ['kpi', 'mesures', indicateurId, params],
    queryFn: () => kpiApi.listMesures(indicateurId, params).then((r) => r.data),
  });
};

export const useCreateMesure = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<MesureKPI>) => kpiApi.createMesure(data).then((r) => r.data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['kpi', 'mesures', vars.indicateur_id] });
      queryClient.invalidateQueries({ queryKey: ['kpi', 'indicateurs'] });
    },
  });
};

export const useCreateIndicateur = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<IndicateurQualite>) =>
      kpiApi.createIndicateur(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi', 'indicateurs'] });
    },
  });
};
