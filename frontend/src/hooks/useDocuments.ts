import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api/documents';
import { DocumentQualite } from '../types';

export const useDocuments = (params?: Record<string, unknown>) => {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => documentsApi.list(params).then((r) => r.data),
  });
};

export const useDocument = (id: number) => {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => documentsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
};

export const useCreateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<DocumentQualite>) => documentsApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
};

export const useUpdateDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DocumentQualite> }) =>
      documentsApi.update(id, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    },
  });
};

export const useSignDocument = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { type_signature: string; commentaire?: string } }) =>
      documentsApi.sign(id, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    },
  });
};

export const useChangeDocumentStatus = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: string }) =>
      documentsApi.changeStatus(id, statut),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['documents', id] });
    },
  });
};
