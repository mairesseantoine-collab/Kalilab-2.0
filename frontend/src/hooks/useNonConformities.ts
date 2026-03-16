import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nonConformitiesApi } from '../api/nonconformities';
import { NonConformite } from '../types';

export const useNonConformities = (params?: Record<string, unknown>) => {
  return useQuery({
    queryKey: ['nonconformities', params],
    queryFn: () => nonConformitiesApi.list(params).then((r) => r.data),
  });
};

export const useNonConformity = (id: number) => {
  return useQuery({
    queryKey: ['nonconformities', id],
    queryFn: () => nonConformitiesApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
};

export const useCreateNC = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<NonConformite>) =>
      nonConformitiesApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nonconformities'] });
    },
  });
};

export const useUpdateNC = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<NonConformite> }) =>
      nonConformitiesApi.update(id, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['nonconformities'] });
      queryClient.invalidateQueries({ queryKey: ['nonconformities', id] });
    },
  });
};

export const useChangeNCStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) =>
      nonConformitiesApi.changeStatus(id, statut),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['nonconformities'] });
      queryClient.invalidateQueries({ queryKey: ['nonconformities', id] });
    },
  });
};
