import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import LogSources from './pages/LogSources';
import LogSourceForm from './pages/LogSourceForm';
import RegexPatterns from './pages/RegexPatterns';
import TagMappings from './pages/TagMappings';
import InfluxConfigs from './pages/InfluxConfigs';
import InfluxConfigForm from './pages/InfluxConfigForm';
import PostgresConfigs from './pages/PostgresConfigs';
import PostgresConfigForm from './pages/PostgresConfigForm';
import PostgresExplorer from './pages/PostgresExplorer';
import InfluxExplorer from './pages/InfluxExplorer';
import SQLiteExplorer from './pages/SQLiteExplorer';
import Jobs from './pages/Jobs';
import JobForm from './pages/JobForm';
import ActivityLogs from './pages/ActivityLogs';


export default function App() {
  const { user } = useAuth();

  if (user === null && window.location.pathname !== '/login') {
    return <Login />;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/" element={<Dashboard />} />
        <Route path="/log-sources" element={<LogSources />} />
        <Route path="/log-sources/new" element={<LogSourceForm />} />
        <Route path="/log-sources/:id/edit" element={<LogSourceForm />} />
        <Route path="/log-sources/:id/regex" element={<RegexPatterns />} />
        <Route path="/log-sources/:id/tags" element={<TagMappings />} />
        <Route path="/influx-configs" element={<InfluxConfigs />} />
        <Route path="/influx-configs/new" element={<InfluxConfigForm />} />
        <Route path="/influx-configs/:id/edit" element={<InfluxConfigForm />} />
        <Route path="/postgres-configs" element={<PostgresConfigs />} />
        <Route path="/postgres-configs/new" element={<PostgresConfigForm />} />
        <Route path="/postgres-configs/:id/edit" element={<PostgresConfigForm />} />
        <Route path="/postgres-explorer" element={<PostgresExplorer />} />
        <Route path="/influx-explorer" element={<InfluxExplorer />} />
        <Route path="/sqlite-explorer" element={<SQLiteExplorer />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/jobs/new" element={<JobForm />} />
        <Route path="/jobs/:id/edit" element={<JobForm />} />
        <Route path="/activity-logs" element={<ActivityLogs />} />
      </Routes>
    </Layout>
  );
}
