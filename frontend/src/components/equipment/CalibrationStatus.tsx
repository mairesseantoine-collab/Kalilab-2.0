import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { CalendarToday } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

interface Props { date?: string; }

const CalibrationStatus: React.FC<Props> = ({ date }) => {
  const { t } = useTranslation();

  if (!date) return <Chip label="-" size="small" />;

  const overdue = dayjs(date).isBefore(dayjs());
  const daysLeft = dayjs(date).diff(dayjs(), 'day');
  const soon = !overdue && daysLeft <= 30;

  const label = dayjs(date).format('DD/MM/YYYY');
  const tooltip = overdue
    ? t('equipmentStatus.calibration_echuee')
    : soon
    ? `${daysLeft} jours restants`
    : '';

  return (
    <Tooltip title={tooltip}>
      <Chip
        icon={<CalendarToday fontSize="small" />}
        label={label}
        size="small"
        color={overdue ? 'error' : soon ? 'warning' : 'default'}
      />
    </Tooltip>
  );
};

export default CalibrationStatus;
