import { AppShell, Burger, Group, Title, NavLink } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconDashboard,
  IconDatabase,
  IconClock,
  IconList,
  IconChartLine,
  IconSearch,
} from '@tabler/icons-react';
import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { icon: IconDashboard, label: 'Dashboard', path: '/' },
    { icon: IconDatabase, label: 'Log Sources', path: '/log-sources' },
    { icon: IconChartLine, label: 'InfluxDB Configs', path: '/influx-configs' },
    { icon: IconSearch, label: 'InfluxDB Explorer', path: '/influx-explorer' },
    { icon: IconDatabase, label: 'SQLite Explorer', path: '/sqlite-explorer' },
    { icon: IconClock, label: 'Jobs', path: '/jobs' },
    { icon: IconList, label: 'Activity Logs', path: '/activity-logs' },
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md">
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
          <Title order={3}>Log Forwarder</Title>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            label={item.label}
            leftSection={<item.icon size={20} />}
            active={location.pathname === item.path}
            onClick={() => navigate(item.path)}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
