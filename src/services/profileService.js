import { api } from '../core/httpClient.js';

export async function getProfile() {
  const res = await api.get('/api/profile');
  return res.data.data;
}

export async function updateProfile(data) {
  const res = await api.put('/api/profile', data);
  return res.data.data;
}

export async function uploadAvatar(formData) {
  const res = await api.post('/api/profile/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function getNotificationPreferences() {
  const res = await api.get('/api/profile/notifications');
  return res.data.data;
}

export async function updateNotificationPreferences(prefs) {
  const res = await api.put('/api/profile/notifications', prefs);
  return res.data.data;
}
