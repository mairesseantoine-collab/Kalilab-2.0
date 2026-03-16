import React from 'react';
import { Chip, ChipProps } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DocumentStatus, NCStatus, EquipmentStatus, LotStatus, ComplaintStatus } from '../../types';

type AnyStatus = DocumentStatus | NCStatus | EquipmentStatus | LotStatus | ComplaintStatus | string;

interface Props {
  status: AnyStatus;
  size?: ChipProps['size'];
}

const getStatusColor = (status: AnyStatus): ChipProps['color'] => {
  switch (status) {
    case 'publie': case 'accepte': case 'operationnel': case 'cloturee':
      return 'success';
    case 'brouillon': case 'archive': case 'consomme':
      return 'default';
    case 'relecture': case 'approbation': case 'diffusion': case 'en_analyse':
    case 'capa_en_cours': case 'en_maintenance': case 'en_cours':
      return 'warning';
    case 'ouverte': case 'refuse': case 'hors_service':
      return 'error';
    case 'calibration_echuee':
      return 'error';
    case 'quarantaine': case 'verification':
      return 'info';
    default:
      return 'default';
  }
};

const getTranslationKey = (status: AnyStatus): string => {
  const docStatuses = ['brouillon', 'relecture', 'approbation', 'publie', 'diffusion', 'archive'];
  const ncStatuses = ['ouverte', 'en_analyse', 'capa_en_cours', 'verification', 'cloturee'];
  const eqStatuses = ['operationnel', 'en_maintenance', 'hors_service', 'calibration_echuee'];
  const lotStatuses = ['quarantaine', 'accepte', 'refuse', 'consomme'];
  const complaintStatuses = ['en_cours'];

  if (docStatuses.includes(status)) return `documentStatus.${status}`;
  if (ncStatuses.includes(status)) return `ncStatus.${status}`;
  if (eqStatuses.includes(status)) return `equipmentStatus.${status}`;
  if (lotStatuses.includes(status)) return `lotStatus.${status}`;
  if (complaintStatuses.includes(status)) return `complaintStatus.${status}`;
  if (status === 'ouverte') return 'complaintStatus.ouverte';
  if (status === 'cloturee') return 'complaintStatus.cloturee';
  return status;
};

const StatusChip: React.FC<Props> = ({ status, size = 'small' }) => {
  const { t } = useTranslation();
  const key = getTranslationKey(status);
  const label = t(key, { defaultValue: status });
  return <Chip label={label} color={getStatusColor(status)} size={size} />;
};

export default StatusChip;
