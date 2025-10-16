import { useState } from 'react';
import { Container, Paper, Title, PasswordInput, Button, Alert } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconAlertCircle } from '@tabler/icons-react';

export default function ChangePassword() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (val) => (!val ? 'Current password required' : null),
      newPassword: (val) => (val.length < 6 ? 'Password must be at least 6 characters' : null),
      confirmPassword: (val, values) =>
        val !== values.newPassword ? 'Passwords do not match' : null,
    },
  });

  async function handleSubmit(values: typeof form.values) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        notifications.show({
          title: 'Success',
          message: 'Password changed successfully',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        form.reset();
      } else {
        setError(data.error || 'Failed to change password');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container size={500}>
      <Title order={2} mb="lg">
        Change Password
      </Title>

      <Paper shadow="sm" p="lg">
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <PasswordInput
            label="Current Password"
            placeholder="Enter current password"
            required
            mb="md"
            {...form.getInputProps('currentPassword')}
          />
          <PasswordInput
            label="New Password"
            placeholder="Enter new password (min 6 characters)"
            required
            mb="md"
            {...form.getInputProps('newPassword')}
          />
          <PasswordInput
            label="Confirm New Password"
            placeholder="Confirm new password"
            required
            mb="lg"
            {...form.getInputProps('confirmPassword')}
          />
          <Button type="submit" loading={loading}>
            Change Password
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
