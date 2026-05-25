import { api } from '../core/httpClient.js';

export async function getAddresses() {
  const res = await api.get('/api/addresses');
  return res.data.data;
}

export async function createAddress(data) {
  const res = await api.post('/api/addresses', data);
  return res.data.data;
}

export async function updateAddress(id, data) {
  const res = await api.put(`/api/addresses/${id}`, data);
  return res.data.data;
}

export async function deleteAddress(id) {
  const res = await api.delete(`/api/addresses/${id}`);
  return res.data;
}
