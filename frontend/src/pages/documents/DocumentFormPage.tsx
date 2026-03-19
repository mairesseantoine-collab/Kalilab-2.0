import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Grid, TextField, MenuItem,
  Button, CircularProgress, Alert, Typography, Divider,
} from '@mui/material';
import { Save, ArrowBack, AttachFile } from '@mui/icons-material';
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
  type_document: z.string().optional(),
  numero_document: z.string().optional(),
  periodicite_revision: z.coerce.number().optional().nullable(),
  theme: z.string().optional(),
  classification: z.string().optional(),
  contenu: z.string().optional(),
  date_validite: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const THEMES = ['general', 'preanalytique', 'analytique', 'postanalytique', 'securite', 'ressources_humaines', 'equipements', 'informatique'];
const CLASSIFICATIONS = ['procedure', 'mode_operatoire', 'formulaire', 'politique', 'enregistrement'];
const TYPES_DOCUMENT = [
  { value: 'SOP', label: 'SOP — Standard Operating Procedure' },
  { value: 'mode_operatoire', label: 'Mode opératoire' },
  { value: 'formulaire', label: 'Formulaire' },
  { value: 'politique', label: 'Politique qualité' },
  { value: 'procedure', label: 'Procédure' },
  { value: 'guide', label: 'Guide / aide-mémoire' },
  { value: 'autre', label: 'Autre' },
];
const PERIODICITES = [3, 6, 12, 24, 36];

const DocumentFormPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const { data: existing } = useDocument(Number(id));
  const createMutation = useCreateDocument();
  const updateMutation = useUpdateDocument();

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  const { control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      titre: '', type_document: '', numero_document: '',
      periodicite_revision: null, theme: '', classification: '',
      contenu: '', date_validite: '',
    },
  });

  useEffect(() => {
    if (existing) {
      const d = existing as any;
      reset({
        titre: d.titre,
        type_document: d.type_document || '',
        numero_document: d.numero_document || '',
        periodicite_revision: d.periodicite_revision ?? null,
        theme: d.theme || '',
        classification: d.classification || '',
        contenu: d.contenu || '',
        date_validite: d.date_validite?.split('T')[0] || '',
      });
    }
  }, [existing, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      ...data,
      periodicite_revision: data.periodicite_revision || undefined,
    };
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: Number(id), data: payload });
        navigate(`/documents/${id}`);
      } else {
        const result = await createMutation.mutateAsync(payload);
        const newId = (result as { id: number }).id;
        if (pendingFile) {
          try {
            setFileUploading(true);
            await documentsApi.uploadFile(newId, pendingFile);
          } catch {} finally {
            setFileUploading(false);
          }
        }
        navigate(`/documents/${newId}`);
      }
    } catch {}
  };

  const handleFileUpload = async (file: File) => {
    if (id) {
      try {
        setFileUploading(true);
        await documentsApi.uploadFile(Number(id), file);
      } catch {} finally {
        setFileUploading(false);
      }
    } else {
      setPendingFile(file);
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

              {/* Titre */}
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

              {/* e-Document Control section */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                  e-Document Control (ISO 15189)
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Controller
                  name="type_document"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Type de document">
                      <MenuItem value="">—</MenuItem>
                      {TYPES_DOCUMENT.map((t) => (
                        <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Controller
                  name="numero_document"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Numéro de document"
                      placeholder="ex: QP-PREL-001"
                      helperText="Format : [type]-[service]-[numéro]"
                    />
                  )}
                />
              </Grid>

              <Grid item xs={12} sm={4}>
                <Controller
                  name="periodicite_revision"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Périodicité de révision"
                      value={field.value ?? ''} onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}>
                      <MenuItem value="">—</MenuItem>
                      {PERIODICITES.map((m) => (
                        <MenuItem key={m} value={m}>Tous les {m} mois</MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              {/* Document details */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                  Métadonnées
                </Typography>
                <Divider sx={{ mb: 2 }} />
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
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600} gutterBottom>
                  <AttachFile sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: 18 }} />
                  Fichier joint (Word, PDF, Excel…)
                </Typography>
                <Divider sx={{ mb: 2 }} />
                {!isEdit && pendingFile && (
                  <Alert severity="success" sx={{ mb: 1 }}>
                    Fichier sélectionné : {pendingFile.name} — sera joint après création du document.
                  </Alert>
                )}
                <FileUpload
                  onFileSelect={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods"
                  loading={fileUploading}
                  label={isEdit ? t('documents.uploadFile') : 'Joindre un fichier existant (optionnel)'}
                />
              </Grid>
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
