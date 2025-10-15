import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LogSources from './pages/LogSources';
import LogSourceForm from './pages/LogSourceForm';
import RegexPatterns from './pages/RegexPatterns';
import TagMappings from './pages/TagMappings';
import InfluxConfigs from './pages/InfluxConfigs';
import InfluxConfigForm from './pages/InfluxConfigForm';
import InfluxExplorer from './pages/InfluxExplorer';
import SQLiteExplorer from './pages/SQLiteExplorer';
import Jobs from './pages/Jobs';
import JobForm from './pages/JobForm';
import ActivityLogs from './pages/ActivityLogs';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/log-sources" element={<LogSources />} />
        <Route path="/log-sources/new" element={<LogSourceForm />} />
        <Route path="/log-sources/:id/edit" element={<LogSourceForm />} />
        <Route path="/log-sources/:id/regex" element={<RegexPatterns />} />
        <Route path="/log-sources/:id/tags" element={<TagMappings />} />
        <Route path="/influx-configs" element={<InfluxConfigs />} />
        <Route path="/influx-configs/new" element={<InfluxConfigForm />} />
        <Route path="/influx-configs/:id/edit" element={<InfluxConfigForm />} />
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
