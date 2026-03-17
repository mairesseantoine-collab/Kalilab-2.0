"""
Seed script - populates the database with realistic Belgian medical lab data.
Run: docker exec kalilab-backend-dev python seed.py
"""
import asyncio
import json
from datetime import datetime, date, timedelta
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from database.models import (
    User, UserRole,
    DocumentQualite, DocumentStatus,
    Risque, RiskLevel,
    NonConformite, NCStatus,
    Audit, AuditType,
    IndicateurQualite, MesureKPI,
    Equipement, EquipmentStatus, Calibration,
    Fournisseur, Article, Commande, Lot, LotStatus,
    Plainte, ComplaintStatus,
    Action,
    AuditLog,
    Service, Localisation,
    Qualification,
)
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./kalilab.db")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    async with async_session() as session:

        # ------------------------------------------------------------------ #
        # 1. USERS                                                            #
        # ------------------------------------------------------------------ #
        user_data = [
            ("Admin",       "KaliLab",      "admin@kalilab.be",        "Admin2024!",  UserRole.ADMIN),
            ("Sophie",      "Renard",       "sophie.renard@kalilab.be", "Quali2024!",  UserRole.QUALITICIEN),
            ("Marc",        "Dubois",       "marc.dubois@kalilab.be",   "Tech2024!",   UserRole.RESP_TECHNIQUE),
            ("Claire",      "Laurent",      "claire.laurent@kalilab.be","Bio2024!",    UserRole.BIOLOGISTE),
            ("Jean-Pierre", "Fontaine",     "jp.fontaine@kalilab.be",   "Tech2024!",   UserRole.TECHNICIEN),
        ]

        users = {}
        keys = ["admin", "qualiticien", "resp_tech", "biologiste", "technicien"]
        for key, (prenom, nom, email, pwd, role) in zip(keys, user_data):
            u = User(
                email=email,
                prenom=prenom,
                nom=nom,
                hashed_password=pwd_context.hash(pwd),
                role=role,
                is_active=True,
            )
            session.add(u)
            await session.flush()
            users[key] = u

        await session.commit()
        for u in users.values():
            await session.refresh(u)

        print(f"[OK] {len(users)} users created")

        # ------------------------------------------------------------------ #
        # 2. DOCUMENTS                                                        #
        # ------------------------------------------------------------------ #
        docs_data = [
            {
                "titre": "Procédure de préanalyse des échantillons sanguins",
                "statut": DocumentStatus.PUBLIE,
                "version": "3.2",
                "auteur_id": users["qualiticien"].id,
                "contenu": "Cette procédure décrit les étapes de réception, identification et traitement primaire des échantillons sanguins.",
                "approbateurs": json.dumps([users["admin"].id]),
            },
            {
                "titre": "Mode opératoire hématologie automatisée (XN-3000)",
                "statut": DocumentStatus.RELECTURE,
                "version": "2.0",
                "auteur_id": users["biologiste"].id,
                "contenu": "Mode opératoire pour l'utilisation de l'automate XN-3000 Sysmex en hématologie de routine.",
                "approbateurs": json.dumps([users["resp_tech"].id]),
            },
            {
                "titre": "Enregistrement de traçabilité des réactifs",
                "statut": DocumentStatus.BROUILLON,
                "version": "1.1",
                "auteur_id": users["resp_tech"].id,
                "contenu": "Formulaire d'enregistrement de la réception et de l'utilisation des réactifs critiques.",
                "approbateurs": json.dumps([users["admin"].id]),
            },
        ]

        created_docs = []
        for dd in docs_data:
            d = DocumentQualite(**dd)
            session.add(d)
            created_docs.append(d)

        await session.commit()
        for d in created_docs:
            await session.refresh(d)

        print(f"[OK] {len(created_docs)} documents created")

        # ------------------------------------------------------------------ #
        # 3. RISKS                                                            #
        # ------------------------------------------------------------------ #
        risks = [
            Risque(
                description="Risque d'erreur d'identification patient lors de la collecte",
                probabilite=3,
                impact=5,
                score_risque=15,
                criticite=RiskLevel.CRITIQUE,
                controles="Double vérification identité + bracelet patient + code-barres",
                responsable_id=users["resp_tech"].id,
            ),
            Risque(
                description="Panne de l'automate hématologique en période de forte activité",
                probabilite=2,
                impact=4,
                score_risque=8,
                criticite=RiskLevel.ELEVE,
                controles="Contrat de maintenance préventive + automate de secours",
                responsable_id=users["biologiste"].id,
            ),
        ]
        for r in risks:
            session.add(r)

        await session.commit()
        print("[OK] 2 risks created")

        # ------------------------------------------------------------------ #
        # 4. NON-CONFORMITIES                                                 #
        # ------------------------------------------------------------------ #
        nc1 = NonConformite(
            type_nc="interne",
            description="Tube hépariné réceptionné sans bouchon hermétique - risque de contamination",
            impact="Résultats ionogramme potentiellement invalides sur 3 patients",
            statut=NCStatus.CAPA_EN_COURS,
            declarant_id=users["technicien"].id,
            responsable_id=users["qualiticien"].id,
            date_detection=datetime.utcnow() - timedelta(days=15),
            date_echeance=date.today() + timedelta(days=10),
            traitement_immediat="Mise en quarantaine des tubes concernés. Recontact patients.",
            analyse_causes="Défaut de contrôle à la réception. Procédure non respectée.",
            capa="1. Mise à jour procédure réception\n2. Formation personnel\n3. Checklist obligatoire",
        )
        session.add(nc1)

        nc2 = NonConformite(
            type_nc="externe",
            description="Délai rendu résultats NFS dépassé (>4h) sans information au prescripteur",
            impact="Retard de prise en charge thérapeutique pour 1 patient urgence",
            statut=NCStatus.EN_ANALYSE,
            declarant_id=users["biologiste"].id,
            responsable_id=users["resp_tech"].id,
            date_detection=datetime.utcnow() - timedelta(days=5),
            date_echeance=date.today() + timedelta(days=20),
            traitement_immediat="Appel au prescripteur. Résultats transmis en urgence.",
        )
        session.add(nc2)

        await session.commit()
        await session.refresh(nc1)
        await session.refresh(nc2)
        print("[OK] 2 non-conformities created")

        action1 = Action(
            type_action="corrective",
            description="Réviser la procédure de réception pour intégrer la checklist obligatoire",
            responsable_id=users["qualiticien"].id,
            nc_id=nc1.id,
            statut="en_cours",
            echeance=date.today() + timedelta(days=7),
        )
        session.add(action1)
        await session.commit()
        print("[OK] 1 action created")

        # ------------------------------------------------------------------ #
        # 5. AUDIT                                                            #
        # ------------------------------------------------------------------ #
        audit1 = Audit(
            titre="Audit interne préanalyse Q1 2026",
            type_audit=AuditType.INTERNE,
            referentiel="ISO 15189:2022 §5.4 - §5.7",
            auditeur_id=users["qualiticien"].id,
            date_planifiee=date.today() + timedelta(days=14),
            statut="planifie",
            constats=json.dumps([
                {"reference": "OBS-001", "description": "Procédure de centrifugation non affichée au poste", "gravite": "mineure"},
                {"reference": "OBS-002", "description": "Registre de température non renseigné sur 2 jours", "gravite": "majeure"},
            ]),
            ecarts=json.dumps([
                {"reference": "ECR-001", "description": "Absence de contrôle centrifugation selon SOP", "gravite": "majeure"},
            ]),
        )
        session.add(audit1)
        await session.commit()
        print("[OK] 1 audit created")

        # ------------------------------------------------------------------ #
        # 6. KPI                                                              #
        # ------------------------------------------------------------------ #
        kpi_defs = [
            ("TNC",    "Taux de non-conformités ouvertes",          5.0,   "NC",      "mensuelle"),
            ("TDRNFS", "Taux délai rendu NFS < 2h",                 95.0,  "%",       "mensuelle"),
            ("TCOAG",  "Taux de conformité coagulation",            98.0,  "%",       "mensuelle"),
            ("STAB",   "Stabilité thermique réfrigérateurs",        2.0,   "écarts",  "mensuelle"),
            ("FORM",   "Taux de formation du personnel",            100.0, "%",       "trimestrielle"),
        ]

        kpi_objects = {}
        for code, nom, cible, unite, periodicite in kpi_defs:
            ind = IndicateurQualite(
                code=code,
                nom=nom,
                cible=cible,
                unite=unite,
                periodicite=periodicite,
            )
            session.add(ind)
            await session.flush()
            kpi_objects[code] = ind

        await session.commit()
        for ind in kpi_objects.values():
            await session.refresh(ind)

        periodes = [
            (datetime.utcnow() - timedelta(days=60)).strftime("%Y-%m"),
            (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m"),
            datetime.utcnow().strftime("%Y-%m"),
        ]
        mesures_values = {
            "TNC":    [3.0, 4.0, 2.0],
            "TDRNFS": [97.2, 95.8, 96.5],
            "TCOAG":  [99.1, 98.7, 98.3],
            "STAB":   [1.0, 3.0, 2.0],
            "FORM":   [85.0, 90.0, 92.0],
        }

        for code, values in mesures_values.items():
            for i, periode in enumerate(periodes):
                m = MesureKPI(
                    indicateur_id=kpi_objects[code].id,
                    valeur=values[i],
                    periode=periode,
                    saisie_par_id=users["qualiticien"].id,
                    commentaire=f"Saisie mensuelle {periode}",
                )
                session.add(m)

        await session.commit()
        print("[OK] 5 KPI + 15 measures created")

        # ------------------------------------------------------------------ #
        # 7. EQUIPMENT                                                        #
        # ------------------------------------------------------------------ #
        equip_data = [
            Equipement(
                nom="Automate hématologie XN-3000",
                categorie="analyseur",
                numero_inventaire="EQ-HEMA-001",
                fabricant="Sysmex",
                numero_serie="XN3K-20190456",
                localisation="Salle hématologie",
                statut=EquipmentStatus.OPERATIONNEL,
                prochaine_calibration=date.today() + timedelta(days=150),
                responsable_id=users["resp_tech"].id,
            ),
            Equipement(
                nom="Centrifugeuse Eppendorf 5810R",
                categorie="centrifugeuse",
                numero_inventaire="EQ-CENT-002",
                fabricant="Eppendorf",
                numero_serie="5810R-20210089",
                localisation="Paillasse préanalyse",
                statut=EquipmentStatus.OPERATIONNEL,
                prochaine_calibration=date.today() + timedelta(days=120),
                responsable_id=users["resp_tech"].id,
            ),
            Equipement(
                nom="Réfrigérateur réactifs Bio+4",
                categorie="stockage",
                numero_inventaire="EQ-REFR-003",
                fabricant="Liebherr",
                numero_serie="LB-20180234",
                localisation="Stockage réactifs",
                statut=EquipmentStatus.CALIBRATION_ECHUEE,
                prochaine_calibration=date.today() - timedelta(days=35),
                responsable_id=users["resp_tech"].id,
            ),
        ]

        for eq in equip_data:
            session.add(eq)

        await session.commit()
        for eq in equip_data:
            await session.refresh(eq)

        cal1 = Calibration(
            equipement_id=equip_data[0].id,
            date_calibration=date.today() - timedelta(days=30),
            date_prochaine=date.today() + timedelta(days=150),
            resultat="conforme",
            realise_par="LNE - Laboratoire National de Métrologie",
            user_id=users["resp_tech"].id,
        )
        cal2 = Calibration(
            equipement_id=equip_data[1].id,
            date_calibration=date.today() - timedelta(days=60),
            date_prochaine=date.today() + timedelta(days=120),
            resultat="conforme",
            realise_par="Interne",
            user_id=users["resp_tech"].id,
        )
        session.add(cal1)
        session.add(cal2)
        await session.commit()
        print(f"[OK] 3 equipments + 2 calibrations created")

        # ------------------------------------------------------------------ #
        # 8. STOCK                                                            #
        # ------------------------------------------------------------------ #
        fourn1 = Fournisseur(
            nom="Sysmex Europe GmbH",
            code="SYSMEX-BE",
            contact="service.technique@sysmex.be",
            telephone="+32 2 345 67 89",
            adresse="Avenue du Port 86C, 1000 Bruxelles",
            statut_qualification="qualifie",
        )
        fourn2 = Fournisseur(
            nom="Beckman Coulter Belgium",
            code="BECKMAN-BE",
            contact="lab.supplies@beckman.be",
            telephone="+32 2 456 78 90",
            adresse="Rue de la Science 14, 1040 Etterbeek",
            statut_qualification="qualifie",
        )
        session.add(fourn1)
        session.add(fourn2)
        await session.commit()
        await session.refresh(fourn1)
        await session.refresh(fourn2)

        art1 = Article(
            reference="RG-NFS-001",
            designation="Réactif NFS XN-3000 (pack 500 tests)",
            categorie="reactif",
            unite="pack",
            stock_actuel=3,
            seuil_alerte=2,
            fournisseur_id=fourn1.id,
        )
        art2 = Article(
            reference="RG-COAG-002",
            designation="Réactif thromboplastine calcique (100 tests)",
            categorie="reactif",
            unite="flacon",
            stock_actuel=8,
            seuil_alerte=5,
            fournisseur_id=fourn2.id,
        )
        art3 = Article(
            reference="CONS-TUBE-003",
            designation="Tubes EDTA 4mL (boite 100)",
            categorie="consommable",
            unite="boite",
            stock_actuel=12,
            seuil_alerte=10,
            fournisseur_id=fourn1.id,
        )
        session.add(art1)
        session.add(art2)
        session.add(art3)
        await session.commit()
        await session.refresh(art1)
        await session.refresh(art2)
        await session.refresh(art3)

        cmd1 = Commande(
            numero_commande="CMD-2026-0042",
            fournisseur_id=fourn1.id,
            lignes=json.dumps([
                {"article_id": art1.id, "quantite": 5, "prix_unitaire": 420.00},
            ]),
            statut="livree",
            created_by_id=users["resp_tech"].id,
        )
        session.add(cmd1)
        await session.commit()
        await session.refresh(cmd1)

        lot1 = Lot(
            article_id=art1.id,
            numero_lot="SYM-2026-NFS-L4892",
            quantite_recue=5,
            quantite_restante=4,
            dlu=date.today() + timedelta(days=180),
            statut=LotStatus.ACCEPTE,
            commande_id=cmd1.id,
            reception_par_id=users["resp_tech"].id,
            notes="Réception conforme. Température transport OK.",
        )
        lot2 = Lot(
            article_id=art3.id,
            numero_lot="SYM-2026-TUBE-E2211",
            quantite_recue=20,
            quantite_restante=20,
            dlu=date.today() + timedelta(days=730),
            statut=LotStatus.QUARANTAINE,
            reception_par_id=users["technicien"].id,
            notes="En attente de contrôle qualité à réception.",
        )
        session.add(lot1)
        session.add(lot2)
        await session.commit()
        print("[OK] 2 fournisseurs, 3 articles, 1 commande, 2 lots created")

        # ------------------------------------------------------------------ #
        # 9. COMPLAINT                                                        #
        # ------------------------------------------------------------------ #
        plainte = Plainte(
            source="prescripteur",
            description="Le Dr Lecomte signale une valeur de potassium anormalement élevée (6.8 mmol/L) sur patient asymptomatique - suspicion d'hémolyse non détectée.",
            statut=ComplaintStatus.EN_COURS,
            declarant_id=users["biologiste"].id,
            responsable_id=users["qualiticien"].id,
        )
        session.add(plainte)
        await session.commit()
        print("[OK] 1 complaint created")

        # ------------------------------------------------------------------ #
        # 10. AUDIT LOG                                                       #
        # ------------------------------------------------------------------ #
        logs = [
            AuditLog(
                timestamp=datetime.utcnow() - timedelta(hours=48),
                user_id=users["admin"].id,
                action="CREATE",
                resource_type="user",
                resource_id=str(users["qualiticien"].id),
                details="Création compte sophie.renard@kalilab.be",
                ip_address="192.168.1.10",
            ),
            AuditLog(
                timestamp=datetime.utcnow() - timedelta(hours=24),
                user_id=users["qualiticien"].id,
                action="STATUS_CHANGE",
                resource_type="document",
                resource_id=str(created_docs[0].id),
                details=f"Document '{created_docs[0].titre}': brouillon -> publie",
                ip_address="192.168.1.25",
            ),
            AuditLog(
                timestamp=datetime.utcnow() - timedelta(hours=2),
                user_id=users["technicien"].id,
                action="CREATE",
                resource_type="non_conformite",
                resource_id=str(nc1.id),
                details="Déclaration NC: Tube hépariné sans bouchon",
                ip_address="192.168.1.42",
            ),
        ]
        for log_entry in logs:
            session.add(log_entry)
        await session.commit()
        print("[OK] 3 audit log entries created")

        # ------------------------------------------------------------------ #
        # ARBORESCENCE (Services & Localisations)                           #
        # ------------------------------------------------------------------ #
        from seed_arborescence import ARBORESCENCE
        from sqlalchemy import select as sa_select
        existing_svc = await session.execute(sa_select(Service))
        if existing_svc.scalars().first() is None:
            total_services = 0
            total_zones = 0
            for ordre, label, nom, site, zones in ARBORESCENCE:
                svc = Service(label=label, nom=nom, site=site, ordre=ordre)
                session.add(svc)
                await session.flush()
                total_services += 1
                for zone_idx, zone_def in enumerate(zones):
                    zone_nom, sous_zones = zone_def if isinstance(zone_def, tuple) else (zone_def, [])
                    z = Localisation(service_id=svc.id, nom=zone_nom, ordre=zone_idx)
                    session.add(z)
                    await session.flush()
                    total_zones += 1
                    for i, sz_nom in enumerate(sous_zones):
                        sz = Localisation(service_id=svc.id, parent_id=z.id, nom=sz_nom, ordre=i)
                        session.add(sz)
                        total_zones += 1
            await session.commit()
            print(f"[OK] Arborescence créée : {total_services} services, {total_zones} zones")
        else:
            print("[OK] Arborescence déjà présente — ignorée")

        # ------------------------------------------------------------------ #
        # 11. QUALIFICATIONS                                                  #
        # ------------------------------------------------------------------ #
        QUALIFICATIONS_STE = [
            "[E] - Accueil", "[E] - Anoxomat - niveau 3", "[E] - Antibiogramme - Niveau 1",
            "[E] - Antibiogramme - Niveau 3", "[E] - Auditeur interne : Niveau 3",
            "[E] - Balances - Niveau 1", "[E] - Banque de sang - Immuno-Hémato - Niveau 1",
            "[E] - Banque de sang - Immuno-Hémato - Niveau 3",
            "[E] - Biologie moléculaire (GeneXpert) - Niveau 1",
            "[E] - Biologie moléculaire (GeneXpert) - Niveau 3",
            "[E] - Biologie moléculaire (Qiastat) - Niveau 3",
            "[E] - Biologie moléculaire (Seegene) - niveau 2",
            "[E] - Biologie moléculaire (Seegene) - niveau 3",
            "[E] - Biologie moléculaire (magLEAD / CFX96) - Niveau 3",
            "[E] - Biologiste de garde : niveau 3",
            "[E] - Capillarys 3 Octa + Hydrasis 2 Scan+ Assist: niveau 3",
            "[E] - Centrifugeuses / Cytocentrifugeuses Niveau 1",
            "[E] - Coagulation (CN tests spéciaux) - Niveau 3",
            "[E] - Coagulation (CN) - Niveau 1", "[E] - Coagulation (CN) - Niveau 2",
            "[E] - Cobas CE Niveau 1", "[E] - Cobas CE Niveau 2",
            "[E] - Flux laminaires Niveau 1", "[E] - Flux laminaires Niveau 3",
            "[E] - Formule microscopique - Niveau 3", "[E] - Hotte chimique - Niveau 3",
            "[E] - Hématologie manuelle - Niveau 1", "[E] - Hématologie manuelle - Niveau 3",
            "[E] - Immunophénotypage - Cytométrie en flux", "[E] - Informatique - Niveau 3",
            "[E] - Liaison XL", "[E] - Logistique - niveau 1", "[E] - Logistique - niveau 2",
            "[E] - Logistique - niveau 3", "[E] - Microbiologie - Pré-analytique - Niveau 1",
            "[E] - Microbiologie - Pré-analytique - Niveau 2",
            "[E] - Microbiologie - Pré-analytique - Niveau 3",
            "[E] - Micropipettes Niveau 1", "[E] - Micropipettes Niveau 2",
            "[E] - Microscopes Niveau 1", "[E] - Microscopie IFA niveau 2",
            "[E] - Nal Von Minden (C1 Reader) Niveau 1", "[E] - Nal Von Minden (C1 Reader) Niveau 2",
            "[E] - Optilite - Niveau 3", "[E] - Osmométrie Niveau 1", "[E] - Osmométrie Niveau 2",
            "[E] - POCT : Afinion2 CRP niveau 2", "[E] - POCT : Afinion2 CRP niveau 3",
            "[E] - POCT : GEM 5000 Niveau 1", "[E] - POCT : GEM 5000 Niveau 2",
            "[E] - POCT : GEM5000 Niveau 3", "[E] - POCT : Glucomètre Statstrip niveau 1",
            "[E] - POCT : Glucomètre Statstrip niveau 2", "[E] - POCT : Glucomètre Statstrip niveau 3",
            "[E] - Phadia250 Niveau 2", "[E] - Post-analytique - Niveau 1",
            "[E] - Post-analytique - Niveau 2", "[E] - Post-analytique - Niveau 3",
            "[E] - Prélèvements", "[E] - Qualité - Niveau 1", "[E] - Qualité - Niveau 2",
            "[E] - Qualité - Niveau 3", "[E] - RH - Niveau 1",
            "[E] - Réception et encodage - Niveau 1", "[E] - Réception et encodage - Niveau 3",
            "[E] - Selles - Niveau 3", "[E] - Sous-traitance - Niveau 1",
            "[E] - Sous-traitance - Niveau 3", "[E] - Spermiologie",
            "[E] - Testo / 174T - Niveau 1", "[E] - Testo / Enceintes thermiques - Niveau 1",
            "[E] - Testo / Enceintes thermiques - Niveau 3",
            "[E] - Traitement pré-analytique STE (niveau 1)",
            "[E] - Traitement pré-analytique STE (niveau 3)",
            "[E] - Urines - Niveau 1", "[E] - Urines - Niveau 2", "[E] - Urines - Niveau 3",
            "[E] - Vidas", "[E] - XN - Niveau 1", "[E] - XN - Niveau 3",
        ]
        QUALIFICATIONS_STM = [
            "[M] - Accueil", "[M] - Auditeur interne : Niveau 3", "[M] - Balances - Niveau 1",
            "[M] - Banque de sang - Immuno-Hémato - Niveau 1",
            "[M] - Banque de sang - Immuno-Hémato - Niveau 3",
            "[M] - Biologie moléculaire (GeneXpert) - Niveau 1",
            "[M] - Biologie moléculaire (GeneXpert) - Niveau 3",
            "[M] - Biologiste de garde : niveau 3",
            "[M] - Centrifugeuses / Cytocentrifugeuses Niveau 1",
            "[M] - Coagulation (CN) - Niveau 1", "[M] - Coagulation (CN) - Niveau 2",
            "[M] - Flux laminaires Niveau 1", "[M] - Formule microscopique - Niveau 3",
            "[M] - Hématologie manuelle - Niveau 1", "[M] - Hématologie manuelle - Niveau 3",
            "[M] - Informatique - Niveau 3", "[M] - Logistique - niveau 1",
            "[M] - Logistique - niveau 2", "[M] - Logistique - niveau 3",
            "[M] - Microbiologie - Pré-analytique - Niveau 1",
            "[M] - Micropipettes Niveau 1", "[M] - Micropipettes Niveau 2",
            "[M] - Microscopes Niveau 1", "[M] - Microscopie IFA niveau 2",
            "[M] - Nal Von Minden (C1 Reader) Niveau 1", "[M] - Nal Von Minden (C1 Reader) Niveau 2",
            "[M] - Osmométrie Niveau 1", "[M] - Osmométrie Niveau 2",
            "[M] - POCT : Afinion2 CRP niveau 2", "[M] - POCT : Afinion2 CRP niveau 3",
            "[M] - POCT : GEM 5000 Niveau 1", "[M] - POCT : GEM 5000 Niveau 2",
            "[M] - POCT : GEM5000 Niveau 3", "[M] - POCT : Glucomètre Statstrip niveau 1",
            "[M] - POCT : Glucomètre Statstrip niveau 2", "[M] - POCT : Glucomètre Statstrip niveau 3",
            "[M] - Phadia250 Niveau 2", "[M] - Post-analytique - Niveau 1",
            "[M] - Post-analytique - Niveau 2", "[M] - Post-analytique - Niveau 3",
            "[M] - Prélèvements", "[M] - Qualité - Niveau 1", "[M] - Qualité - Niveau 2",
            "[M] - Qualité - Niveau 3", "[M] - RH - Niveau 1",
            "[M] - Réception et encodage - Niveau 1", "[M] - Réception et encodage - Niveau 3",
            "[M] - Sous-traitance - Niveau 1", "[M] - Sous-traitance - Niveau 3",
            "[M] - Sprinter Niveau 2", "[M] - Testo / 174T - Niveau 1",
            "[M] - Testo / Enceintes thermiques - Niveau 1",
            "[M] - Testo / Enceintes thermiques - Niveau 3",
            "[M] - Traitement pré-analytique STM (niveau 1)",
            "[M] - Traitement pré-analytique STM (niveau 3)",
            "[M] - Urines - Niveau 1", "[M] - Urines - Niveau 2", "[M] - Urines - Niveau 3",
            "[M] - XN - Niveau 1", "[M] - XN - Niveau 3",
        ]
        from sqlalchemy import select as sa_select_q
        existing_q = await session.execute(sa_select_q(Qualification.libelle))
        existing_quals = {row[0] for row in existing_q.all()}
        qual_count = 0
        for libelle in QUALIFICATIONS_STE:
            if libelle not in existing_quals:
                session.add(Qualification(libelle=libelle, sites=json.dumps(["STE"])))
                qual_count += 1
        for libelle in QUALIFICATIONS_STM:
            if libelle not in existing_quals:
                session.add(Qualification(libelle=libelle, sites=json.dumps(["STM"])))
                qual_count += 1
        await session.commit()
        print(f"[OK] {qual_count} qualifications created")

        print("\n=== SEED COMPLETE ===")
        for key, (prenom, nom, email, pwd, role) in zip(keys, user_data):
            print(f"  {role.value:25s}  {email:35s}  {pwd}")


if __name__ == "__main__":
    asyncio.run(seed())
