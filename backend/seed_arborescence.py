"""
Seed de l'arborescence documentaire KaliLab.
Crée tous les Services et Localisations/Zones selon le document
"Modification de l'arborescence.docx".

Usage :
    python seed_arborescence.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from sqlmodel import Session, create_engine, select
from database.models import Service, Localisation

DATABASE_URL = "sqlite:///./kalilab.db"
engine = create_engine(DATABASE_URL)

# ── Définition complète de l'arborescence ─────────────────────────────────────
#
# Format:
#   (ordre, label, nom, site, zones)
#
# zones = liste de (nom_zone, [sous-zones])
#   ex: ("Biochimie automatisée", ["Osmomètre", "Vidas"])
#
# site = "both" | "STE" | "STM"
#
ARBORESCENCE = [
    (1,  "PREL",  "Prélèvement",                                       "both", []),
    (2,  "SECR",  "Secrétariat",                                        "both", [
        ("Accueil", []),
        ("Réception & Encodage", []),
        ("Préanalytique (tri)", []),
    ]),
    (3,  "PREST", "Sous-traitance / Prestataires Externes",             "both", []),
    (4,  "CH1",   "Chimie 1",                                           "both", [
        ("Général", []),
        ("Biochimie automatisée", ["Osmomètre", "Vidas"]),
        ("Toxicologie", []),
    ]),
    (5,  "CH2",   "Chimie 2",                                           "both", [
        ("Général", []),
        ("Électrophorèse", ["Liaison XL", "Optilite"]),
    ]),
    (6,  "HEM",   "Hématologie",                                        "both", [
        ("Général", []),
        ("XN – COFO / Cytologie", [
            "Hémato manuelle",
            "Liquides divers – Cytologie",
            "VS",
            "TOSOH",
        ]),
    ]),
    (7,  "COA",   "Coagulation",                                        "both", [
        ("Général", []),
        ("Tests de routine", ["Tests spéciaux", "Multiplate"]),
    ]),
    (8,  "BDS",   "Banque de Sang",                                     "both", [
        ("Général", []),
        ("Organisation", ["Immuno-hématologie"]),
    ]),
    (9,  "TPG",   "Immunophénotypage",                                   "STE",  [
        ("Général", []),
    ]),
    (10, "SPERM", "Spermiologie",                                        "STE",  [
        ("Général", []),
    ]),
    (11, "PCR",   "Biologie Moléculaire",                               "both", [
        ("Général", []),
        ("GeneXpert", ["Seegene"]),
    ]),
    (12, "MICRO", "Microbiologie",                                       "both", [
        ("Général", []),
        ("Préanalytique (Tri, WASP, Ensemencements)", [
            "Urines",
            "Selles",
            "CUO – Cultures ordinaires",
            "Hémocultures",
            "Identification micro-organismes",
            "Antibiogrammes",
            "Mycologie",
            "Mycobactéries",
            "Garde Microbio",
            "Divers (envoi, souchothèque, antigènes)",
        ]),
    ]),
    (13, "POST",  "Postanalytique",                                      "both", [
        ("Revue des résultats (confirmation, validation)", []),
        ("Compte-rendu des résultats", []),
        ("Traitement post-analytique des échantillons", []),
        ("Facturation", []),
    ]),
    (14, "LOGI",  "Logistique",                                          "both", []),
    (15, "TRAN",  "Transport",                                           "both", []),
    (16, "RH",    "Ressources Humaines",                                 "both", []),
    (17, "IT",    "Informatique",                                        "both", []),
    (18, "METR",  "Métrologie",                                          "both", []),
    (19, "POCT",  "POCT",                                                "both", [
        ("Général", []),
        ("GEM5000", []),
        ("Afinion – CRP", []),
        ("Nova – Glucose", []),
    ]),
    (20, "ENVIR", "Installations et Conditions Environnementales",       "both", [
        ("Locaux et installations", []),
        ("Sécurité", []),
        ("Gestion des déchets", []),
    ]),
    (21, "MGT",   "Management",                                          "both", [
        ("Organisation", []),
        ("Impartialité et confidentialité", []),
        ("Objectifs et politiques", []),
        ("Gestion des risques et opportunités / SWOT", []),
        ("Gestion des réclamations, non-conformités et événements indésirables", []),
        ("Gestion des actions correctives et opportunités d'amélioration", []),
        ("Maîtrise des documents et enregistrements", []),
        ("Gestion des indicateurs", []),
        ("Gestion des audits", []),
        ("Plan de continuité des activités et de préparation aux situations d'urgence", []),
        ("Revue de direction", []),
    ]),
]


def seed(session: Session):
    existing = session.exec(select(Service)).first()
    if existing:
        print("⚠️  Des services existent déjà. Seed ignoré.")
        print("   Pour réinitialiser : DELETE FROM services; DELETE FROM localisations;")
        return

    total_services = 0
    total_zones = 0

    for ordre, label, nom, site, zones in ARBORESCENCE:
        svc = Service(label=label, nom=nom, site=site, ordre=ordre)
        session.add(svc)
        session.flush()  # obtenir l'id
        total_services += 1

        zone_ordre = 0
        for zone_def in zones:
            if isinstance(zone_def, tuple):
                zone_nom, sous_zones = zone_def
            else:
                zone_nom, sous_zones = zone_def, []

            z = Localisation(
                service_id=svc.id,
                nom=zone_nom,
                ordre=zone_ordre,
            )
            session.add(z)
            session.flush()
            total_zones += 1
            zone_ordre += 1

            for i, sz_nom in enumerate(sous_zones):
                sz = Localisation(
                    service_id=svc.id,
                    parent_id=z.id,
                    nom=sz_nom,
                    ordre=i,
                )
                session.add(sz)
                total_zones += 1

        print(f"  ✅ {label:6s} — {nom} ({len(zones)} zones)")

    session.commit()
    print(f"\n🎉 Arborescence créée : {total_services} services, {total_zones} zones/localisations")


if __name__ == "__main__":
    from sqlmodel import SQLModel
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        seed(session)
