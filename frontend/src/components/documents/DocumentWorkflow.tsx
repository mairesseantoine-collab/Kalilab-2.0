import React, { useState } from 'react';
import {
  Box, Stepper, Step, StepLabel, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { DocumentStatus, DocumentQualite } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { useSignDocument, useChangeDocumentStatus } from '../../hooks/useDocuments';

const STATUSES: DocumentStatus[] = ['brouillon', 'relecture', 'approbation', 'publie', 'diffusion', 'archive'];

interface Props {
  document: DocumentQualite;
}

const DocumentWorkflow: React.FC<Props> = ({ document }) => {
  const { t } = useTranslation();
  const { user, hasRole } = useAuth();
  const [signOpen, setSignOpen] = useState(false);
  const [comment, setComment] = useState('');
  const signMutation = useSignDocument();
  const statusMutation = useChangeDocumentStatus();

  const currentIdx = STATUSES.indexOf(document.statut);

  const canSign = user && !(document as any).signatures?.some((s: any) => s.user_id === user.id);
  const canAdvance = hasRole('admin', 'qualiticien', 'responsable_technique');

  const handleSign = async () => {
    if (!user) return;
    try {
      await signMutation.mutateAsync({
        id: document.id,
        data: { type_signature: 'approbation', commentaire: comment },
      });
      setSignOpen(false);
      setComment('');
    } catch {}
  };

  const handleAdvance = async () => {
    const nextStatus = STATUSES[currentIdx + 1];
    if (!nextStatus) return;
    try {
      await statusMutation.mutateAsync({ id: document.id, statut: nextStatus });
    } catch {}
  };

  const handleArchive = async () => {
    try {
      await statusMutation.mutateAsync({ id: document.id, statut: 'archive' });
    } catch {}
  };

  return (
    <Box>
      <Stepper activeStep={currentIdx} alternativeLabel sx={{ mb: 2 }}>
        {STATUSES.map((s) => (
          <Step key={s}>
            <StepLabel>{t(`documentStatus.${s}`)}</StepLabel>
          </Step>
        ))}
      </Stepper>
      <Box display="flex" gap={1} flexWrap="wrap">
        {canSign && document.statut !== 'archive' && document.statut !== 'brouillon' && (
          <Button variant="outlined" color="secondary" onClick={() => setSignOpen(true)}>
            {t('documents.signDocument')}
          </Button>
        )}
        {canAdvance && currentIdx < STATUSES.length - 2 && (
          <Button variant="contained" onClick={handleAdvance} disabled={statusMutation.isPending}>
            {t('common.next')}: {t(`documentStatus.${STATUSES[currentIdx + 1]}`)}
          </Button>
        )}
        {canAdvance && document.statut !== 'archive' && (
          <Button variant="outlined" color="error" onClick={handleArchive} disabled={statusMutation.isPending}>
            {t('documentStatus.archive')}
          </Button>
        )}
      </Box>

      <Dialog open={signOpen} onClose={() => setSignOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{t('documents.signatureConfirm')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" mb={2}>
            {t('documents.signatureConfirm')} - {document.titre} v{document.version}
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label={t('common.comment')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSignOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="contained" onClick={handleSign} disabled={signMutation.isPending}>
            {t('documents.signDocument')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DocumentWorkflow;
