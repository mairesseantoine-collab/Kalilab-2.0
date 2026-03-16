import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/common/ErrorBoundary';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DocumentsPage = lazy(() => import('./pages/documents/DocumentsPage'));
const DocumentDetailPage = lazy(() => import('./pages/documents/DocumentDetailPage'));
const DocumentFormPage = lazy(() => import('./pages/documents/DocumentFormPage'));
const RisksPage = lazy(() => import('./pages/risks/RisksPage'));
const RiskFormPage = lazy(() => import('./pages/risks/RiskFormPage'));
const NonConformitiesPage = lazy(() => import('./pages/nonconformities/NonConformitiesPage'));
const NCDetailPage = lazy(() => import('./pages/nonconformities/NCDetailPage'));
const NCFormPage = lazy(() => import('./pages/nonconformities/NCFormPage'));
const AuditsPage = lazy(() => import('./pages/audits/AuditsPage'));
const AuditDetailPage = lazy(() => import('./pages/audits/AuditDetailPage'));
const AuditFormPage = lazy(() => import('./pages/audits/AuditFormPage'));
const KPIPage = lazy(() => import('./pages/kpi/KPIPage'));
const EquipmentPage = lazy(() => import('./pages/equipment/EquipmentPage'));
const EquipmentDetailPage = lazy(() => import('./pages/equipment/EquipmentDetailPage'));
const EquipmentFormPage = lazy(() => import('./pages/equipment/EquipmentFormPage'));
const HRPage = lazy(() => import('./pages/hr/HRPage'));
const StockPage = lazy(() => import('./pages/stock/StockPage'));
const ReceptionPage = lazy(() => import('./pages/stock/ReceptionPage'));
const ComplaintsPage = lazy(() => import('./pages/complaints/ComplaintsPage'));
const ComplaintDetailPage = lazy(() => import('./pages/complaints/ComplaintDetailPage'));
const ComplaintFormPage = lazy(() => import('./pages/complaints/ComplaintFormPage'));
const RedactionPage = lazy(() => import('./pages/redaction/RedactionPage'));
const AuditTrailPage = lazy(() => import('./pages/audit_trail/AuditTrailPage'));
const MessagingPage = lazy(() => import('./pages/messagerie/MessagingPage'));
const ServicesPage = lazy(() => import('./pages/services/ServicesPage'));

const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
    <CircularProgress />
  </Box>
);

const App: React.FC = () => {
  return (
    <ErrorBoundary>
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/new" element={<DocumentFormPage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="documents/:id/edit" element={<DocumentFormPage />} />
          <Route path="risks" element={<RisksPage />} />
          <Route path="risks/new" element={<RiskFormPage />} />
          <Route path="risks/:id" element={<RiskFormPage />} />
          <Route path="nonconformities" element={<NonConformitiesPage />} />
          <Route path="nonconformities/new" element={<NCFormPage />} />
          <Route path="nonconformities/:id" element={<NCDetailPage />} />
          <Route path="audits" element={<AuditsPage />} />
          <Route path="audits/new" element={<AuditFormPage />} />
          <Route path="audits/:id" element={<AuditDetailPage />} />
          <Route path="kpi" element={<KPIPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="equipment/new" element={<EquipmentFormPage />} />
          <Route path="equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="hr" element={<HRPage />} />
          <Route path="stock" element={<StockPage />} />
          <Route path="stock/reception" element={<ReceptionPage />} />
          <Route path="complaints" element={<ComplaintsPage />} />
          <Route path="complaints/new" element={<ComplaintFormPage />} />
          <Route path="complaints/:id" element={<ComplaintDetailPage />} />
          <Route path="redaction" element={<RedactionPage />} />
          <Route path="audit-trail" element={<AuditTrailPage />} />
          <Route path="messagerie" element={<MessagingPage />} />
          <Route path="services" element={<ServicesPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
    </ErrorBoundary>
  );
};

export default App;
