import React from 'react';
import { Alert, AlertTitle } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';

interface Props { error: unknown; }

const ErrorAlert: React.FC<Props> = ({ error }) => {
  const { t } = useTranslation();
  let message = t('common.error');
  if (error instanceof AxiosError) {
    if (error.response?.status === 401) message = t('errors.unauthorized');
    else if (error.response?.status === 403) message = t('errors.forbidden');
    else if (error.response?.status === 404) message = t('errors.notFound');
    else if (error.response?.data?.detail) message = error.response.data.detail;
    else message = t('errors.serverError');
  } else if (error instanceof Error) {
    message = error.message;
  }
  return (
    <Alert severity="error" sx={{ my: 2 }}>
      <AlertTitle>{t('common.error')}</AlertTitle>
      {message}
    </Alert>
  );
};

export default ErrorAlert;
