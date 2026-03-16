import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props { message?: string; }

const LoadingSpinner: React.FC<Props> = ({ message }) => {
  const { t } = useTranslation();
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" py={6} gap={2}>
      <CircularProgress />
      <Typography color="text.secondary">{message || t('common.loading')}</Typography>
    </Box>
  );
};

export default LoadingSpinner;
