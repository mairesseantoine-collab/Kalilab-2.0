from sqlmodel import SQLModel, Field, Column
from sqlalchemy import Text
from typing import Optional
from datetime import datetime, date
from enum import Enum
import uuid


class UserRole(str, Enum):
    ADMIN = "admin"
    QUALITICIEN = "qualiticien"
    RESP_TECHNIQUE = "responsable_technique"
    BIOLOGISTE = "biologiste"
    TECHNICIEN = "technicien"


class DocumentStatus(str, Enum):
    BROUILLON = "brouillon"
    RELECTURE = "relecture"
    APPROBATION = "approbation"
    PUBLIE = "publie"
    DIFFUSION = "diffusion"
    ARCHIVE = "archive"


class RiskLevel(str, Enum):
    FAIBLE = "faible"
    MODERE = "modere"
    ELEVE = "eleve"
    CRITIQUE = "critique"


class NCStatus(str, Enum):
    OUVERTE = "ouverte"
    EN_ANALYSE = "en_analyse"
    CAPA_EN_COURS = "capa_en_cours"
    VERIFICATION = "verification"
    CLOTUREE = "cloturee"


class AuditType(str, Enum):
    INTERNE = "interne"
    EXTERNE = "externe"
    FOURNISSEUR = "fournisseur"


class EquipmentStatus(str, Enum):
    OPERATIONNEL = "operationnel"
    EN_MAINTENANCE = "en_maintenance"
    HORS_SERVICE = "hors_service"
    CALIBRATION_ECHUEE = "calibration_echuee"


class ComplaintStatus(str, Enum):
    OUVERTE = "ouverte"
    EN_COURS = "en_cours"
    CLOTUREE = "cloturee"


class LotStatus(str, Enum):
    QUARANTAINE = "quarantaine"
    ACCEPTE = "accepte"
    REFUSE = "refuse"
    CONSOMME = "consomme"


class User(SQLModel, table=True):
    __tablename__ = "users"
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True)
    nom: str
    prenom: str
    email: str = Field(unique=True, index=True)
    hashed_password: str
    role: UserRole = Field(default=UserRole.TECHNICIEN)
    is_active: bool = Field(default=True)
    signature_hash: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_logs"
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    action: str = Field(index=True)
    resource_type: str = Field(index=True)
    resource_id: Optional[str] = None
    details: Optional[str] = Field(default=None, sa_column=Column(Text))
    ip_address: Optional[str] = None


# ── Arborescence documentaire (doit être avant DocumentQualite pour les FK) ───

class Service(SQLModel, table=True):
    """Service analytique ou support du laboratoire (PREL, HEM, MICRO…)."""
    __tablename__ = "services"
    id: Optional[int] = Field(default=None, primary_key=True)
    label: str = Field(max_length=20, index=True)
    nom: str = Field(max_length=200)
    site: str = Field(default="both", index=True)
    ordre: int = Field(default=0, index=True)
    actif: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Localisation(SQLModel, table=True):
    """Zone/localisation rattachée à un service, avec hiérarchie optionnelle."""
    __tablename__ = "localisations"
    id: Optional[int] = Field(default=None, primary_key=True)
    service_id: int = Field(foreign_key="services.id", index=True)
    parent_id: Optional[int] = Field(default=None, foreign_key="localisations.id", index=True)
    nom: str = Field(max_length=200)
    ordre: int = Field(default=0)
    actif: bool = Field(default=True, index=True)


class DocumentQualite(SQLModel, table=True):
    __tablename__ = "documents_qualite"
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True)
    titre: str = Field(index=True)
    # e-Document Control
    type_document: Optional[str] = Field(default=None, index=True)    # SOP, mode_operatoire…
    numero_document: Optional[str] = Field(default=None, index=True)  # ex: QP-PREL-001
    periodicite_revision: Optional[int] = None                         # tous les N mois
    theme: Optional[str] = Field(default=None, index=True)
    classification: Optional[str] = None
    service_id: Optional[int] = Field(default=None, foreign_key="services.id", index=True)
    localisation_id: Optional[int] = Field(default=None, foreign_key="localisations.id", index=True)
    statut: DocumentStatus = Field(default=DocumentStatus.BROUILLON, index=True)
    version: str = Field(default="1.0")
    fichier_path: Optional[str] = None
    auteur_id: int = Field(foreign_key="users.id", index=True)
    approbateurs: Optional[str] = Field(default=None, sa_column=Column(Text))
    lecteurs_autorises: Optional[str] = Field(default=None, sa_column=Column(Text))
    date_validite: Optional[date] = None
    historique_versions: Optional[str] = Field(default=None, sa_column=Column(Text))
    liens_processus: Optional[str] = Field(default=None, sa_column=Column(Text))
    contenu: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class LectureDocument(SQLModel, table=True):
    """Accusé de réception / traçabilité de lecture (e-Document Control ISO 15189)."""
    __tablename__ = "lectures_documents"
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="documents_qualite.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    version_lue: str = Field(default="1.0")
    lu_at: datetime = Field(default_factory=datetime.utcnow, index=True)
    commentaire: Optional[str] = None


class Signature(SQLModel, table=True):
    __tablename__ = "signatures"
    id: Optional[int] = Field(default=None, primary_key=True)
    document_id: int = Field(foreign_key="documents_qualite.id", index=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    role_signature: str
    signature_hash: str
    signed_at: datetime = Field(default_factory=datetime.utcnow)
    commentaire: Optional[str] = None


class Processus(SQLModel, table=True):
    __tablename__ = "processus"
    id: Optional[int] = Field(default=None, primary_key=True)
    nom: str
    phase: str
    owner_id: int = Field(foreign_key="users.id", index=True)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    sop_document_id: Optional[int] = Field(default=None, foreign_key="documents_qualite.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Risque(SQLModel, table=True):
    __tablename__ = "risques"
    id: Optional[int] = Field(default=None, primary_key=True)
    processus_id: Optional[int] = Field(default=None, foreign_key="processus.id", index=True)
    description: str = Field(sa_column=Column(Text))
    criticite: RiskLevel = Field(default=RiskLevel.MODERE, index=True)
    probabilite: int = Field(default=3)
    impact: int = Field(default=3)
    score_risque: int = Field(default=9, index=True)
    controles: Optional[str] = Field(default=None, sa_column=Column(Text))
    plan_action: Optional[str] = Field(default=None, sa_column=Column(Text))
    echeance: Optional[date] = None
    statut: str = Field(default="ouvert", index=True)
    responsable_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class NonConformite(SQLModel, table=True):
    __tablename__ = "non_conformites"
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True)
    # Identification
    type_nc: str = Field(index=True)
    nature: Optional[str] = None
    source_nc: Optional[str] = None
    processus_concerne: Optional[str] = None
    degre: Optional[str] = None
    document_sq: Optional[str] = None
    # Description
    description: str = Field(sa_column=Column(Text))
    impact: Optional[str] = Field(default=None, sa_column=Column(Text))
    pieces_jointes: Optional[str] = Field(default=None, sa_column=Column(Text))
    # Traitement immédiat
    traitement_immediat: Optional[str] = Field(default=None, sa_column=Column(Text))
    effectue_par_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    date_traitement: Optional[date] = None
    # Acceptation
    acceptation: Optional[bool] = Field(default=True)
    motivation_refus: Optional[str] = Field(default=None, sa_column=Column(Text))
    # Analyse
    analyse_causes: Optional[str] = Field(default=None, sa_column=Column(Text))
    analyse_etendue: Optional[str] = Field(default=None, sa_column=Column(Text))
    # CAPA
    capa: Optional[str] = Field(default=None, sa_column=Column(Text))
    action_corrective_secondaire: Optional[str] = Field(default=None, sa_column=Column(Text))
    action_preventive: Optional[str] = Field(default=None, sa_column=Column(Text))
    # Clôture
    verification_efficacite: Optional[str] = Field(default=None, sa_column=Column(Text))
    efficacite: Optional[str] = None
    reference_pag: Optional[str] = None
    # Workflow
    statut: NCStatus = Field(default=NCStatus.OUVERTE, index=True)
    declarant_id: int = Field(foreign_key="users.id", index=True)
    responsable_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    processus_id: Optional[int] = Field(default=None, foreign_key="processus.id", index=True)
    date_detection: datetime = Field(default_factory=datetime.utcnow)
    date_echeance: Optional[date] = None
    date_cloture: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Action(SQLModel, table=True):
    __tablename__ = "actions"
    id: Optional[int] = Field(default=None, primary_key=True)
    nc_id: Optional[int] = Field(default=None, foreign_key="non_conformites.id", index=True)
    risque_id: Optional[int] = Field(default=None, foreign_key="risques.id", index=True)
    audit_id: Optional[int] = Field(default=None, foreign_key="audits.id", index=True)
    type_action: str = Field(index=True)
    description: str = Field(sa_column=Column(Text))
    responsable_id: int = Field(foreign_key="users.id", index=True)
    echeance: date = Field(index=True)
    statut: str = Field(default="ouverte", index=True)
    resultat: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Audit(SQLModel, table=True):
    __tablename__ = "audits"
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True)
    type_audit: AuditType = Field(default=AuditType.INTERNE)
    referentiel: str
    titre: str
    date_planifiee: date = Field(index=True)
    date_realisation: Optional[date] = None
    auditeur_id: int = Field(foreign_key="users.id", index=True)
    auditeur_externe: Optional[str] = None
    constats: Optional[str] = Field(default=None, sa_column=Column(Text))
    ecarts: Optional[str] = Field(default=None, sa_column=Column(Text))
    statut: str = Field(default="planifie", index=True)
    rapport_path: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class IndicateurQualite(SQLModel, table=True):
    __tablename__ = "indicateurs_qualite"
    id: Optional[int] = Field(default=None, primary_key=True)
    nom: str = Field(index=True)
    code: str = Field(unique=True)
    formule: Optional[str] = None
    periodicite: str
    cible: Optional[float] = None
    unite: Optional[str] = None
    processus_id: Optional[int] = Field(default=None, foreign_key="processus.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class MesureKPI(SQLModel, table=True):
    __tablename__ = "mesures_kpi"
    id: Optional[int] = Field(default=None, primary_key=True)
    indicateur_id: int = Field(foreign_key="indicateurs_qualite.id", index=True)
    valeur: float
    periode: str = Field(index=True)
    date_mesure: datetime = Field(default_factory=datetime.utcnow, index=True)
    saisie_par_id: int = Field(foreign_key="users.id", index=True)
    commentaire: Optional[str] = None


class Equipement(SQLModel, table=True):
    __tablename__ = "equipements"
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True)
    nom: str
    categorie: str = Field(index=True)
    numero_inventaire: str = Field(unique=True)
    fabricant: Optional[str] = None
    modele: Optional[str] = None
    numero_serie: Optional[str] = None
    date_acquisition: Optional[date] = None
    statut: EquipmentStatus = Field(default=EquipmentStatus.OPERATIONNEL, index=True)
    localisation: Optional[str] = None
    responsable_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    prochaine_calibration: Optional[date] = Field(default=None, index=True)
    prochaine_maintenance: Optional[date] = None
    periodicite_calibration_jours: Optional[int] = None
    periodicite_maintenance_jours: Optional[int] = None
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Calibration(SQLModel, table=True):
    __tablename__ = "calibrations"
    id: Optional[int] = Field(default=None, primary_key=True)
    equipement_id: int = Field(foreign_key="equipements.id", index=True)
    date_calibration: date
    date_prochaine: Optional[date] = None
    realise_par: Optional[str] = None
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    resultat: str
    certificat_path: Optional[str] = None
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Maintenance(SQLModel, table=True):
    __tablename__ = "maintenances"
    id: Optional[int] = Field(default=None, primary_key=True)
    equipement_id: int = Field(foreign_key="equipements.id", index=True)
    type_maintenance: str
    date_planifiee: Optional[date] = None
    date_realisation: Optional[date] = None
    realise_par: Optional[str] = None
    user_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    statut: str = Field(default="planifiee", index=True)
    pieces_jointes: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Competence(SQLModel, table=True):
    __tablename__ = "competences"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    intitule: str
    niveau: int = Field(default=1)
    date_acquisition: Optional[date] = None
    date_validite: Optional[date] = None
    document_proof_id: Optional[int] = Field(default=None, foreign_key="documents_qualite.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Formation(SQLModel, table=True):
    __tablename__ = "formations"
    id: Optional[int] = Field(default=None, primary_key=True)
    titre: str
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    date_debut: date = Field(index=True)
    date_fin: Optional[date] = None
    formateur: Optional[str] = None
    statut: str = Field(default="planifiee", index=True)
    participants: Optional[str] = Field(default=None, sa_column=Column(Text))
    evaluations: Optional[str] = Field(default=None, sa_column=Column(Text))
    validite_mois: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class PlanningRH(SQLModel, table=True):
    __tablename__ = "planning_rh"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    type_evenement: str
    date_debut: date = Field(index=True)
    date_fin: Optional[date] = None
    motif: Optional[str] = None
    statut: str = Field(default="prevu")
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Qualification(SQLModel, table=True):
    __tablename__ = "qualifications"
    id: Optional[int] = Field(default=None, primary_key=True)
    libelle: str = Field(index=True)
    duree_heures: Optional[float] = None
    description: Optional[str] = Field(default=None, sa_column=Column(Text))
    reevaluation: bool = Field(default=False)
    validite_mois: Optional[int] = None                   # validity period in months (used when reevaluation=True)
    responsable_id: Optional[int] = Field(default=None, foreign_key="users.id")
    sites: Optional[str] = Field(default=None)            # JSON: ["STE","STM"]
    fonctions_concernees: Optional[str] = Field(default=None, sa_column=Column(Text))  # JSON list
    personnel_concerne: Optional[str] = Field(default=None, sa_column=Column(Text))    # JSON list of PersonnelRH IDs
    criteres_evaluation: Optional[str] = Field(default=None, sa_column=Column(Text))   # JSON: [{descriptif, obligatoire}]
    docs_admin: Optional[str] = Field(default=None, sa_column=Column(Text))   # JSON [doc_id,...]
    fichiers_admin: Optional[str] = Field(default=None, sa_column=Column(Text))        # JSON [path,...]
    docs_user: Optional[str] = Field(default=None, sa_column=Column(Text))
    fichiers_user: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class Fournisseur(SQLModel, table=True):
    __tablename__ = "fournisseurs"
    id: Optional[int] = Field(default=None, primary_key=True)
    nom: str
    code: str = Field(unique=True)
    contact: Optional[str] = None
    email: Optional[str] = None
    telephone: Optional[str] = None
    adresse: Optional[str] = Field(default=None, sa_column=Column(Text))
    statut_qualification: str = Field(default="qualifie", index=True)
    derniere_evaluation: Optional[date] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Article(SQLModel, table=True):
    __tablename__ = "articles"
    id: Optional[int] = Field(default=None, primary_key=True)
    reference: str = Field(unique=True)
    gs1_code: Optional[str] = None
    designation: str
    categorie: str = Field(index=True)
    unite: str
    seuil_alerte: float = Field(default=0)
    stock_actuel: float = Field(default=0)
    fournisseur_id: Optional[int] = Field(default=None, foreign_key="fournisseurs.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Commande(SQLModel, table=True):
    __tablename__ = "commandes"
    id: Optional[int] = Field(default=None, primary_key=True)
    numero_commande: str = Field(unique=True)
    fournisseur_id: int = Field(foreign_key="fournisseurs.id", index=True)
    statut: str = Field(default="brouillon", index=True)
    date_commande: Optional[date] = None
    date_livraison_prevue: Optional[date] = None
    date_reception: Optional[datetime] = None
    lignes: Optional[str] = Field(default=None, sa_column=Column(Text))
    nc_id: Optional[int] = Field(default=None, foreign_key="non_conformites.id", index=True)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))
    created_by_id: int = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Lot(SQLModel, table=True):
    __tablename__ = "lots"
    id: Optional[int] = Field(default=None, primary_key=True)
    article_id: int = Field(foreign_key="articles.id", index=True)
    numero_lot: str
    dlu: Optional[date] = Field(default=None, index=True)
    quantite_recue: float
    quantite_restante: float
    statut: LotStatus = Field(default=LotStatus.QUARANTAINE, index=True)
    certificat_path: Optional[str] = None
    essai_acceptation: Optional[str] = Field(default=None, sa_column=Column(Text))
    conformite: Optional[bool] = None
    date_reception: datetime = Field(default_factory=datetime.utcnow)
    reception_par_id: int = Field(foreign_key="users.id", index=True)
    commande_id: Optional[int] = Field(default=None, foreign_key="commandes.id", index=True)
    notes: Optional[str] = Field(default=None, sa_column=Column(Text))


class Plainte(SQLModel, table=True):
    __tablename__ = "plaintes"
    id: Optional[int] = Field(default=None, primary_key=True)
    uuid: str = Field(default_factory=lambda: str(uuid.uuid4()), unique=True)
    source: str
    description: str = Field(sa_column=Column(Text))
    pieces_jointes: Optional[str] = Field(default=None, sa_column=Column(Text))
    analyse: Optional[str] = Field(default=None, sa_column=Column(Text))
    statut: ComplaintStatus = Field(default=ComplaintStatus.OUVERTE, index=True)
    declarant_id: int = Field(foreign_key="users.id", index=True)
    responsable_id: Optional[int] = Field(default=None, foreign_key="users.id", index=True)
    nc_id: Optional[int] = Field(default=None, foreign_key="non_conformites.id", index=True)
    date_cloture: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DossierVerification(SQLModel, table=True):
    __tablename__ = "dossiers_verification"
    id: Optional[int] = Field(default=None, primary_key=True)
    titre: str
    methode: Optional[str] = None
    tests: Optional[str] = Field(default=None, sa_column=Column(Text))
    resultats: Optional[str] = Field(default=None, sa_column=Column(Text))
    conclusion: Optional[str] = Field(default=None, sa_column=Column(Text))
    statut: str = Field(default="en_cours", index=True)
    redacteur_id: int = Field(foreign_key="users.id", index=True)
    document_id: Optional[int] = Field(default=None, foreign_key="documents_qualite.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class ProcedureMammouth(SQLModel, table=True):
    __tablename__ = "procedures_mammouth"
    id: Optional[int] = Field(default=None, primary_key=True)
    titre: str
    sections: Optional[str] = Field(default=None, sa_column=Column(Text))
    contributeurs: Optional[str] = Field(default=None, sa_column=Column(Text))
    historique: Optional[str] = Field(default=None, sa_column=Column(Text))
    statut: str = Field(default="brouillon", index=True)
    document_id: Optional[int] = Field(default=None, foreign_key="documents_qualite.id", index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class PersonnelRH(SQLModel, table=True):
    """Registre du personnel du laboratoire (indépendant des comptes utilisateurs)."""
    __tablename__ = "personnel_rh"
    id: Optional[int] = Field(default=None, primary_key=True)
    nom: str = Field(index=True)
    prenom: str
    telephone: Optional[str] = None
    site: str = Field(default="STE", index=True)   # STE, STM, both
    fonction: str = Field(index=True)
    actif: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HabilitationPersonnel(SQLModel, table=True):
    """Enregistrement d'une habilitation individuelle (personnel × qualification)."""
    __tablename__ = "habilitations_personnel"
    id: Optional[int] = Field(default=None, primary_key=True)
    personnel_id: int = Field(foreign_key="personnel_rh.id", index=True)
    qualification_id: int = Field(foreign_key="qualifications.id", index=True)
    date_habilitation: date
    date_echeance: Optional[date] = None   # calculated from qualification.validite_mois
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Message(SQLModel, table=True):
    """Messagerie interne KaliLab — avec notification email Outlook."""
    __tablename__ = "messages"
    id: Optional[int] = Field(default=None, primary_key=True)
    expediteur_id: int = Field(foreign_key="users.id", index=True)
    destinataire_id: int = Field(foreign_key="users.id", index=True)
    sujet: str = Field(max_length=255)
    corps: str = Field(sa_column=Column(Text))
    # Fil de réponse (threading)
    parent_id: Optional[int] = Field(default=None, foreign_key="messages.id", index=True)
    # États
    lu: bool = Field(default=False, index=True)
    supprime_expediteur: bool = Field(default=False)
    supprime_destinataire: bool = Field(default=False)
    # Tracé email
    email_envoye: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)
