import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Grid, TextField, MenuItem,
  Button, CircularProgress, Alert,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useDocument, useCreateDocument, useUpdateDocument } from '../../hooks/useDocuments';
import PageHeader from '../../components/common/PageHeader';
import FileUpload from '../../components/common/FileUpload';
import { documentsApi } from '../../api/documents';

const schema = z.object({
  titre: z.string().min(1),
  theme: z.string().optional(),
  classification: z.string().optional(),
  contenu: z.string().optional(),
  date_validite: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const THEMES = ['general', 'preanalytique', 'analytique', 'postanalytique', 'securite', 'ressources_humaines', 'equipements', 'informatique'];
const CLASSIFICATIONS = ['procedure', 'mode_operatoire', 'formulaire', 'politique', 'enregistrement'];

const DocumentFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: existing } = useDocument(Number(id));
  const createMutation = useCreateDocument();
  const updateMutation = useUpdateDocument();

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { titre: '', theme: '', classification: '', contenu: '', date_validite: '' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        titre: existing.titre,
        theme: existing.theme || '',
        classification: existing.classification || '',
        contenu: existing.contenu || '',
        date_validite: existing.date_validite?.split('T')[0] || '',
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data });
        navigate(`/documents/${id}`);
      } else {
        const result = await createMutation.mutateAsync(data);
        navigate(`/documents/${(result as { id: number }).id}`);
      }
    } catch {}
  };

  const handleFileUpload = async (file: File) => {
    if (id) {
      try {
        await documentsApi.uploadFile(Number(id), file);
      } catch {}
    }
  };

  const mutation = isEdit ? updateMutation : createMutation;

  return (
    <Box>
      <PageHeader
        title={isEdit ? t('documents.editDocument') : t('documents.newDocument')}
        breadcrumbs={[
          { label: t('documents.title'), path: '/documents' },
          { label: isEdit ? t('documents.editDocument') : t('documents.newDocument') },
        ]}
      />
      <Card>
        <CardContent>
          {mutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>{t('common.error')}</Alert>
          )}
          <form onSubmit={handleSubmit(onSubmit)}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Controller
                  name="titre"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label={t('documents.documentTitle')}
                      error={!!errors.titre}
                      helperText={errors.titre ? t('errors.required') : ''}
                      required
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="theme"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label={t('documents.theme')}>
                      <MenuItem value="">-</MenuItem>
                      {THEMES.map((th) => (
                        <MenuItem key={th} value={th}>{t(`documents.themes.${th}`)}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="classification"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label={t('documents.classification')}>
                      <MenuItem value="">-</MenuItem>
                      {CLASSIFICATIONS.map((cl) => (
                        <MenuItem key={cl} value={cl}>{t(`documents.classifications.${cl}`)}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Controller
                  name="date_validite"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth type="date" label={t('documents.validityDate')} InputLabelProps={{ shrink: true }} />
                  )}
                />
              </Grid>
              <Grid item xs={12}>
                <Controller
                  name="contenu"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth multiline rows={8} label={t('documents.content')} />
                  )}
                />
              </Grid>
              {isEdit && (
                <Grid item xs={12}>
                  <FileUpload onFileSelect={handleFileUpload} label={t('documents.uploadFile')} />
                </Grid>
              )}
              <Grid item xs={12}>
                <Box display="flex" gap={2}>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={isSubmitting ? <CircularProgress size={18} /> : <Save />}
                    disabled={isSubmitting}
                  >
                    {t('common.save')}
                  </Button>
                  <Button startIcon={<ArrowBack />} onClick={() => navigate(isEdit ? `/documents/${id}` : '/documents')}>
                    {t('common.cancel')}
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DocumentFormPage;
