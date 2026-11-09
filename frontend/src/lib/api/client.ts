import {
  AdmissionClass,
  CreateClassRequest,
  CreateHoldResponse,
  HoldDetailResponse,
  ConfirmHoldResponse,
  StudentHoldSummary,
  ApiError
} from '../../types/index.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function request<T>(
  path: string,
  options: RequestInit = {},
  studentId?: string
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (studentId) {
    headers.set('X-Student-Id', studentId);
  }

  const url = `${BASE_URL.replace(/\/$/, '')}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers
    });
  } catch (err) {
    const error: ApiError = {
      status: 0,
      title: 'Connection Error',
      detail: 'Cannot connect to backend API server. Please ensure the server is running.'
    };
    throw error;
  }

  if (!response.ok) {
    let errorDetail = response.statusText || 'Unknown error';
    let errorTitle = `Error ${response.status}`;

    try {
      const data = await response.json();
      if (data.detail) errorDetail = data.detail;
      if (data.title) errorTitle = data.title;
      if (data.errors && typeof data.errors === 'object') {
        const errorList = Object.values(data.errors).flat().join(', ');
        if (errorList) errorDetail = errorList;
      }
    } catch {
      // not JSON
    }

    const error: ApiError = {
      status: response.status,
      title: errorTitle,
      detail: errorDetail
    };
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export const api = {
  getClasses: () => request<AdmissionClass[]>('/classes'),

  getClassById: (classId: string) => request<AdmissionClass>(`/classes/${classId}`),

  createClass: (payload: CreateClassRequest) =>
    request<AdmissionClass>('/classes', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  createHold: (classId: string, studentId: string) =>
    request<CreateHoldResponse>(`/classes/${classId}/holds`, { method: 'POST' }, studentId),

  getHoldById: (holdId: string) =>
    request<HoldDetailResponse>(`/holds/${holdId}`),

  confirmHold: (holdId: string, studentId: string) =>
    request<ConfirmHoldResponse>(`/holds/${holdId}/confirm`, { method: 'POST' }, studentId),

  cancelHold: (holdId: string, studentId: string) =>
    request<void>(`/holds/${holdId}`, { method: 'DELETE' }, studentId),

  getMyHolds: (studentId: string) =>
    request<StudentHoldSummary[]>('/me/holds', { method: 'GET' }, studentId)
};
