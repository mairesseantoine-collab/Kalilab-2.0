import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Button,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmColor?: 'primary' | 'error' | 'warning';
  loading?: boolean;
}

const ConfirmDialog: React.FC<Props> = ({
  open, title, message, onConfirm, onCancel, confirmColor = 'error', loading = false,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title || t('common.confirm')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading}>{t('common.cancel')}</Button>
        <Button onClick={onConfirm} color={confirmColor} variant="contained" disabled={loading}>
          {t('common.confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDialog;
