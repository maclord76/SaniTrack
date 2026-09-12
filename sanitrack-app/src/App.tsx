import { HashRouter, Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppLayout } from '@/components/layout/AppLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { BloodAnalysisPage } from '@/pages/BloodAnalysisPage';
import { PhysicalActivityPage } from '@/pages/PhysicalActivityPage';
import { WeightBMIPage } from '@/pages/WeightBMIPage';
import { SleepPage } from '@/pages/SleepPage';
import { BloodPressurePage } from '@/pages/BloodPressurePage';
import { NutritionPage } from '@/pages/NutritionPage';
import PollensPage from '@/pages/PollensPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ImportPage } from '@/pages/ImportPage';
import { ExportPage } from '@/pages/ExportPage';

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="blood-analysis" element={<BloodAnalysisPage />} />
            <Route path="physical-activity" element={<PhysicalActivityPage />} />
            <Route path="weight-bmi" element={<WeightBMIPage />} />
            <Route path="sleep" element={<SleepPage />} />
            <Route path="blood-pressure" element={<BloodPressurePage />} />
            <Route path="nutrition" element={<NutritionPage />} />
            <Route path="pollens" element={<PollensPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="export" element={<ExportPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}

export { App };
