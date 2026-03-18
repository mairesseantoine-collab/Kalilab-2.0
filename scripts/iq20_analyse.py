#!/usr/bin/env python3
"""
IQ 20 — Analyse Hémostase S2 2025
====================================
Usage :
    python iq20_analyse.py <chemin_vers_fichier.xls|xlsx>

Sorties :
    IQ20_STE_S2_2025.png
    IQ20_STM_S2_2025.png
    Bloc Markdown KPI + résumé exécutif (stdout)
"""

import sys
import os
import re
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")           # Pas d'affichage interactif
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
from pathlib import Path

warnings.filterwarnings("ignore")

# ─── Constantes ───────────────────────────────────────────────────────────────

MOIS = ["Juil 25", "Août 25", "Sept 25", "Oct 25", "Nov 25", "Déc 25"]

# Variantes d'intitulés de lignes acceptées (insensible à la casse + accents)
ROW_PATTERNS = {
    "Demandes A":                       [r"demandes?\s*a$", r"^a$"],
    "Demandes A non vérifiées":         [r"non v[eé]rifi[eé]es?"],
    "Demandes A vérifiées":             [r"^demandes?\s*a\s+v[eé]rifi[eé]es?$",
                                         r"^a\s+v[eé]rifi[eé]es?$"],
    "Demandes A vérifiées avec erreur": [r"avec erreur"],
    "Demandes A vérifiées sans erreur": [r"sans erreur"],
    "Demandes H":                       [r"demandes?\s*h"],
}

SITE_PATTERNS = {
    "STE": [r"\bste\b", r"\bsite\s*e\b"],
    "STM": [r"\bstm\b", r"\bsite\s*m\b"],
}

# ─── Utilitaires ──────────────────────────────────────────────────────────────

def normalize(s: str) -> str:
    """Minuscules + retire accents basiques."""
    import unicodedata
    nfkd = unicodedata.normalize("NFD", str(s))
    return nfkd.encode("ascii", "ignore").decode("ascii").lower().strip()


def match_row(cell_value: str, patterns: list[str]) -> bool:
    n = normalize(cell_value)
    return any(re.search(p, n) for p in patterns)


def match_site(cell_value: str, patterns: list[str]) -> bool:
    n = normalize(str(cell_value))
    return any(re.search(p, n) for p in patterns)


def load_excel(filepath: str) -> pd.DataFrame:
    """Charge l'onglet ANALYSE depuis un .xls ou .xlsx."""
    ext = Path(filepath).suffix.lower()
    if ext == ".xls":
        engine = "xlrd"
    elif ext in (".xlsx", ".xlsm"):
        engine = "openpyxl"
    else:
        raise ValueError(
            f"Format non reconnu : {ext}. "
            "Exportez l'onglet ANALYSE en CSV ou en .xlsx et relancez."
        )

    try:
        df = pd.read_excel(
            filepath, sheet_name="ANALYSE", engine=engine,
            header=None, dtype=str
        )
        print(f"[OK] Fichier chargé : {filepath} ({df.shape[0]} lignes × {df.shape[1]} cols)")
        return df
    except Exception as exc:
        print(f"[ERREUR] Impossible de lire {filepath} : {exc}")
        print(
            "\n→ Solution : ouvrez le fichier dans Excel, allez sur l'onglet ANALYSE,\n"
            "  Fichier > Exporter > CSV (séparateur virgule), puis relancez avec ce CSV."
        )
        sys.exit(1)


def detect_month_columns(df: pd.DataFrame) -> dict[str, int]:
    """
    Cherche les colonnes dont l'entête ressemble à Juil/Août/Sept/Oct/Nov/Déc 25.
    Retourne {label_normalisé: col_index}.
    """
    # Variantes acceptées
    month_map = {
        "juil": "Juil 25",
        "aout": "Août 25",
        "août": "Août 25",
        "sept": "Sept 25",
        "oct":  "Oct 25",
        "nov":  "Nov 25",
        "dec":  "Déc 25",
        "déc":  "Déc 25",
    }
    found: dict[str, int] = {}  # {canonical_label: col_idx}

    for row_idx in range(min(10, df.shape[0])):
        for col_idx in range(df.shape[1]):
            cell = str(df.iloc[row_idx, col_idx])
            n = normalize(cell)
            for key, label in month_map.items():
                if key in n and label not in found:
                    found[label] = col_idx
        if len(found) == 6:
            break

    return found  # peut être incomplet si en-têtes absents → fallback colonnes


def find_site_blocks(df: pd.DataFrame) -> dict[str, int]:
    """
    Localise les lignes de début de chaque bloc STE / STM.
    Retourne {site: row_index}.
    """
    site_rows: dict[str, int] = {}
    for row_idx in range(df.shape[0]):
        for col_idx in range(min(4, df.shape[1])):
            cell = str(df.iloc[row_idx, col_idx])
            for site, pats in SITE_PATTERNS.items():
                if site not in site_rows and match_site(cell, pats):
                    site_rows[site] = row_idx
    return site_rows


def extract_block(df: pd.DataFrame, start_row: int, month_cols: dict[str, int]) -> pd.DataFrame:
    """
    À partir de start_row, extrait les lignes correspondant aux indicateurs
    et construit un DataFrame (index = mois).
    """
    data: dict[str, list] = {k: [] for k in ROW_PATTERNS}
    found_rows: dict[str, int] = {}

    # Balayer les ~20 lignes suivant le header de site
    for row_idx in range(start_row, min(start_row + 25, df.shape[0])):
        for col_idx in range(min(4, df.shape[1])):
            cell = str(df.iloc[row_idx, col_idx])
            if not cell or cell in ("nan", "None"):
                continue
            for canonical, patterns in ROW_PATTERNS.items():
                if canonical not in found_rows and match_row(cell, patterns):
                    found_rows[canonical] = row_idx
                    break

    # Construire le DataFrame mois × indicateur
    records: dict[str, list] = {}
    for month_label in MOIS:
        col_idx = month_cols.get(month_label)
        row_data = {}
        for canonical, row_idx in found_rows.items():
            if col_idx is not None:
                raw = df.iloc[row_idx, col_idx]
            else:
                raw = np.nan
            try:
                row_data[canonical] = float(str(raw).replace(",", ".").replace(" ", ""))
            except (ValueError, TypeError):
                row_data[canonical] = np.nan
        records[month_label] = row_data

    result = pd.DataFrame(records).T   # index = mois
    result.index = pd.CategoricalIndex(result.index, categories=MOIS, ordered=True)
    result = result.sort_index()

    # S'assurer que toutes les colonnes attendues existent
    for col in ROW_PATTERNS:
        if col not in result.columns:
            result[col] = np.nan

    return result[list(ROW_PATTERNS.keys())]


def compute_kpi(df: pd.DataFrame) -> pd.DataFrame:
    """Calcule les 3 taux KPI mois par mois."""
    kpi = pd.DataFrame(index=df.index)
    kpi["Taux vérification (%)"] = (
        df["Demandes A vérifiées"] / df["Demandes A"] * 100
    ).where(df["Demandes A"] > 0, np.nan)

    kpi["Taux erreur / vérifiées (%)"] = (
        df["Demandes A vérifiées avec erreur"] / df["Demandes A vérifiées"] * 100
    ).where(df["Demandes A vérifiées"] > 0, np.nan)

    kpi["Taux erreur global (%)"] = (
        df["Demandes A vérifiées avec erreur"] / df["Demandes A"] * 100
    ).where(df["Demandes A"] > 0, np.nan)

    return kpi


def totaux_s2(df: pd.DataFrame, kpi: pd.DataFrame) -> dict:
    """Agrégats S2."""
    return {
        "Σ Demandes A":    df["Demandes A"].sum(),
        "Σ Demandes H":    df["Demandes H"].sum(),
        "Σ vérifiées":     df["Demandes A vérifiées"].sum(),
        "Σ erreurs":       df["Demandes A vérifiées avec erreur"].sum(),
        "⌀ Taux vérif (%)":         kpi["Taux vérification (%)"].mean(),
        "⌀ Taux erreur/vérif (%)":  kpi["Taux erreur / vérifiées (%)"].mean(),
        "⌀ Taux erreur global (%)": kpi["Taux erreur global (%)"].mean(),
    }


def plot_site(df: pd.DataFrame, kpi: pd.DataFrame, site: str, output_path: str):
    """Graphe par site : histogramme empilé + courbe taux d'erreur."""
    fig, ax1 = plt.subplots(figsize=(11, 6))
    fig.patch.set_facecolor("#FAFAFA")
    ax1.set_facecolor("#FAFAFA")

    x = np.arange(len(MOIS))
    width = 0.55

    # Valeurs
    non_verif = df["Demandes A non vérifiées"].fillna(0).values
    verif_ok  = df["Demandes A vérifiées sans erreur"].fillna(0).values
    verif_err = df["Demandes A vérifiées avec erreur"].fillna(0).values

    # Histogramme empilé
    b1 = ax1.bar(x, non_verif, width, label="Non vérifiées", color="#B0BEC5", zorder=2)
    b2 = ax1.bar(x, verif_ok,  width, bottom=non_verif,
                 label="Vérifiées sans erreur", color="#42A5F5", zorder=2)
    b3 = ax1.bar(x, verif_err, width, bottom=non_verif + verif_ok,
                 label="Vérifiées avec erreur", color="#EF5350", zorder=2)

    ax1.set_xlabel("Mois", fontsize=11)
    ax1.set_ylabel("Nombre de demandes A", fontsize=11)
    ax1.set_xticks(x)
    ax1.set_xticklabels(MOIS, rotation=30, ha="right")
    ax1.yaxis.set_major_locator(mtick.MaxNLocator(integer=True))
    ax1.grid(axis="y", linestyle="--", alpha=0.4, zorder=1)

    # Axe droit — taux d'erreur parmi vérifiées
    ax2 = ax1.twinx()
    taux_err = kpi["Taux erreur / vérifiées (%)"].values
    ax2.plot(x, taux_err, "o--", color="#FF6F00", linewidth=2,
             markersize=7, label="Taux erreur / vérifiées (%)", zorder=5)
    ax2.set_ylabel("Taux d'erreur parmi vérifiées (%)", fontsize=11, color="#FF6F00")
    ax2.tick_params(axis="y", labelcolor="#FF6F00")
    ax2.yaxis.set_major_formatter(mtick.FormatStrFormatter("%.1f %%"))
    ax2.set_ylim(0, max(20, np.nanmax(taux_err) * 1.4 if not np.all(np.isnan(taux_err)) else 20))

    # Seuil 10 %
    ax2.axhline(10, linestyle=":", color="#FF6F00", alpha=0.5, linewidth=1.5, zorder=3)
    ax2.text(len(MOIS) - 0.5, 10.3, "Seuil 10 %", color="#FF6F00",
             fontsize=9, ha="right")

    # Légendes fusionnées
    handles1, labels1 = ax1.get_legend_handles_labels()
    handles2, labels2 = ax2.get_legend_handles_labels()
    ax1.legend(handles1 + handles2, labels1 + labels2,
               loc="upper left", fontsize=9, framealpha=0.85)

    plt.title(f"IQ 20 — Hémostase {site} — S2 2025\nResponsable : Dr Mairesse",
              fontsize=13, fontweight="bold", pad=12)
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"[PNG] Sauvegardé : {output_path}")


def executive_summary(
    site: str,
    df: pd.DataFrame,
    kpi: pd.DataFrame,
    tot: dict,
    other_tot: dict | None = None,
) -> str:
    """Génère un bloc Markdown résumé pour un site."""

    # Mois pic d'erreur
    err = kpi["Taux erreur / vérifiées (%)"]
    pic_err  = err.idxmax() if not err.isna().all() else "N/A"
    creux_err = err.idxmin() if not err.isna().all() else "N/A"
    val_pic  = err.max() if not err.isna().all() else float("nan")
    val_creux = err.min() if not err.isna().all() else float("nan")

    # Mois fort volume A
    vol = df["Demandes A"]
    pic_vol = vol.idxmax() if not vol.isna().all() else "N/A"
    val_vol = int(vol.max()) if not vol.isna().all() else 0

    # Tendance vérification (pente linéaire)
    verif = kpi["Taux vérification (%)"].dropna().values
    if len(verif) >= 2:
        slope = np.polyfit(range(len(verif)), verif, 1)[0]
        tendance = "en hausse" if slope > 0.5 else ("en baisse" if slope < -0.5 else "stable")
    else:
        tendance = "indéterminée"

    alert = ""
    if not np.isnan(val_pic) and val_pic > 10:
        alert = (
            f"\n> ⚠️ **Taux d'erreur > 10 %** en {pic_err} ({val_pic:.1f} %) : "
            "envisager une revue des procédures de vérification, "
            "formation ciblée des techniciens concernés, et audit de la période."
        )

    compare = ""
    if other_tot:
        diff = tot["⌀ Taux erreur/vérif (%)"] - other_tot["⌀ Taux erreur/vérif (%)"]
        autre_site = "STM" if site == "STE" else "STE"
        if abs(diff) > 1:
            compare = (
                f"- Taux d'erreur moyen **{abs(diff):.1f} point(s) {'supérieur' if diff > 0 else 'inférieur'}** "
                f"à {autre_site} ({other_tot['⌀ Taux erreur/vérif (%)']:.1f} %)."
            )

    lines = [
        f"### {site} — S2 2025",
        f"- **Volume** : {int(tot['Σ Demandes A'])} demandes A au total "
        f"(pic en {pic_vol} : {val_vol} demandes).",
        f"- **Taux de vérification moyen** : {tot['⌀ Taux vérif (%)']:.1f} % — tendance {tendance}.",
        f"- **Taux d'erreur moyen** (parmi vérifiées) : {tot['⌀ Taux erreur/vérif (%)']:.1f} % "
        f"— pic {pic_err} ({val_pic:.1f} %), creux {creux_err} ({val_creux:.1f} %).",
    ]
    if compare:
        lines.append(compare)
    if alert:
        lines.append(alert)

    return "\n".join(lines)


def kpi_table_md(kpi: pd.DataFrame, tot: dict, site: str) -> str:
    """Tableau KPI Markdown."""
    rows = ["| Mois | Demandes A | Vérif (%) | Erreur/Vérif (%) | Erreur global (%) |",
            "|------|:----------:|:---------:|:----------------:|:-----------------:|"]
    for mois in kpi.index:
        da  = "—"  # on accède au df parent, on va passer kpi + df séparément
        tv  = f"{kpi.loc[mois, 'Taux vérification (%)']:.1f}" if pd.notna(kpi.loc[mois, 'Taux vérification (%)']) else "—"
        tev = f"{kpi.loc[mois, 'Taux erreur / vérifiées (%)']:.1f}" if pd.notna(kpi.loc[mois, 'Taux erreur / vérifiées (%)']) else "—"
        teg = f"{kpi.loc[mois, 'Taux erreur global (%)']:.1f}" if pd.notna(kpi.loc[mois, 'Taux erreur global (%)']) else "—"
        rows.append(f"| {mois} | — | {tv} % | {tev} % | {teg} % |")

    rows.append(
        f"| **Moy. S2** | **{int(tot['Σ Demandes A'])}** | "
        f"**{tot['⌀ Taux vérif (%)']:.1f} %** | "
        f"**{tot['⌀ Taux erreur/vérif (%)']:.1f} %** | "
        f"**{tot['⌀ Taux erreur global (%)']:.1f} %** |"
    )
    return "\n".join(rows)


def kpi_table_with_vol(df: pd.DataFrame, kpi: pd.DataFrame, tot: dict) -> str:
    """Tableau KPI Markdown avec volumes."""
    rows = ["| Mois | Dem. A | Vérif (%) | Erreur/Vérif (%) | Erreur global (%) |",
            "|------|:------:|:---------:|:----------------:|:-----------------:|"]
    for mois in kpi.index:
        da  = f"{int(df.loc[mois, 'Demandes A'])}" if pd.notna(df.loc[mois, 'Demandes A']) else "—"
        tv  = f"{kpi.loc[mois, 'Taux vérification (%)']:.1f}" if pd.notna(kpi.loc[mois, 'Taux vérification (%)']) else "—"
        tev = f"{kpi.loc[mois, 'Taux erreur / vérifiées (%)']:.1f}" if pd.notna(kpi.loc[mois, 'Taux erreur / vérifiées (%)']) else "—"
        teg = f"{kpi.loc[mois, 'Taux erreur global (%)']:.1f}" if pd.notna(kpi.loc[mois, 'Taux erreur global (%)']) else "—"
        rows.append(f"| {mois} | {da} | {tv} % | {tev} % | {teg} % |")
    rows.append(
        f"| **Moy./Total S2** | **{int(tot['Σ Demandes A'])}** | "
        f"**{tot['⌀ Taux vérif (%)']:.1f} %** | "
        f"**{tot['⌀ Taux erreur/vérif (%)']:.1f} %** | "
        f"**{tot['⌀ Taux erreur global (%)']:.1f} %** |"
    )
    return "\n".join(rows)


# ─── Pipeline principal ────────────────────────────────────────────────────────

def run(filepath: str, output_dir: str = "."):
    df_raw = load_excel(filepath)

    # 1. Détecter les colonnes mensuelles
    month_cols = detect_month_columns(df_raw)
    if not month_cols:
        print("[WARN] Colonnes mensuelles non détectées automatiquement.")
        print("       Vérifiez que la ligne d'en-tête contient bien Juil 25 … Déc 25.")
        # Fallback : utiliser les colonnes 1..6 (après la première)
        for i, label in enumerate(MOIS):
            month_cols[label] = i + 1
    else:
        print(f"[OK] Colonnes détectées : { {k: v for k, v in month_cols.items()} }")

    # 2. Localiser les blocs STE / STM
    site_rows = find_site_blocks(df_raw)
    print(f"[OK] Blocs détectés : {site_rows}")
    if not site_rows:
        print("[ERREUR] Impossible de localiser les blocs STE et STM.")
        print("         Vérifiez que l'onglet ANALYSE contient bien les mots STE et STM.")
        sys.exit(1)

    results: dict[str, dict] = {}

    for site, start_row in sorted(site_rows.items()):
        print(f"\n--- {site} (ligne {start_row}) ---")
        df_site = extract_block(df_raw, start_row, month_cols)
        print(df_site.head(6).to_string())
        kpi = compute_kpi(df_site)
        tot = totaux_s2(df_site, kpi)
        results[site] = {"df": df_site, "kpi": kpi, "tot": tot}

    # 3. Graphiques
    for site, res in results.items():
        out = os.path.join(output_dir, f"IQ20_{site}_S2_2025.png")
        plot_site(res["df"], res["kpi"], site, out)

    # 4. Rapport Markdown
    sep = "\n\n---\n\n"
    md_parts = [
        "# IQ 20 — S2 2025 — Responsable : Dr Mairesse",
        "> *Indicateur de qualité en hémostase — Analyse des demandes A et H*",
        "",
    ]

    tot_ste = results.get("STE", {}).get("tot")
    tot_stm = results.get("STM", {}).get("tot")

    for site, res in results.items():
        other_tot = tot_stm if site == "STE" else tot_ste
        md_parts.append(f"## {site}")
        md_parts.append(kpi_table_with_vol(res["df"], res["kpi"], res["tot"]))
        md_parts.append("")
        md_parts.append(executive_summary(site, res["df"], res["kpi"], res["tot"], other_tot))
        md_parts.append("")

    # Comparatif rapide STE vs STM
    if tot_ste and tot_stm:
        md_parts.append("## Comparatif STE vs STM")
        md_parts.append(
            f"| Indicateur | STE | STM |\n"
            f"|------------|:---:|:---:|\n"
            f"| Σ Demandes A | {int(tot_ste['Σ Demandes A'])} | {int(tot_stm['Σ Demandes A'])} |\n"
            f"| Σ Demandes H | {int(tot_ste['Σ Demandes H'])} | {int(tot_stm['Σ Demandes H'])} |\n"
            f"| ⌀ Taux vérif | {tot_ste['⌀ Taux vérif (%)']:.1f} % | {tot_stm['⌀ Taux vérif (%)']:.1f} % |\n"
            f"| ⌀ Taux erreur/vérif | {tot_ste['⌀ Taux erreur/vérif (%)']:.1f} % | {tot_stm['⌀ Taux erreur/vérif (%)']:.1f} % |\n"
        )

    report = "\n".join(md_parts)
    print("\n" + "═" * 70)
    print(report)
    print("═" * 70)

    # Sauvegarder le rapport
    report_path = os.path.join(output_dir, "IQ20_rapport_S2_2025.md")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)
    print(f"\n[MD] Rapport sauvegardé : {report_path}")

    return results


# ─── Point d'entrée ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage : python iq20_analyse.py <fichier.xls|xlsx>")
        print("Exemple : python iq20_analyse.py IQ20_hemostase_S2_2025.xlsx")
        sys.exit(1)

    filepath = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(filepath))

    if not os.path.exists(filepath):
        print(f"[ERREUR] Fichier introuvable : {filepath}")
        sys.exit(1)

    run(filepath, output_dir)
