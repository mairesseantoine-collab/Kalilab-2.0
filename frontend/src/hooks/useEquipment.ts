import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentApi } from '../api/equipment';
import { Equipement, Calibration, Maintenance } from '../types';

export const useEquipmentList = (params?: Record<string, unknown>) => {
  return useQuery({
    queryKey: ['equipment', params],
    queryFn: () => equipmentApi.list(params).then((r) => r.data),
  });
};

export const useEquipment = (id: number) => {
  return useQuery({
    queryKey: ['equipment', id],
    queryFn: () => equipmentApi.get(id).then((r) => r.data),
    enabled: !!id,
  });
};

export const useCreateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Equipement>) => equipmentApi.create(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
    },
  });
};

export const useUpdateEquipment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Equipement> }) =>
      equipmentApi.update(id, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      queryClient.invalidateQueries({ queryKey: ['equipment', id] });
    },
  });
};

export const useAddCalibration = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Calibration> }) =>
      equipmentApi.addCalibration(id, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment', id] });
    },
  });
};

export const useAddMaintenance = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Maintenance> }) =>
      equipmentApi.addMaintenance(id, data).then((r) => r.data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['equipment', id] });
    },
  });
};
