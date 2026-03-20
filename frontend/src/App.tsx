import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
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
const HRAnnuairePage = lazy(() => import('./pages/hr/HRAnnuairePage'));
const StockPage = lazy(() => import('./pages/stock/StockPage'));
const ReceptionPage = lazy(() => import('./pages/stock/ReceptionPage'));
const LotDetailPage = lazy(() => import('./pages/stock/LotDetailPage'));
const ArticleDetailPage = lazy(() => import('./pages/stock/ArticleDetailPage'));
const ComplaintsPage = lazy(() => import('./pages/complaints/ComplaintsPage'));
const ComplaintDetailPage = lazy(() => import('./pages/complaints/ComplaintDetailPage'));
const ComplaintFormPage = lazy(() => import('./pages/complaints/ComplaintFormPage'));
const RedactionPage = lazy(() => import('./pages/redaction/RedactionPage'));
const AuditTrailPage = lazy(() => import('./pages/audit_trail/AuditTrailPage'));
const MessagingPage = lazy(() => import('./pages/messagerie/MessagingPage'));
const ServicesPage = lazy(() => import('./pages/services/ServicesPage'));
const PAGPage = lazy(() => import('./pages/pag/PAGPage'));

const LoadingFallback = () => (
  <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
    <CircularProgress />
  </Box>
);

// Wraps a page in its own ErrorBoundary so a crash in one page doesn't kill the app
const withErrorBoundary = (element: React.ReactNode) => (
  <ErrorBoundary>{element}</ErrorBoundary>
);

const App: React.FC = () => {
  return (
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
          <Route path="dashboard" element={withErrorBoundary(<DashboardPage />)} />
          <Route path="documents" element={withErrorBoundary(<DocumentsPage />)} />
          <Route path="documents/new" element={withErrorBoundary(<DocumentFormPage />)} />
          <Route path="documents/:id" element={withErrorBoundary(<DocumentDetailPage />)} />
          <Route path="documents/:id/edit" element={withErrorBoundary(<DocumentFormPage />)} />
          <Route path="risks" element={withErrorBoundary(<RisksPage />)} />
          <Route path="risks/new" element={withErrorBoundary(<RiskFormPage />)} />
          <Route path="risks/:id" element={withErrorBoundary(<RiskFormPage />)} />
          <Route path="nonconformities" element={withErrorBoundary(<NonConformitiesPage />)} />
          <Route path="nonconformities/new" element={withErrorBoundary(<NCFormPage />)} />
          <Route path="nonconformities/:id" element={withErrorBoundary(<NCDetailPage />)} />
          <Route path="audits" element={withErrorBoundary(<AuditsPage />)} />
          <Route path="audits/new" element={withErrorBoundary(<AuditFormPage />)} />
          <Route path="audits/:id" element={withErrorBoundary(<AuditDetailPage />)} />
          <Route path="kpi" element={withErrorBoundary(<KPIPage />)} />
          <Route path="equipment" element={withErrorBoundary(<EquipmentPage />)} />
          <Route path="equipment/new" element={withErrorBoundary(<EquipmentFormPage />)} />
          <Route path="equipment/:id" element={withErrorBoundary(<EquipmentDetailPage />)} />
          <Route path="hr" element={withErrorBoundary(<HRPage />)} />
          <Route path="hr/annuaire" element={withErrorBoundary(<HRAnnuairePage />)} />
          <Route path="stock" element={withErrorBoundary(<StockPage />)} />
          <Route path="stock/reception" element={withErrorBoundary(<ReceptionPage />)} />
          <Route path="stock/lots/:id" element={withErrorBoundary(<LotDetailPage />)} />
          <Route path="stock/articles/:id" element={withErrorBoundary(<ArticleDetailPage />)} />
          <Route path="complaints" element={withErrorBoundary(<ComplaintsPage />)} />
          <Route path="complaints/new" element={withErrorBoundary(<ComplaintFormPage />)} />
          <Route path="complaints/:id" element={withErrorBoundary(<ComplaintDetailPage />)} />
          <Route path="redaction" element={withErrorBoundary(<RedactionPage />)} />
          <Route path="audit-trail" element={withErrorBoundary(<AuditTrailPage />)} />
          <Route path="messagerie" element={withErrorBoundary(<MessagingPage />)} />
          <Route path="services" element={withErrorBoundary(<ServicesPage />)} />
          <Route path="pag" element={withErrorBoundary(<PAGPage />)} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

export default App;
