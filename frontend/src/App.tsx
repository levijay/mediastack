import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { ToastProvider } from './components/Toast';
import { UISettingsProvider } from './contexts/UISettingsContext';
import { TimezoneProvider } from './contexts/TimezoneContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { MediaDetailPage } from './pages/MediaDetailPage';
import { CastCrewPage } from './pages/CastCrewPage';
import { PersonDetailPage } from './pages/PersonDetailPage';
import { SearchPage } from './pages/SearchPage';
import { MoviesPage } from './pages/MoviesPage';
import { TVSeriesPage } from './pages/TVSeriesPage';
import { CalendarPage } from './pages/CalendarPage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityPage } from './pages/ActivityPage';
import { RecentActivityPage } from './pages/RecentActivityPage';
import { RecentlyAddedPage } from './pages/RecentlyAddedPage';
import { ReportingPage } from './pages/ReportingPage';

function ThemeProvider({ children }: { children: React.ReactNode }) {
 useTheme(); // Initialize theme
 return <>{children}</>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
 const { isAuthenticated, loading } = useAuth();

 if (loading) {
  return (
   <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--theme-background)' }}>
    <div className="text-xl" style={{ color: 'var(--theme-text)' }}>Loading...</div>
   </div>
  );
 }

 return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
 const { isAuthenticated, loading } = useAuth();

 if (loading) {
  return (
   <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--theme-background)' }}>
    <div className="text-xl" style={{ color: 'var(--theme-text)' }}>Loading...</div>
   </div>
  );
 }

 return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" />;
}

function App() {
 return (
  <BrowserRouter>
   <ThemeProvider>
    <AuthProvider>
     <UISettingsProvider>
      <TimezoneProvider>
       <NotificationProvider>
        <ToastProvider>
         <Routes>
      <Route
       path="/login"
       element={
        <PublicRoute>
         <LoginPage />
        </PublicRoute>
       }
      />
      <Route
       path="/register"
       element={
        <PublicRoute>
         <RegisterPage />
        </PublicRoute>
       }
      />
      <Route
       path="/dashboard"
       element={
        <PrivateRoute>
         <DashboardPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/discover"
       element={
        <PrivateRoute>
         <DiscoverPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/discover/movie/:id"
       element={
        <PrivateRoute>
         <MediaDetailPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/discover/tv/:id"
       element={
        <PrivateRoute>
         <MediaDetailPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/search"
       element={
        <PrivateRoute>
         <SearchPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/movies"
       element={
        <PrivateRoute>
         <MoviesPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/movies/:id"
       element={
        <PrivateRoute>
         <MediaDetailPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/series"
       element={
        <PrivateRoute>
         <TVSeriesPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/series/:id"
       element={
        <PrivateRoute>
         <MediaDetailPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/:mediaType/:id/cast-crew"
       element={
        <PrivateRoute>
         <CastCrewPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/person/:id"
       element={
        <PrivateRoute>
         <PersonDetailPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/calendar"
       element={
        <PrivateRoute>
         <CalendarPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/recently-added"
       element={
        <PrivateRoute>
         <RecentlyAddedPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/downloads"
       element={
        <PrivateRoute>
         <ActivityPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/recent-activity"
       element={
        <PrivateRoute>
         <RecentActivityPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/activity"
       element={<Navigate to="/downloads" />}
      />
      <Route
       path="/settings"
       element={
        <PrivateRoute>
         <SettingsPage />
        </PrivateRoute>
       }
      />
      <Route
       path="/reports"
       element={
        <PrivateRoute>
         <ReportingPage />
        </PrivateRoute>
       }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
     </Routes>
        </ToastProvider>
       </NotificationProvider>
      </TimezoneProvider>
     </UISettingsProvider>
    </AuthProvider>
   </ThemeProvider>
  </BrowserRouter>
 );
}

export default App;
