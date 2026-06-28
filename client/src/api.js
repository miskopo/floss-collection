const API_BASE = '/api/flosses';

async function parseResponse(response) {
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Request failed');
  }
  return payload;
}

export async function listFlosses(filters = {}) {
  const params = new URLSearchParams();
  if (filters.number) params.set('number', filters.number);
  if (filters.type) params.set('type', filters.type);
  if (filters.minQuantity !== undefined && filters.minQuantity !== '') {
    params.set('minQuantity', filters.minQuantity);
  }

  const query = params.toString();
  const response = await fetch(query ? `${API_BASE}?${query}` : API_BASE);
  return parseResponse(response);
}

export async function addFloss({ number, type, quantity }) {
  const response = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ number, type, quantity }),
  });
  return parseResponse(response);
}

export async function removeFloss(id) {
  const response = await fetch(`${API_BASE}/${id}?confirm=true`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  });
  return parseResponse(response);
}

export async function subtractFloss(id, quantity, confirm = false) {
  const query = confirm ? '?confirm=true' : '';
  const response = await fetch(`${API_BASE}/${id}/subtract${query}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity, ...(confirm ? { confirm: true } : {}) }),
  });
  return parseResponse(response);
}
