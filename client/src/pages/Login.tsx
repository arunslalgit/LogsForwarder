import { useState } from 'react';
import { Container, Paper, Title, TextInput, PasswordInput, Button, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
// unused import removed
import { IconAlertCircle } from '@tabler/icons-react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm({
    initialValues: {
      username: '',
      password: '',
    },
    validate: {
      username: (val) => (!val ? 'Username required' : null),
      password: (val) => (!val ? 'Password required' : null),
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error: any) {
      setError(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size={420} mt={100}>
      <Paper shadow="md" p={30} radius="md">
        <Title order={2} mb="lg" ta="center">
          Log Forwarder
        </Title>
        <Title order={4} mb="xl" ta="center" c="dimmed">
          Sign In
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <TextInput
            label="Username"
            placeholder="admin"
            required
            mb="md"
            {...form.getInputProps('username')}
          />
          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mb="lg"
            {...form.getInputProps('password')}
          />
          <Button fullWidth type="submit" loading={loading}>
            Sign In
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
