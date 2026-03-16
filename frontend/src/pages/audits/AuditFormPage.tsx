import React, { useState } from 'react';
import { Box, Button, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Snackbar, Alert, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PageHeader from '../../components/common/PageHeader';
import { auditsApi } from '../../api/audits';

const schema = z.object({
  type_audit: z.string().min(1),
  referentiel: z.string().min(1),
  titre: z.string().min(3),
  date_planifiee: z.string().min(1),
});
type FormData = z.infer<typeof schema>;

const AUDIT_TYPES = ['interne', 'externe', 'fournisseur'];

const AuditFormPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type_audit: '', referentiel: 'ISO 15189', titre: '', date_planifiee: '' },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => auditsApi.create(data as any),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['audits'] }); setSnackbar({ open: true, message: 'Audit cree', severity: 'success' }); setTimeout(() => navigate('/audits'), 1000); },
    onError: () => setSnackbar({ open: true, message: 'Erreur', severity: 'error' }),
  });

  return (
    <Box>
      <PageHeader title={t('audits.new', 'Planifier un audit')} />
      <Paper sx={{ p: 3, maxWidth: 700 }}>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Controller name="type_audit" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.type_audit}>
                  <InputLabel>Type *</InputLabel>
                  <Select {...field} label="Type *">
                    {AUDIT_TYPES.map((tp) => <MenuItem key={tp} value={tp}>{t('auditType.' + tp, tp)}</MenuItem>)}
                  </Select>
                  {errors.type_audit && <Typography color="error" variant="caption">{errors.type_audit.message}</Typography>}
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="referentiel" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Referentiel *" error={!!errors.referentiel} helperText={errors.referentiel?.message} />
              )} />
            </Grid>
            <Grid item xs={12}>
              <Controller name="titre" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Titre de l audit *" error={!!errors.titre} helperText={errors.titre?.message} />
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="date_planifiee" control={control} render={({ field }) => (
                <TextField {...field} fullWidth type="date" label="Date planifiee *" InputLabelProps={{ shrink: true }} error={!!errors.date_planifiee} helperText={errors.date_planifiee?.message} />
              )} />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => navigate('/audits')}>{t('common.cancel')}</Button>
                <Button type="submit" variant="contained" disabled={createMutation.isPending}>{createMutation.isPending ? t('common.loading') : t('common.save')}</Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default AuditFormPage;
