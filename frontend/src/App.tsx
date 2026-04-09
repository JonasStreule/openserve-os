import { Navigate, Route, Routes } from 'react-router-dom';
import { GuestUI } from './components/GuestUI';
import { KitchenDisplay } from './components/KitchenDisplay';
import { ServiceUI } from './components/ServiceUI';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginPage } from './components/LoginPage';
import { DemoPage } from './components/DemoPage';
import { FloorPlan } from './components/FloorPlan';
import { BarDisplay } from './components/BarDisplay';
import { GrillDisplay } from './components/GrillDisplay';
import { RunnerDisplay } from './components/RunnerDisplay';
import { TaskPool } from './components/TaskPool';
import { KioskLock } from './components/KioskLock';
import { LandingPage } from './components/LandingPage';
import { ToastContainer } from './components/Toast';

function getUser(): { role: string } | null {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function PrivateRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const user = getUser();
  if (!user || !localStorage.getItem('token')) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <>
    <ToastContainer />
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/demo" element={<DemoPage />} />
      <Route path="/guest" element={<GuestUI />} />
      <Route
        path="/service"
        element={
          <PrivateRoute roles={['service', 'admin']}>
            <ServiceUI />
          </PrivateRoute>
        }
      />
      <Route
        path="/kitchen"
        element={
          <KioskLock stationName="Küchenstation">
            <PrivateRoute roles={['kitchen', 'admin']}>
              <KitchenDisplay />
            </PrivateRoute>
          </KioskLock>
        }
      />
      <Route
        path="/bar"
        element={
          <KioskLock stationName="Bar-Station">
            <PrivateRoute roles={['kitchen', 'service', 'admin']}>
              <BarDisplay />
            </PrivateRoute>
          </KioskLock>
        }
      />
      <Route
        path="/grill"
        element={
          <KioskLock stationName="Grill-Station">
            <PrivateRoute roles={['kitchen', 'service', 'admin']}>
              <GrillDisplay />
            </PrivateRoute>
          </KioskLock>
        }
      />
      <Route
        path="/runner"
        element={
          <PrivateRoute roles={['service', 'admin']}>
            <RunnerDisplay />
          </PrivateRoute>
        }
      />
      <Route
        path="/floor"
        element={
          <KioskLock stationName="Buffet / Tischplan">
            <PrivateRoute roles={['service', 'admin']}>
              <FloorPlan />
            </PrivateRoute>
          </KioskLock>
        }
      />
      <Route
        path="/tasks"
        element={
          <PrivateRoute roles={['service', 'kitchen', 'admin']}>
            <TaskPool />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <PrivateRoute roles={['admin']}>
            <AdminDashboard />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}

export default App;
