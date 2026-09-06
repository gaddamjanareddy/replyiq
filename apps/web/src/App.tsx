import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { BusinessSettingsPage } from './pages/BusinessSettingsPage';
import { DomainsPage } from './pages/DomainsPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { WidgetPage } from './pages/WidgetPage';
import { LandingPage } from './pages/LandingPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/dashboard/settings" element={<BusinessSettingsPage />} />
          <Route path="/dashboard/domains" element={<DomainsPage />} />
          <Route path="/dashboard/knowledge" element={<KnowledgePage />} />
          <Route path="/dashboard/widget" element={<WidgetPage />} />
        </Route>
      </Route>

      {/* The front page is public. It used to redirect straight to the
          dashboard, which meant the product had no front door at all - anyone
          sent a link landed on a sign-in form with nothing to look at. */}
      <Route path="/" element={<LandingPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
