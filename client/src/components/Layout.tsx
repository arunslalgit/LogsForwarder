import { AppShell, Burger, Group, Title, NavLink, Button, Divider, Text, Stack } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  IconDashboard,
  IconDatabase,
  IconClock,
  IconList,
  IconChartLine,
  IconKey,
  IconLogout,
  IconFileCode,
  IconChartBar,
  IconTable,
  IconServer,
} from '@tabler/icons-react';
import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const navSections = [
    {
      title: null,
      items: [
        { icon: IconDashboard, label: 'Dashboard', path: '/' },
      ]
    },
    {
      title: 'DATA SOURCES & CONFIGS',
      items: [
        { icon: IconFileCode, label: 'Log Sources', path: '/log-sources' },
        { icon: IconChartLine, label: 'InfluxDB Configs', path: '/influx-configs' },
        { icon: IconServer, label: 'PostgreSQL Configs', path: '/postgres-configs' },
      ]
    },
    {
      title: 'EXECUTION',
      items: [
        { icon: IconClock, label: 'Jobs', path: '/jobs' },
        { icon: IconList, label: 'Activity Logs', path: '/activity-logs' },
      ]
    },
    {
      title: 'EXPLORERS',
      items: [
        { icon: IconChartBar, label: 'InfluxDB Explorer', path: '/influx-explorer' },
        { icon: IconTable, label: 'PostgreSQL Explorer', path: '/postgres-explorer' },
        { icon: IconDatabase, label: 'SQLite Explorer', path: '/sqlite-explorer' },
      ]
    },
  ];

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: 250, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Title order={3}>Log Forwarder</Title>
          </Group>
          <Text size="sm" c="dimmed">{user?.username}</Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Stack gap="xs">
          {navSections.map((section, sectionIndex) => (
            <div key={sectionIndex}>
              {section.title && (
                <Text
                  size="xs"
                  fw={700}
                  tt="uppercase"
                  c="dimmed"
                  mb={4}
                  mt={sectionIndex > 0 ? 'md' : 0}
                >
                  {section.title}
                </Text>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.path}
                  label={item.label}
                  leftSection={<item.icon size={18} />}
                  onClick={() => navigate(item.path)}
                  active={location.pathname === item.path}
                />
              ))}
            </div>
          ))}
        </Stack>

        <Divider my="md" />

        <NavLink
          label="Change Password"
          leftSection={<IconKey size={18} />}
          onClick={() => navigate('/change-password')}
          active={location.pathname === '/change-password'}
        />

        <Button
          variant="subtle"
          color="red"
          leftSection={<IconLogout size={18} />}
          onClick={logout}
          fullWidth
          mt="md"
        >
          Logout
        </Button>
      </AppShell.Navbar>

      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
