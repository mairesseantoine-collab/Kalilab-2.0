import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, CardHeader, Divider, Grid, TextField, MenuItem,
  Button, CircularProgress, Alert, Typography, Slider, Chip, alpha,
  Paper, Stack,
} from '@mui/material';
import {
  Save, ArrowBack, Shield, Assignment,
  ErrorOutline, WarningAmber, Info, CheckCircle,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { risksApi } from '../../api/risks';
import { usersApi } from '../../api/users';
import { RiskLevel } from '../../types';
import PageHeader from '../../components/common/PageHeader';

const schema = z.object({
  description: z.string().min(1, 'Obligatoire'),
  processus: z.string().optional(),
  probabilite: z.number().min(1).max(5),  // Fréquence (F)
  impact: z.number().min(1).max(5),        // Gravité (G)
  controles: z.string().optional(),
  plan_action: z.string().optional(),
  echeance: z.string().optional(),
  statut: z.string().optional(),
  responsable_id: z.union([z.number(), z.null()]).optional(),
});

type FormData = z.infer<typeof schema>;

const F_LABELS = ['1 — Très rare', '2 — Rare', '3 — Occasionnel', '4 — Fréquent', '5 — Très fréquent'];
const G_LABELS = ['1 — Impact négligeable', '2 — Impact faible', '3 — Impact moyen', '4 — Impact élevé', '5 — Impact critique'];

const getCriticite = (s: number): RiskLevel =>
  s <= 4 ? 'faible' : s <= 9 ? 'modere' : s <= 16 ? 'eleve' : 'critique';

const LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; icon: React.ReactNode; decision: string }> = {
  faible:   { label: 'Faible',   color: '#10b981', bg: '#ecfdf5', icon: <CheckCircle />, decision: 'Accepter / Maintenir' },
  modere:   { label: 'Modéré',   color: '#f59e0b', bg: '#fffbeb', icon: <Info />,        decision: 'À surveiller' },
  eleve:    { label: 'Élevé',    color: '#f97316', bg: '#fff7ed', icon: <WarningAmber />, decision: "Plan d'action requis" },
  critique: { label: 'Critique', color: '#ef4444', bg: '#fef2f2', icon: <ErrorOutline />, decision: 'Action urgente' },
};

const RiskFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEdit = !!id;

  const { data: existing } = useQuery({
    queryKey: ['risks', Number(id)],
    queryFn: () => risksApi.get(Number(id)).then((r) => r.data),
    enabled: isEdit,
  });

  const { data: personnelData } = useQuery({
    queryKey: ['personnel'],
    queryFn: () => usersApi.listPersonnel().then(r => r.data),
    staleTime: 10 * 60 * 1000,
  });

  const { control, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '', processus: '',
      probabilite: 3, impact: 3,
      controles: '', plan_action: '',
      echeance: '', statut: 'ouvert',
      responsable_id: null,
    },
  });

  const freq = watch('probabilite');
  const grav = watch('impact');
  const score = (freq || 1) * (grav || 1);
  const level = getCriticite(score);
  const cfg = LEVEL_CONFIG[level];

  useEffect(() => {
    if (existing) {
      reset({
        description: existing.description ?? '',
        processus: existing.processus_id ? String(existing.processus_id) : '',
        probabilite: existing.probabilite ?? 3,
        impact: existing.impact ?? 3,
        controles: (existing as any).controles ?? '',
        plan_action: (existing as any).plan_action ?? '',
        echeance: existing.echeance?.split('T')[0] || '',
        statut: existing.statut || 'ouvert',
        responsable_id: (existing as any).responsable_id ?? null,
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData & { score_risque: number; criticite: RiskLevel }) =>
      isEdit
        ? risksApi.update(Number(id), data as any).then((r) => r.data)
        : risksApi.create(data as any).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      navigate('/risks');
    },
  });

  const onSubmit = async (data: FormData) => {
    const enriched = {
      ...data,
      score_risque: score,
      criticite: getCriticite(score) as RiskLevel,
      responsable_id: data.responsable_id ?? undefined,
    };
    await mutation.mutateAsync(enriched as any);
  };

  return (
    <Box>
      <PageHeader
        title={isEdit ? 'Modifier le risque' : 'Nouveau risque (AMDEC)'}
        breadcrumbs={[{ label: 'Risques', path: '/risks' }, { label: isEdit ? 'Modification' : 'Nouveau risque' }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Grid container spacing={3}>

          {/* Live IPR score card */}
          <Grid item xs={12}>
            <Paper
              sx={{
                p: 2.5, borderRadius: 2,
                bgcolor: alpha(cfg.color, 0.06),
                border: `2px solid ${alpha(cfg.color, 0.3)}`,
                display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
              }}
            >
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: '50%',
                  bgcolor: cfg.color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', flexShrink: 0,
                }}
              >
                <Typography variant="h5" fontWeight={900} lineHeight={1}>{score}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.9, fontSize: 9 }}>IPR</Typography>
              </Box>
              <Box flex={1}>
                <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                  <Box sx={{ color: cfg.color }}>{cfg.icon}</Box>
                  <Typography variant="h6" fontWeight={700} color={cfg.color}>{cfg.label}</Typography>
                  <Chip
                    label={cfg.decision}
                    size="small"
                    sx={{ bgcolor: cfg.bg, color: cfg.color, fontWeight: 700, border: `1px solid ${alpha(cfg.color, 0.4)}` }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  IPR = Gravité (G{grav}) × Fréquence (F{freq}) = <strong>{score}</strong>
                  {' '}— {
                    level === 'faible' ? 'Risque négligeable, aucune action immédiate requise.'
                    : level === 'modere' ? 'Risque acceptable avec surveillance régulière.'
                    : level === 'eleve' ? "Un plan d'action doit être envisagé."
                    : 'Risque intolérable — action corrective urgente obligatoire.'
                  }
                </Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Description + process */}
          <Grid item xs={12}>
            <Card>
              <CardHeader title="1. Identification du risque" titleTypographyProps={{ variant: 'h6', fontWeight: 600 }} sx={{ pb: 0 }} />
              <Divider sx={{ mt: 1 }} />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller name="description" control={control} render={({ field }) => (
                      <TextField
                        {...field} fullWidth multiline rows={3}
                        label="Description du risque *"
                        error={!!errors.description}
                        helperText={errors.description?.message ?? 'Décrivez le scénario de risque : quoi, où, quand'}
                        required
                      />
                    )} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller name="processus" control={control} render={({ field }) => (
                      <TextField {...field} fullWidth label="Processus concerné" placeholder="ex: Préanalytique, Analytique…" />
                    )} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller name="responsable_id" control={control} render={({ field }) => (
                      <TextField
                        select fullWidth label="Responsable"
                        value={field.value ?? ''}
                        onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
                      >
                        <MenuItem value=""><em>Non attribué</em></MenuItem>
                        {(personnelData ?? []).map((p: any) => (
                          <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                        ))}
                      </TextField>
                    )} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* AMDEC scoring sliders */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title="2. Cotation AMDEC"
                subheader="Gravité (G) × Fréquence (F) = Indice de Priorité du Risque (IPR)"
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                sx={{ pb: 0 }}
              />
              <Divider sx={{ mt: 1 }} />
              <CardContent>
                <Grid container spacing={4}>
                  {/* Gravité */}
                  <Grid item xs={12} sm={6}>
                    <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={700}>
                        Gravité (G) — {G_LABELS[grav - 1]}
                      </Typography>
                      <Chip label={`G${grav}`} size="small" color="error" sx={{ fontWeight: 700 }} />
                    </Box>
                    <Controller name="impact" control={control} render={({ field }) => (
                      <Slider
                        {...field}
                        min={1} max={5} step={1}
                        marks={[1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) }))}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => G_LABELS[v - 1]?.split(' — ')[1] ?? String(v)}
                        sx={{
                          color: grav >= 5 ? '#ef4444' : grav >= 4 ? '#f97316' : grav >= 3 ? '#f59e0b' : '#10b981',
                          '& .MuiSlider-track': { height: 6 },
                          '& .MuiSlider-rail': { height: 6 },
                        }}
                        onChange={(_, v) => field.onChange(v)}
                      />
                    )} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.disabled">Négligeable</Typography>
                      <Typography variant="caption" color="error.main">Critique</Typography>
                    </Stack>
                  </Grid>

                  {/* Fréquence */}
                  <Grid item xs={12} sm={6}>
                    <Box mb={1} display="flex" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={700}>
                        Fréquence (F) — {F_LABELS[freq - 1]}
                      </Typography>
                      <Chip label={`F${freq}`} size="small" color="warning" sx={{ fontWeight: 700 }} />
                    </Box>
                    <Controller name="probabilite" control={control} render={({ field }) => (
                      <Slider
                        {...field}
                        min={1} max={5} step={1}
                        marks={[1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) }))}
                        valueLabelDisplay="auto"
                        valueLabelFormat={(v) => F_LABELS[v - 1]?.split(' — ')[1] ?? String(v)}
                        sx={{
                          color: freq >= 5 ? '#ef4444' : freq >= 4 ? '#f97316' : freq >= 3 ? '#f59e0b' : '#10b981',
                          '& .MuiSlider-track': { height: 6 },
                          '& .MuiSlider-rail': { height: 6 },
                        }}
                        onChange={(_, v) => field.onChange(v)}
                      />
                    )} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.disabled">Très rare</Typography>
                      <Typography variant="caption" color="error.main">Très fréquent</Typography>
                    </Stack>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Controls + action plan */}
          <Grid item xs={12}>
            <Card>
              <CardHeader
                title={
                  <Box display="flex" alignItems="center" gap={1}>
                    <Shield fontSize="small" color="primary" />
                    3. Barrières & plan d'action
                  </Box>
                }
                titleTypographyProps={{ variant: 'h6', fontWeight: 600 }}
                sx={{ pb: 0 }}
              />
              <Divider sx={{ mt: 1 }} />
              <CardContent>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <Controller name="controles" control={control} render={({ field }) => (
                      <TextField
                        {...field} fullWidth multiline rows={3}
                        label="Barrières de sécurité existantes"
                        placeholder="ex: Double vérification d'identité, contrôle qualité interne, procédure de confirmation…"
                        helperText="Actions préventives déjà en place qui réduisent le risque résiduel"
                        InputProps={{ startAdornment: <Shield sx={{ mr: 1, color: 'text.disabled', flexShrink: 0, mt: 0.5 }} fontSize="small" /> }}
                      />
                    )} />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller name="plan_action" control={control} render={({ field }) => (
                      <TextField
                        {...field} fullWidth multiline rows={3}
                        label="Plan d'action à mettre en place"
                        placeholder="ex: Former le personnel, mettre à jour la procédure, acquérir un équipement…"
                        helperText="Actions correctives ou préventives décidées pour réduire le risque"
                        InputProps={{ startAdornment: <Assignment sx={{ mr: 1, color: 'text.disabled', flexShrink: 0, mt: 0.5 }} fontSize="small" /> }}
                      />
                    )} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller name="echeance" control={control} render={({ field }) => (
                      <TextField {...field} fullWidth type="date" label="Échéance du plan d'action" InputLabelProps={{ shrink: true }} />
                    )} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller name="statut" control={control} render={({ field }) => (
                      <TextField {...field} fullWidth select label="Statut">
                        <MenuItem value="ouvert">Ouvert</MenuItem>
                        <MenuItem value="traite">Traité</MenuItem>
                        <MenuItem value="accepte">Accepté</MenuItem>
                        <MenuItem value="surveille">Surveillé</MenuItem>
                        <MenuItem value="clos">Clos</MenuItem>
                      </TextField>
                    )} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {mutation.isError && (
            <Grid item xs={12}>
              <Alert severity="error">Erreur lors de l'enregistrement du risque</Alert>
            </Grid>
          )}

          {/* Actions */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Box display="flex" gap={2} justifyContent="space-between" alignItems="center">
                <Button startIcon={<ArrowBack />} onClick={() => navigate('/risks')}>
                  Retour
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={isSubmitting ? <CircularProgress size={18} color="inherit" /> : <Save />}
                  disabled={isSubmitting}
                  sx={{ bgcolor: cfg.color, '&:hover': { bgcolor: cfg.color, filter: 'brightness(0.9)' } }}
                >
                  {isSubmitting ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le risque'}
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
};

export default RiskFormPage;
