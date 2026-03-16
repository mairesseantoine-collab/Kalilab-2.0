import React, { useState } from "react";
import { Box, Button, FormControl, Grid, InputLabel, MenuItem, Paper, Select, Snackbar, Alert, TextField, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import PageHeader from "../../components/common/PageHeader";
import { equipmentApi } from "../../api/equipment";

const schema = z.object({
  nom: z.string().min(2, "Min 2 caracteres"),
  categorie: z.string().min(1, "Obligatoire"),
  numero_inventaire: z.string().min(1, "Obligatoire"),
  fabricant: z.string().optional(),
  modele: z.string().optional(),
  numero_serie: z.string().optional(),
  localisation: z.string().optional(),
  prochaine_calibration: z.string().optional(),
  prochaine_maintenance: z.string().optional(),
  periodicite_calibration_jours: z.number().optional(),
});
type FormData = z.infer<typeof schema>;

const CATEGORIES = ["analyseur","centrifugeuse","autoclave","pipette","balance","thermometre","refrigerateur","autre"];

const EquipmentFormPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({ open: false, message: "", severity: "success" });

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nom: "", categorie: "", numero_inventaire: "", fabricant: "", modele: "", numero_serie: "", localisation: "", prochaine_calibration: "", prochaine_maintenance: "", periodicite_calibration_jours: 365 },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormData) => equipmentApi.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["equipment"] }); setSnackbar({ open: true, message: "Equipement cree", severity: "success" }); setTimeout(() => navigate("/equipment"), 1000); },
    onError: () => setSnackbar({ open: true, message: "Erreur", severity: "error" }),
  });

  return (
    <Box>
      <PageHeader title={t("equipment.new", "Nouvel equipement")} />
      <Paper sx={{ p: 3, maxWidth: 800 }}>
        <form onSubmit={handleSubmit((d) => createMutation.mutate(d))}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Controller name="nom" control={control} render={({ field }) => <TextField {...field} fullWidth label="Nom *" error={!!errors.nom} helperText={errors.nom?.message} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="categorie" control={control} render={({ field }) => (
                <FormControl fullWidth error={!!errors.categorie}>
                  <InputLabel>Categorie *</InputLabel>
                  <Select {...field} label="Categorie *">
                    {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                  {errors.categorie && <Typography color="error" variant="caption">{errors.categorie.message}</Typography>}
                </FormControl>
              )} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="numero_inventaire" control={control} render={({ field }) => <TextField {...field} fullWidth label="N inventaire *" error={!!errors.numero_inventaire} helperText={errors.numero_inventaire?.message} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="fabricant" control={control} render={({ field }) => <TextField {...field} fullWidth label="Fabricant" />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="modele" control={control} render={({ field }) => <TextField {...field} fullWidth label="Modele" />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="numero_serie" control={control} render={({ field }) => <TextField {...field} fullWidth label="N serie" />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="localisation" control={control} render={({ field }) => <TextField {...field} fullWidth label="Localisation" />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="periodicite_calibration_jours" control={control} render={({ field }) => <TextField {...field} fullWidth type="number" label="Periodicite calibration (jours)" onChange={(e) => field.onChange(Number(e.target.value))} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="prochaine_calibration" control={control} render={({ field }) => <TextField {...field} fullWidth type="date" label="Prochaine calibration" InputLabelProps={{ shrink: true }} />} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Controller name="prochaine_maintenance" control={control} render={({ field }) => <TextField {...field} fullWidth type="date" label="Prochaine maintenance" InputLabelProps={{ shrink: true }} />} />
            </Grid>
            <Grid item xs={12}>
              <Box display="flex" gap={2} justifyContent="flex-end">
                <Button variant="outlined" onClick={() => navigate("/equipment")}>{t("common.cancel")}</Button>
                <Button type="submit" variant="contained" disabled={createMutation.isPending}>{createMutation.isPending ? t("common.loading") : t("common.save")}</Button>
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
export default EquipmentFormPage;
