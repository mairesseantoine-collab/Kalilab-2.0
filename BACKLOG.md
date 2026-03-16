# KaliLab — Backlog produit

## Itération 1 — Auth, Documents, Audit Trail (MVP Core)
- [x] Authentification JWT avec refresh token
- [x] RBAC 5 rôles (Admin, Qualiticien, RT, Biologiste, Technicien)
- [x] CRUD documents qualité avec versioning
- [x] Workflow documentaire complet (7 statuts)
- [x] Signatures électroniques SHA256
- [x] Journal WORM append-only
- [x] Export piste d'audit CSV/JSON
- [ ] Lecteur PDF intégré (viewer)
- [ ] Diff visuel entre versions
- [ ] Notification email lors des transitions workflow

## Itération 2 — Qualité : NC, Risques, Audits, KPI
- [x] CRUD risques avec matrice 5x5
- [x] Déclaration et workflow NC complet
- [x] CRUD audits avec constats et écarts
- [x] KPI avec saisie mesures et graphiques
- [x] Génération PDF rapport audit
- [x] Génération PDF rapport NC
- [ ] Mise à jour automatique KPI via webhook NC
- [ ] Tableau de bord KPI temps réel (WebSocket)
- [ ] Import/export données depuis Excel

## Itération 3 — Matériel & Métrologie
- [x] CRUD équipements avec fiche signalétique
- [x] Historique calibrations et maintenances
- [x] Blocage automatique si calibration échue
- [x] Alertes dans le dashboard
- [ ] Rappels automatiques par email (J-30, J-7)
- [ ] QR code sur fiche équipement
- [ ] Intégration calendrier Outlook/Google

## Itération 4 — Ressources Humaines
- [x] Matrice compétences par poste
- [x] Gestion formations (planification, évaluations)
- [x] Planning RH (absences, congés, habilitations)
- [ ] Alertes habilitations expirant
- [ ] Module évaluation annuelle
- [ ] Organigramme interactif

## Itération 5 — Stock & Commandes GS1
- [x] CRUD articles avec code GS1
- [x] Réception GS1 avec création lot
- [x] Workflow quarantaine → essai → accepté/refusé
- [x] Alertes DLU (péremption)
- [x] Gestion fournisseurs et commandes
- [ ] Lecture barcode via caméra (Web API)
- [ ] Intégration EDI fournisseurs
- [ ] Gestion multi-entrepôts

## Itération 6 — Plaintes & Rédaction
- [x] Déclaration et suivi plaintes
- [x] Liaison plainte → NC
- [x] Dossiers de vérification méthode
- [x] Procédures mammouth structurées
- [ ] Editeur WYSIWYG avancé (TipTap)
- [ ] Collaboration temps réel (CRDT)
- [ ] Module statistiques plaintes (Pareto)

## Itération 7 — Production & Sécurité
- [ ] Keycloak / OpenID Connect
- [ ] Chiffrement au repos (pgcrypto)
- [ ] Audit trail blockchain (optionnel)
- [ ] Tests e2e (Playwright)
- [ ] CI/CD GitHub Actions complet
- [ ] Terraform pour déploiement cloud
- [ ] Multi-tenant (plusieurs laboratoires)
- [ ] OpenSearch + OCR pour recherche full-text
