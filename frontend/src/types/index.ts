export type UserRole = 'admin' | 'qualiticien' | 'responsable_technique' | 'biologiste' | 'technicien'
export type DocumentStatus = 'brouillon' | 'relecture' | 'approbation' | 'publie' | 'diffusion' | 'archive'
export type NCStatus = 'ouverte' | 'en_analyse' | 'capa_en_cours' | 'verification' | 'cloturee'
export type RiskLevel = 'faible' | 'modere' | 'eleve' | 'critique'
export type EquipmentStatus = 'operationnel' | 'en_maintenance' | 'hors_service' | 'calibration_echuee'
export type LotStatus = 'quarantaine' | 'accepte' | 'refuse' | 'consomme'
export type ComplaintStatus = 'ouverte' | 'en_cours' | 'cloturee'
export type AuditType = 'interne' | 'externe' | 'fournisseur'

export interface User {
  id: number
  uuid: string
  nom: string
  prenom: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface DocumentQualite {
  id: number
  uuid: string
  titre: string
  theme?: string
  classification?: string
  statut: DocumentStatus
  version: string
  auteur_id: number
  date_validite?: string
  contenu?: string
  created_at: string
  updated_at: string
}

export interface Risque {
  id: number
  description: string
  criticite: RiskLevel
  probabilite: number
  impact: number
  score_risque: number
  statut: string
  echeance?: string
  responsable_id?: number
  processus_id?: number
  created_at: string
}

export interface NonConformite {
  id: number
  uuid: string
  type_nc: string
  nature?: string
  source_nc?: string
  processus_concerne?: string
  degre?: string
  document_sq?: string
  description: string
  impact?: string
  traitement_immediat?: string
  effectue_par_id?: number
  date_traitement?: string
  acceptation?: boolean
  motivation_refus?: string
  analyse_causes?: string
  analyse_etendue?: string
  capa?: string
  action_corrective_secondaire?: string
  action_preventive?: string
  verification_efficacite?: string
  efficacite?: string
  reference_pag?: string
  statut: NCStatus
  declarant_id: number
  responsable_id?: number
  processus_id?: number
  date_detection: string
  date_echeance?: string
  date_cloture?: string
  created_at: string
  updated_at?: string
}

export interface Action {
  id: number
  type_action: string
  description: string
  responsable_id: number
  echeance: string
  statut: string
  resultat?: string
  nc_id?: number
  risque_id?: number
  audit_id?: number
  created_at: string
}

export interface Audit {
  id: number
  uuid: string
  type_audit: AuditType
  referentiel: string
  titre: string
  date_planifiee: string
  date_realisation?: string
  auditeur_id: number
  statut: string
  constats?: string
  ecarts?: string
  rapport_path?: string
  created_at: string
}

export interface IndicateurQualite {
  id: number
  nom: string
  code: string
  formule?: string
  periodicite: string
  cible?: number
  unite?: string
  processus_id?: number
}

export interface MesureKPI {
  id: number
  indicateur_id: number
  valeur: number
  periode: string
  date_mesure: string
  commentaire?: string
}

export interface Equipement {
  id: number
  uuid: string
  nom: string
  categorie: string
  numero_inventaire: string
  fabricant?: string
  modele?: string
  numero_serie?: string
  statut: EquipmentStatus
  localisation?: string
  prochaine_calibration?: string
  prochaine_maintenance?: string
  periodicite_calibration_jours?: number
  created_at: string
}

export interface Calibration {
  id: number
  equipement_id: number
  date_calibration: string
  date_prochaine?: string
  realise_par?: string
  resultat: string
  certificat_path?: string
  notes?: string
}

export interface Maintenance {
  id: number
  equipement_id: number
  type_maintenance: string
  date_planifiee?: string
  date_realisation?: string
  realise_par?: string
  description?: string
  statut: string
}

export interface Lot {
  id: number
  article_id: number
  numero_lot: string
  dlu?: string
  quantite_recue: number
  quantite_restante: number
  statut: LotStatus
  certificat_path?: string
  conformite?: boolean
  date_reception: string
}

export interface Article {
  id: number
  reference: string
  gs1_code?: string
  designation: string
  categorie: string
  unite: string
  seuil_alerte: number
  stock_actuel: number
}

export interface Fournisseur {
  id: number
  nom: string
  code: string
  contact?: string
  email?: string
  statut_qualification: string
  derniere_evaluation?: string
}

export interface Commande {
  id: number
  numero_commande: string
  fournisseur_id: number
  statut: string
  date_commande?: string
  date_livraison_prevue?: string
  created_at: string
}

export interface Plainte {
  id: number
  uuid: string
  source: string
  description: string
  statut: ComplaintStatus
  declarant_id: number
  analyse?: string
  created_at: string
  updated_at: string
}

export interface Competence {
  id: number
  user_id: number
  intitule: string
  niveau: number
  date_acquisition?: string
  date_validite?: string
}

export interface Formation {
  id: number
  titre: string
  description?: string
  date_debut: string
  date_fin?: string
  formateur?: string
  statut: string
  participants?: string
  validite_mois?: number
}

export interface PlanningRH {
  id: number
  user_id: number
  type_evenement: string
  date_debut: string
  date_fin?: string
  motif?: string
  statut: string
}

export interface AuditLog {
  id: number
  timestamp: string
  user_id?: number
  action: string
  resource_type: string
  resource_id?: string
  details?: string
  ip_address?: string
}

export interface MessageUser {
  id: number
  nom: string
  prenom: string
  email: string
  initiales: string
}

export interface Message {
  id: number
  sujet: string
  corps: string
  parent_id?: number | null
  lu: boolean
  email_envoye: boolean
  created_at: string
  expediteur: MessageUser
  destinataire: MessageUser
  replies?: Message[]
}

export interface DashboardData {
  open_nc: number
  overdue_equipment: number
  pending_docs: number
  active_audits: number
  expiring_lots: number
  open_complaints: number
  nc_by_month: Array<{ month: string; count: number }>
  nc_by_type: Array<{ type: string; count: number }>
  overdue_equipment_list: Equipement[]
  docs_to_review: DocumentQualite[]
  ongoing_actions: Action[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  size: number
  pages: number
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user_id: number
  role: string
  nom: string
  prenom: string
}
