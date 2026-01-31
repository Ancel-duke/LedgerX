// Always use NEXT_PUBLIC_API_URL so deployed frontend (e.g. Netlify) works when backend is on a different origin.
const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:3000';

export interface HealthResponse {
  status?: string;
  [key: string]: unknown;
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function getReadiness(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health/ready`);
  return res.json();
}
