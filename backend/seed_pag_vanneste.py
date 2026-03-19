"""
Seed des données PAG de Mr Vanneste — à exécuter une seule fois.
python seed_pag_vanneste.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date
from database.engine import async_session, create_db_and_tables
from database.models import ActionPAG


ACTIONS = [
    {
        "tache": "Recontacté Mme Vass pour le contrat d'entretien entre 18h et 8h le matin, vu le caractère stratégique du purificateur d'eau.",
        "attribution": "Vanneste",
        "avancement_notes": (
            "02/02/2023 A été rajouté au budget par Mme Julie Hotton, je l'ai mise au courant de ce point spécifique du PAG le 06/02/2023\n\n"
            "04/05/2023 Suite aux nombreuses pannes, un cahier des charges complet a été écrit et envoyé au Dr Reginster pour avis. "
            "Le Dr Reginster n'ayant émis aucune opinion quant aux exigences, le cahier de charge a été envoyé à Mme Vass dans le but hypothétique "
            "de placer un nouveau système d'eau commun entre éventuellement la dialyse et le laboratoire pour le deuxième semestre 2023.\n\n"
            "19/07/2023 Dossier d'investissement MIF pour un nouveau système de purification d'eau vient d'être finalisé. "
            "Transmis à Mme Vass et Mme Hotton pour signature et négociation/finalisation. Deux firmes sont retenues : Véolia et Merck.\n\n"
            "14/03/2024 L'appareil installé depuis 23/01/2024 et c'est Millipore. Le contrat d'entretien est encore à signer."
        ),
        "avancement_pct": 75,
        "priorite": "2- Non imp - Urg",
        "date_fin_prevue": date(2023, 12, 25),
        "cloture": False,
        "groupe": "Chimie 1 STE",
        "annexe": None,
        "famille": "Matériel de laboratoire (5.3)",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "Maj les habilitations et évaluations des compétences du personnel pour la toxicologie",
        "attribution": "Vanneste",
        "avancement_notes": None,
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": date(2026, 12, 1),
        "cloture": False,
        "groupe": "Chimie 1 STE",
        "annexe": "Audit interne",
        "famille": "6.2.3 Autorisation",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "Décrire le matériel de recueil (tube beige, tube borate,…. ?) pour le cannabis dans le compendium à vérifier aussi pour les autres drogues testées",
        "attribution": "Vanneste",
        "avancement_notes": None,
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": date(2027, 11, 1),
        "cloture": False,
        "groupe": "Chimie 1 STE",
        "annexe": "Audit interne",
        "famille": "7.2.4 Prélèvement et manipulation des échantillons primaires",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "MAJ compendium concernant la température et délais de transport des analyses toxicologiques sériques et urinaires",
        "attribution": "Vanneste",
        "avancement_notes": (
            "17/01/2025 Communiqué avec Kevin du service de toxicologie de l'UCL. Comme les distances à parcourir sur le campus et à l'hôpital "
            "sont relativement grandes, on considère que 3 à 4 heures ne posent pas de soucis. Comme stabilité ensuite, on considère 48h au frigo. "
            "Comme éventuellement la molécule la plus à risque est la benzoylecgonine, j'ai posé spécifiquement la question sur celle-ci et de son avis, "
            "les conditions de transport indiquées ci-dessus ne posaient pas problème.\n\n"
            "13/02/2025 (ch) Compléter le compendium"
        ),
        "avancement_pct": 75,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": date(2027, 11, 1),
        "cloture": False,
        "groupe": "Chimie 1 STE",
        "annexe": "Audit interne",
        "famille": "7.2.5 Transport des échantillons",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "Investiguer concernant la recherche d'un QCE sérique (cf labo accrédité ? Ring test ?)",
        "attribution": "Vanneste",
        "avancement_notes": (
            "17/01/2025 Des contrôles existent chez Arvecon (surtout axés sur LC-MS) et Bio-Rad. Tous deux pêchent sur les équivalences et sont "
            "difficilement applicables sur les plaquettes Nal Von Minden. En ce qui concerne le métabolite actif de la Méthadone, l'EDDP, la molécule "
            "est présente dans les contrôles, mais la concentration n'est jamais donnée. Les informations m'ont été communiquées par Kevin du service "
            "de toxicologie de l'UCL. Concernant une demande de Ring test, Kevin m'a communiqué que comme la vérification des douteux, positifs "
            "s'opère par LC-MS, ils n'en n'ont pas besoin.\n\n"
            "13/02/2025 (ch) En discuter en réunion département et formaliser au niveau mammouth"
        ),
        "avancement_pct": 75,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": date(2027, 11, 1),
        "cloture": False,
        "groupe": "Chimie 1 STE",
        "annexe": "Audit interne",
        "famille": "7.3.7 Garantie de la validité des résultats d'examen(s)",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "Remplir les stabilités au niveau de Glims sur les analyses de Roche à StE parce que là les rajouts ne sont pas vérifiés par une personne.",
        "attribution": "Vanneste",
        "avancement_notes": (
            "8/7/2025 A été vérifié sur 3 paramètres : GOT, LDH et progestérone. Elles sont bien remplis. "
            "Vérifié également compendium : OK. Question subsidiaire : Il y a une logique informatique derrière qui avertit ?\n\n"
            "2/9/2025 (ch) Peut-être voir avec MC? Mais important pour l'audit externe, je pense"
        ),
        "avancement_pct": 75,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": date(2025, 10, 1),
        "cloture": False,
        "groupe": "Qualité",
        "annexe": None,
        "famille": None,
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "Revoir pq paracétamol valider auto entre 10 et 30\nPq para tjs à tel <5",
        "attribution": "Vanneste",
        "avancement_notes": None,
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "TLM Nuit",
        "annexe": None,
        "famille": None,
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "HLY : demander à Gatien d'ajouter l'indicateur qualité vers le KPI de sciensano (de 100 mg/dL). On maintiens le 40 et ajoutons le 100 mg/dL",
        "attribution": "Vanneste",
        "avancement_notes": (
            "8/7/2025 Envoyé mail chez l'intéressé, mais sans retour. Renvoyé mail aujourd'hui le 04/07/2025.\n\n"
            "08/07/2025 Monsieur Hocepied vient de répondre. Ce sera fait aujourd'hui ou demain."
        ),
        "avancement_pct": 75,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "Indicateurs qualité",
        "annexe": None,
        "famille": None,
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "NC à créer pour le valproate",
        "attribution": "Vanneste",
        "avancement_notes": (
            "08/07/2025 Fait le 08/07/2025 Porte le numéro 1112.\n\n"
            "2/9/2025 (ch) Je ne vois pas de trace de cette NCONF. Numéro erronée car on n'est dans le 1300\n\n"
            "15/09/2025 Mail naar Mr. Vanneste vor nazicht"
        ),
        "avancement_pct": 75,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "QCI / QCE",
        "annexe": None,
        "famille": None,
        "responsable_pag": "Vanneste",
    },
    {
        "tache": (
            "Décrire (ou vérifier si déjà écrit dans mammouth) la comparaison des cobas : "
            "aucune description n'est faite de ce qui est réellement comparé concernant le Cobas, "
            "à quelle fréquence, où sont enregistrés les résultats des comparaisons et comment "
            "sont gérés et communiqués les écarts."
        ),
        "attribution": "Vanneste",
        "avancement_notes": None,
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": date(2026, 6, 1),
        "cloture": False,
        "groupe": "Chimie 1 STE",
        "annexe": "Audit interne",
        "famille": "7.3.7 Garantie de la validité des résultats d'examen(s)",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": "NC 1307 : Faire la grille de formation VIDAS ainsi que de revoir la qualification existante dans KaliLab",
        "attribution": "Vanneste",
        "avancement_notes": "A faire avec l'aide de Joël",
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "Plaintes/ NCONF",
        "annexe": None,
        "famille": None,
        "responsable_pag": "Vanneste",
    },
    {
        "tache": (
            "Mettre à l'ordre du jour Chimie 1 STM :\n"
            "- Utilisation du tableau blanc pour le relais d'informations : suivi des calibrations, "
            "stocks de réactifs / gestion des lots et périmés"
        ),
        "attribution": "Vanneste",
        "avancement_notes": "22/10/2025 (ch) je l'ai mis à l'ordre du jour de la prochaine réunion, date?",
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "Chimie 1 STM",
        "annexe": "Audit interne",
        "famille": "5.4.1 Généralités",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": (
            "Revoir les dossiers de vérification des osmomètres afin de voir si mentionnent les n° de série "
            "des 2 équipements dont un est sur le site de Ste Elisabeth. "
            "Il n'y a aucun moyen de savoir s'ils ont été vérifiés tous les deux ou s'il y a eu une seule "
            "vérification sur le site de Ste Elisabeth."
        ),
        "attribution": "Vanneste",
        "avancement_notes": None,
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "Chimie 1 STM",
        "annexe": "Audit interne",
        "famille": "6.4.3 Procédure d'acceptation des équipements",
        "responsable_pag": "Vanneste",
    },
    {
        "tache": (
            "Insister en réunion département pour CHIMIE 1 STM :\n"
            "- Bien vérifier les tickets de résultats / la liste de travail\n"
            "- La criticité de refaire une analyse : tenir compte de ne pas le faire sur tube débouché "
            "et endéans les 4h?"
        ),
        "attribution": "Vanneste",
        "avancement_notes": None,
        "avancement_pct": 0,
        "priorite": "3- Imp - Non Urg",
        "date_fin_prevue": None,
        "cloture": False,
        "groupe": "Chimie 1 STM",
        "annexe": "Audit interne",
        "famille": "7.3.7 Garantie de la validité des résultats d'examen(s)",
        "responsable_pag": "Vanneste",
    },
]


async def seed():
    await create_db_and_tables()
    async with async_session() as session:
        for data in ACTIONS:
            action = ActionPAG(**data)
            session.add(action)
        await session.commit()
        print(f"✅ {len(ACTIONS)} actions PAG Vanneste insérées.")


if __name__ == "__main__":
    asyncio.run(seed())
