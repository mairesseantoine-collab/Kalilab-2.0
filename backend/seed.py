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
)
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://kalilab:kalilab@localhost:5432/kalilab")

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

        print("\n=== SEED COMPLETE ===")
        for key, (prenom, nom, email, pwd, role) in zip(keys, user_data):
            print(f"  {role.value:25s}  {email:35s}  {pwd}")


if __name__ == "__main__":
    asyncio.run(seed())
