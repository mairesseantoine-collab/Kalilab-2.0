import React, { useState } from "react";
import {
  Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, InputLabel, MenuItem, Paper, Select,
  Snackbar, Alert, TextField, Typography, Chip, LinearProgress, Divider,
  alpha, useTheme, Stack, Tooltip,
} from "@mui/material";
import {
  Add as AddIcon, TrendingUp, TrendingDown, CheckCircle, Cancel,
  ShowChart,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import PageHeader from "../../components/common/PageHeader";
import { kpiApi } from "../../api/kpi";
import { IndicateurQualite, MesureKPI } from "../../types";

const KPIPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [measureDialog, setMeasureDialog] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<number | string>("");
  const [mesureValue, setMesureValue] = useState("");
  const [mesurePeriode, setMesurePeriode] = useState("");
  const [mesureComment, setMesureComment] = useState("");
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "success",
  });

  const { data: indicateursData } = useQuery({
    queryKey: ["kpi-indicators"],
    queryFn: () => kpiApi.listIndicateurs(),
  });
  const indicateurs: IndicateurQualite[] = indicateursData?.data ?? [];

  const addMesureMutation = useMutation({
    mutationFn: (data: { indicateur_id: number; valeur: number; periode: string; commentaire?: string }) =>
      kpiApi.createMesure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-indicators"] });
      setMeasureDialog(false);
      setMesureValue("");
      setMesurePeriode("");
      setMesureComment("");
      setSnackbar({ open: true, message: "Mesure enregistrée avec succès", severity: "success" });
    },
    onError: () => setSnackbar({ open: true, message: "Erreur lors de l'enregistrement", severity: "error" }),
  });

  const handleAddMesure = () => {
    if (!selectedIndicator || !mesureValue || !mesurePeriode) return;
    addMesureMutation.mutate({
      indicateur_id: Number(selectedIndicator),
      valeur: parseFloat(mesureValue),
      periode: mesurePeriode,
      commentaire: mesureComment || undefined,
    });
  };

  // Summary stats
  const conforme = indicateurs.length; // Will be computed per card
  const totalIndicateurs = indicateurs.length;

  return (
    <Box>
      <PageHeader
        title="Indicateurs qualité"
        actionButton={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setMeasureDialog(true)}>
            Saisir une mesure
          </Button>
        }
      />

      {totalIndicateurs === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center", borderRadius: 2 }}>
          <ShowChart sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucun indicateur configuré
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Contactez l'administrateur pour configurer les indicateurs qualité de votre laboratoire.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {indicateurs.map((ind) => (
            <KPIIndicatorCard key={ind.id} indicator={ind} />
          ))}
        </Grid>
      )}

      {/* Dialog saisie mesure */}
      <Dialog open={measureDialog} onClose={() => setMeasureDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <AddIcon color="primary" />
            <Typography variant="h6">Saisir une mesure</Typography>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Indicateur *</InputLabel>
              <Select
                value={selectedIndicator}
                label="Indicateur *"
                onChange={(e) => setSelectedIndicator(e.target.value)}
              >
                {indicateurs.map((ind) => (
                  <MenuItem key={ind.id} value={ind.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{ind.nom}</Typography>
                      <Typography variant="caption" color="text.secondary">{ind.code} · Cible : {ind.cible} {ind.unite}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Valeur *"
                  type="number"
                  value={mesureValue}
                  onChange={(e) => setMesureValue(e.target.value)}
                  InputProps={{
                    endAdornment: selectedIndicator ? (
                      <Typography variant="caption" color="text.secondary">
                        {indicateurs.find(i => i.id === selectedIndicator)?.unite}
                      </Typography>
                    ) : null,
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Période *"
                  placeholder="ex: 2026-03"
                  value={mesurePeriode}
                  onChange={(e) => setMesurePeriode(e.target.value)}
                  helperText="Format : AAAA-MM ou AAAA-Q1"
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Commentaire"
              placeholder="Contexte, observations..."
              value={mesureComment}
              onChange={(e) => setMesureComment(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMeasureDialog(false)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleAddMesure}
            disabled={!selectedIndicator || !mesureValue || !mesurePeriode || addMesureMutation.isPending}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

interface KPIIndicatorCardProps {
  indicator: IndicateurQualite;
}

const KPIIndicatorCard: React.FC<KPIIndicatorCardProps> = ({ indicator }) => {
  const theme = useTheme();

  const { data: mesuresData } = useQuery({
    queryKey: ["kpi-mesures", indicator.id],
    queryFn: () => kpiApi.listMesures(indicator.id),
  });
  const mesures: MesureKPI[] = (mesuresData?.data as any)?.items ?? (mesuresData?.data as any) ?? [];
  const lastMesure = mesures[mesures.length - 1];
  const prevMesure = mesures[mesures.length - 2];
  const isCompliant = indicator.cible !== undefined && lastMesure
    ? lastMesure.valeur >= indicator.cible
    : null;

  // Trend calculation
  const trend = prevMesure && lastMesure
    ? ((lastMesure.valeur - prevMesure.valeur) / prevMesure.valeur) * 100
    : null;

  const progressPct = indicator.cible && lastMesure
    ? Math.min(100, (lastMesure.valeur / indicator.cible) * 100)
    : null;

  const borderColor = isCompliant === null
    ? theme.palette.divider
    : isCompliant
    ? theme.palette.success.main
    : theme.palette.error.main;

  return (
    <Grid item xs={12} md={6} lg={4}>
      <Card
        sx={{
          height: '100%',
          borderTop: `3px solid ${borderColor}`,
          transition: 'box-shadow 0.2s',
          '&:hover': { boxShadow: 4 },
        }}
      >
        <CardHeader
          title={
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box flex={1} pr={1}>
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
                  {indicator.nom}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {indicator.code} · {indicator.periodicite}
                </Typography>
              </Box>
              {isCompliant !== null && (
                <Chip
                  icon={isCompliant ? <CheckCircle /> : <Cancel />}
                  label={isCompliant ? 'Conforme' : 'Hors cible'}
                  color={isCompliant ? 'success' : 'error'}
                  size="small"
                  sx={{ flexShrink: 0 }}
                />
              )}
            </Stack>
          }
          sx={{ pb: 0 }}
        />
        <Divider sx={{ mt: 1 }} />
        <CardContent>
          {lastMesure ? (
            <>
              {/* Current value */}
              <Stack direction="row" alignItems="baseline" spacing={1} mb={0.5}>
                <Typography variant="h3" fontWeight={800} color={isCompliant === false ? 'error.main' : 'primary.main'}>
                  {lastMesure.valeur}
                </Typography>
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                  {indicator.unite}
                </Typography>
                {trend !== null && (
                  <Tooltip title={`Variation par rapport à la période précédente`}>
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      {trend > 0 ? (
                        <TrendingUp fontSize="small" color="success" />
                      ) : (
                        <TrendingDown fontSize="small" color="error" />
                      )}
                      <Typography variant="caption" color={trend > 0 ? 'success.main' : 'error.main'} fontWeight={700}>
                        {Math.abs(trend).toFixed(1)}%
                      </Typography>
                    </Stack>
                  </Tooltip>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Dernière mesure : {lastMesure.periode}
              </Typography>

              {/* Progress bar toward target */}
              {progressPct !== null && (
                <Box mb={2}>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Progression vers la cible
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color={isCompliant ? 'success.main' : 'error.main'}>
                      Cible : {indicator.cible} {indicator.unite}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={progressPct}
                    color={isCompliant ? "success" : "error"}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="right" mt={0.25}>
                    {progressPct.toFixed(0)}%
                  </Typography>
                </Box>
              )}

              {/* Mini chart */}
              {mesures.length > 1 && (
                <Box sx={{ mt: 1, mx: -1 }}>
                  <ResponsiveContainer width="100%" height={90}>
                    <AreaChart data={mesures.slice(-12)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${indicator.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isCompliant === false ? '#ef4444' : '#3b82f6'} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={isCompliant === false ? '#ef4444' : '#3b82f6'} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                      <XAxis dataKey="periode" hide />
                      <YAxis hide domain={['auto', 'auto']} />
                      <RechartTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(val: any) => [`${val} ${indicator.unite}`, 'Valeur']}
                      />
                      {indicator.cible !== undefined && (
                        <ReferenceLine
                          y={indicator.cible}
                          stroke={theme.palette.error.main}
                          strokeDasharray="4 4"
                          label={{ value: `Cible: ${indicator.cible}`, fontSize: 10, fill: theme.palette.error.main, position: 'right' }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="valeur"
                        stroke={isCompliant === false ? '#ef4444' : '#3b82f6'}
                        strokeWidth={2}
                        fill={`url(#grad-${indicator.id})`}
                        dot={{ r: 3, fill: isCompliant === false ? '#ef4444' : '#3b82f6' }}
                        activeDot={{ r: 5 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </>
          ) : (
            <Box
              sx={{
                py: 3, textAlign: 'center',
                bgcolor: alpha(theme.palette.action.hover, 0.5),
                borderRadius: 1.5,
                border: `1px dashed ${theme.palette.divider}`,
              }}
            >
              <ShowChart sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Aucune mesure enregistrée
              </Typography>
              {indicator.cible !== undefined && (
                <Typography variant="caption" color="text.disabled">
                  Cible : {indicator.cible} {indicator.unite}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Grid>
  );
};

export default KPIPage;
