import React, { useRef, useState } from "react";
import {
  Box, Button, Card, CardContent, CardHeader, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, InputLabel, MenuItem, Paper, Select,
  Snackbar, Alert, TextField, Typography, Chip, LinearProgress, Divider,
  alpha, useTheme, Stack, Tooltip, Menu, IconButton, CircularProgress,
} from "@mui/material";
import {
  Add as AddIcon, TrendingUp, TrendingDown, CheckCircle, Cancel,
  ShowChart, Edit as EditIcon, AttachFile, Person, MoreVert,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer,
  Tooltip as RechartTooltip, XAxis, YAxis,
} from "recharts";
import PageHeader from "../../components/common/PageHeader";
import { kpiApi } from "../../api/kpi";
import { usersApi } from "../../api/users";
import { IndicateurQualite, MesureKPI } from "../../types";

// ── Types ──────────────────────────────────────────────────────────────────────
interface EditFormState {
  nom: string;
  code: string;
  periodicite: string;
  formule: string;
  cible: string;
  unite: string;
  biologiste_id: string;
  excelFile: File | null;
}

const EMPTY_EDIT: EditFormState = {
  nom: "", code: "", periodicite: "mensuelle", formule: "",
  cible: "", unite: "", biologiste_id: "", excelFile: null,
};

// ── KPIPage ────────────────────────────────────────────────────────────────────
const KPIPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [measureDialog, setMeasureDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<IndicateurQualite | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(EMPTY_EDIT);
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

  const { data: personnelData } = useQuery({
    queryKey: ["personnel"],
    queryFn: () => usersApi.listPersonnel(),
  });
  const biologistes = (personnelData?.data ?? []).filter((p) => p.role === "biologiste");

  const addMesureMutation = useMutation({
    mutationFn: (data: { indicateur_id: number; valeur: number; periode: string; commentaire?: string }) =>
      kpiApi.createMesure(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["kpi-indicators"] });
      setMeasureDialog(false);
      setMesureValue(""); setMesurePeriode(""); setMesureComment("");
      setSnackbar({ open: true, message: "Mesure enregistrée avec succès", severity: "success" });
    },
    onError: () => setSnackbar({ open: true, message: "Erreur lors de l'enregistrement", severity: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<IndicateurQualite> }) =>
      kpiApi.updateIndicateur(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-indicators"] });
    },
  });

  const uploadExcelMutation = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) =>
      kpiApi.uploadExcel(id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kpi-indicators"] });
    },
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

  const openEditDialog = (ind: IndicateurQualite) => {
    setEditTarget(ind);
    setEditForm({
      nom: ind.nom,
      code: ind.code,
      periodicite: ind.periodicite,
      formule: ind.formule ?? "",
      cible: ind.cible !== undefined ? String(ind.cible) : "",
      unite: ind.unite ?? "",
      biologiste_id: ind.biologiste_id !== undefined ? String(ind.biologiste_id) : "",
      excelFile: null,
    });
    setEditDialog(true);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        data: {
          nom: editForm.nom,
          code: editForm.code,
          periodicite: editForm.periodicite,
          formule: editForm.formule || undefined,
          cible: editForm.cible ? parseFloat(editForm.cible) : undefined,
          unite: editForm.unite || undefined,
          biologiste_id: editForm.biologiste_id ? parseInt(editForm.biologiste_id) : undefined,
        },
      });
      if (editForm.excelFile) {
        await uploadExcelMutation.mutateAsync({ id: editTarget.id, file: editForm.excelFile });
      }
      setSnackbar({ open: true, message: "Indicateur mis à jour", severity: "success" });
      setEditDialog(false);
    } catch {
      setSnackbar({ open: true, message: "Erreur lors de la mise à jour", severity: "error" });
    }
  };

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

      {indicateurs.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: "center", borderRadius: 2 }}>
          <ShowChart sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Aucun indicateur configuré
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Contactez l'administrateur pour configurer les indicateurs qualité.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {indicateurs.map((ind) => (
            <KPIIndicatorCard key={ind.id} indicator={ind} onEdit={openEditDialog} />
          ))}
        </Grid>
      )}

      {/* ── Saisir une mesure ─────────────────────────────────────────────── */}
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
              <Select value={selectedIndicator} label="Indicateur *" onChange={(e) => setSelectedIndicator(e.target.value)}>
                {indicateurs.map((ind) => (
                  <MenuItem key={ind.id} value={ind.id}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>{ind.nom}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ind.code} · Cible : {ind.cible} {ind.unite}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Valeur *" type="number" value={mesureValue}
                  onChange={(e) => setMesureValue(e.target.value)}
                  InputProps={{
                    endAdornment: selectedIndicator ? (
                      <Typography variant="caption" color="text.secondary">
                        {indicateurs.find((i) => i.id === selectedIndicator)?.unite}
                      </Typography>
                    ) : null,
                  }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth label="Période *" placeholder="ex: 2026-03" value={mesurePeriode}
                  onChange={(e) => setMesurePeriode(e.target.value)}
                  helperText="Format : AAAA-MM ou AAAA-Q1"
                />
              </Grid>
            </Grid>
            <TextField
              fullWidth multiline rows={2} label="Commentaire"
              value={mesureComment} onChange={(e) => setMesureComment(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMeasureDialog(false)}>Annuler</Button>
          <Button
            variant="contained" onClick={handleAddMesure}
            disabled={!selectedIndicator || !mesureValue || !mesurePeriode || addMesureMutation.isPending}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Modifier un indicateur ────────────────────────────────────────── */}
      <Dialog open={editDialog} onClose={() => setEditDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditIcon color="primary" />
            <Typography variant="h6">Modifier l'indicateur</Typography>
          </Stack>
        </DialogTitle>
        <Divider />
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <Grid container spacing={2}>
              <Grid item xs={8}>
                <TextField fullWidth label="Nom *" value={editForm.nom}
                  onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} />
              </Grid>
              <Grid item xs={4}>
                <TextField fullWidth label="Code *" value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField fullWidth label="Cible" type="number" value={editForm.cible}
                  onChange={(e) => setEditForm({ ...editForm, cible: e.target.value })} />
              </Grid>
              <Grid item xs={3}>
                <TextField fullWidth label="Unité" value={editForm.unite}
                  onChange={(e) => setEditForm({ ...editForm, unite: e.target.value })} />
              </Grid>
              <Grid item xs={3}>
                <FormControl fullWidth>
                  <InputLabel>Périodicité</InputLabel>
                  <Select value={editForm.periodicite} label="Périodicité"
                    onChange={(e) => setEditForm({ ...editForm, periodicite: e.target.value })}>
                    {["hebdomadaire", "mensuelle", "trimestrielle", "semestrielle", "annuelle"].map((p) => (
                      <MenuItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField fullWidth label="Formule / Description" multiline rows={2}
              value={editForm.formule} onChange={(e) => setEditForm({ ...editForm, formule: e.target.value })} />

            {/* Biologiste */}
            <FormControl fullWidth>
              <InputLabel>Biologiste responsable</InputLabel>
              <Select value={editForm.biologiste_id} label="Biologiste responsable"
                onChange={(e) => setEditForm({ ...editForm, biologiste_id: String(e.target.value) })}>
                <MenuItem value=""><em>— Aucun —</em></MenuItem>
                {biologistes.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.prenom} {b.nom}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Excel upload */}
            <Box>
              <Typography variant="body2" color="text.secondary" mb={0.5}>
                Fichier Excel d'analyse
              </Typography>
              <Button
                variant="outlined" component="label" startIcon={<AttachFile />}
                size="small" color={editForm.excelFile ? "success" : "inherit"}
              >
                {editForm.excelFile
                  ? editForm.excelFile.name
                  : editTarget?.fichier_excel
                    ? `Remplacer (${editTarget.fichier_excel.split("/").pop()})`
                    : "Joindre un fichier Excel"}
                <input
                  type="file" hidden
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={(e) => setEditForm({ ...editForm, excelFile: e.target.files?.[0] ?? null })}
                />
              </Button>
              {editTarget?.fichier_excel && !editForm.excelFile && (
                <Typography variant="caption" color="success.main" display="block" mt={0.5}>
                  Fichier actuel : {editTarget.fichier_excel.split("/").pop()}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog(false)}>Annuler</Button>
          <Button
            variant="contained" onClick={handleEditSave}
            disabled={!editForm.nom || !editForm.code || updateMutation.isPending || uploadExcelMutation.isPending}
            startIcon={(updateMutation.isPending || uploadExcelMutation.isPending) ? <CircularProgress size={16} /> : undefined}
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

// ── KPIIndicatorCard ───────────────────────────────────────────────────────────
interface KPIIndicatorCardProps {
  indicator: IndicateurQualite;
  onEdit: (ind: IndicateurQualite) => void;
}

const KPIIndicatorCard: React.FC<KPIIndicatorCardProps> = ({ indicator, onEdit }) => {
  const theme = useTheme();
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  const { data: mesuresData } = useQuery({
    queryKey: ["kpi-mesures", indicator.id],
    queryFn: () => kpiApi.listMesures(indicator.id),
  });
  const mesures: MesureKPI[] = (mesuresData?.data as any)?.items ?? (mesuresData?.data as any) ?? [];
  const lastMesure = mesures[mesures.length - 1];
  const prevMesure = mesures[mesures.length - 2];
  const isCompliant =
    indicator.cible !== undefined && lastMesure ? lastMesure.valeur >= indicator.cible : null;

  const trend =
    prevMesure && lastMesure
      ? ((lastMesure.valeur - prevMesure.valeur) / prevMesure.valeur) * 100
      : null;

  const progressPct =
    indicator.cible && lastMesure
      ? Math.min(100, (lastMesure.valeur / indicator.cible) * 100)
      : null;

  const borderColor =
    isCompliant === null
      ? theme.palette.divider
      : isCompliant
      ? theme.palette.success.main
      : theme.palette.error.main;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <Grid item xs={12} md={6} lg={4}>
      <Card
        onContextMenu={handleContextMenu}
        sx={{
          height: "100%",
          borderTop: `3px solid ${borderColor}`,
          transition: "box-shadow 0.2s",
          "&:hover": { boxShadow: 4 },
          cursor: "context-menu",
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
              <Stack direction="row" alignItems="center" spacing={0.5}>
                {isCompliant !== null && (
                  <Chip
                    icon={isCompliant ? <CheckCircle /> : <Cancel />}
                    label={isCompliant ? "Conforme" : "Hors cible"}
                    color={isCompliant ? "success" : "error"}
                    size="small"
                    sx={{ flexShrink: 0 }}
                  />
                )}
                <IconButton size="small" onClick={() => onEdit(indicator)} title="Modifier">
                  <MoreVert fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          }
          sx={{ pb: 0 }}
        />

        {/* Biologist & Excel badges */}
        {(indicator.biologiste || indicator.fichier_excel) && (
          <Box px={2} pt={0.5} display="flex" gap={1} flexWrap="wrap">
            {indicator.biologiste && (
              <Chip
                icon={<Person />}
                label={`${indicator.biologiste.prenom} ${indicator.biologiste.nom}`}
                size="small" variant="outlined" color="primary"
                sx={{ fontSize: 11 }}
              />
            )}
            {indicator.fichier_excel && (
              <Chip
                icon={<AttachFile />}
                label={indicator.fichier_excel.split("/").pop()}
                size="small" variant="outlined" color="success"
                sx={{ fontSize: 11 }}
              />
            )}
          </Box>
        )}

        <Divider sx={{ mt: 1 }} />
        <CardContent>
          {lastMesure ? (
            <>
              <Stack direction="row" alignItems="baseline" spacing={1} mb={0.5}>
                <Typography variant="h3" fontWeight={800} color={isCompliant === false ? "error.main" : "primary.main"}>
                  {lastMesure.valeur}
                </Typography>
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                  {indicator.unite}
                </Typography>
                {trend !== null && (
                  <Tooltip title="Variation par rapport à la période précédente">
                    <Stack direction="row" alignItems="center" spacing={0.25}>
                      {trend > 0 ? (
                        <TrendingUp fontSize="small" color="success" />
                      ) : (
                        <TrendingDown fontSize="small" color="error" />
                      )}
                      <Typography
                        variant="caption"
                        color={trend > 0 ? "success.main" : "error.main"}
                        fontWeight={700}
                      >
                        {Math.abs(trend).toFixed(1)}%
                      </Typography>
                    </Stack>
                  </Tooltip>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
                Dernière mesure : {lastMesure.periode}
              </Typography>

              {progressPct !== null && (
                <Box mb={2}>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Progression vers la cible
                    </Typography>
                    <Typography variant="caption" fontWeight={700} color={isCompliant ? "success.main" : "error.main"}>
                      Cible : {indicator.cible} {indicator.unite}
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate" value={progressPct}
                    color={isCompliant ? "success" : "error"}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="right" mt={0.25}>
                    {progressPct.toFixed(0)}%
                  </Typography>
                </Box>
              )}

              {mesures.length > 1 && (
                <Box sx={{ mt: 1, mx: -1 }}>
                  <ResponsiveContainer width="100%" height={90}>
                    <AreaChart data={mesures.slice(-12)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={`grad-${indicator.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={isCompliant === false ? "#ef4444" : "#3b82f6"} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={isCompliant === false ? "#ef4444" : "#3b82f6"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                      <XAxis dataKey="periode" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <RechartTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(val: any) => [`${val} ${indicator.unite}`, "Valeur"]}
                      />
                      {indicator.cible !== undefined && (
                        <ReferenceLine
                          y={indicator.cible}
                          stroke={theme.palette.error.main}
                          strokeDasharray="4 4"
                          label={{
                            value: `Cible: ${indicator.cible}`,
                            fontSize: 10,
                            fill: theme.palette.error.main,
                            position: "right",
                          }}
                        />
                      )}
                      <Area
                        type="monotone" dataKey="valeur"
                        stroke={isCompliant === false ? "#ef4444" : "#3b82f6"}
                        strokeWidth={2} fill={`url(#grad-${indicator.id})`}
                        dot={{ r: 3, fill: isCompliant === false ? "#ef4444" : "#3b82f6" }}
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
                py: 3, textAlign: "center",
                bgcolor: alpha(theme.palette.action.hover, 0.5),
                borderRadius: 1.5,
                border: `1px dashed ${theme.palette.divider}`,
              }}
            >
              <ShowChart sx={{ fontSize: 32, color: "text.disabled", mb: 1 }} />
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

      {/* Right-click context menu */}
      <Menu
        open={!!ctxMenu}
        onClose={() => setCtxMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={ctxMenu ? { top: ctxMenu.y, left: ctxMenu.x } : undefined}
      >
        <MenuItem onClick={() => { onEdit(indicator); setCtxMenu(null); }}>
          <EditIcon fontSize="small" sx={{ mr: 1 }} />
          Modifier l'indicateur
        </MenuItem>
      </Menu>
    </Grid>
  );
};

export default KPIPage;
