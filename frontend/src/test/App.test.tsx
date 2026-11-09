import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.tsx';
import { api } from '../lib/api/client.ts';
import { AdmissionClass, StudentHoldSummary, ApiError } from '../types/index.ts';

vi.mock('../lib/api/client.ts', () => ({
  api: {
    getClasses: vi.fn(),
    getMyHolds: vi.fn(),
    createHold: vi.fn(),
    confirmHold: vi.fn(),
    cancelHold: vi.fn(),
    getHoldById: vi.fn(),
    createClass: vi.fn()
  }
}));

describe('School Admission Frontend Tests', () => {
  const mockClasses: AdmissionClass[] = [
    {
      id: 'c_test1',
      name: 'Class 6 - Morning Shift',
      totalSeats: 100,
      heldSeats: 10,
      confirmedSeats: 70,
      availableSeats: 20
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(api.getClasses).mockResolvedValue(mockClasses);
    vi.mocked(api.getMyHolds).mockResolvedValue([]);
  });

  it('renders classes and displays live seat counts', async () => {
    render(<App />);

    expect(await screen.findByText('Class 6 - Morning Shift')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // total
    expect(screen.getByText('70')).toBeInTheDocument();  // confirmed
    expect(screen.getByText('10')).toBeInTheDocument();  // held
    expect(screen.getByText('20')).toBeInTheDocument();  // available
  });

  it('allows a valid student to request a hold and displays HELD state', async () => {
    vi.mocked(api.createHold).mockResolvedValue({
      holdId: 'h_test123',
      classId: 'c_test1',
      studentId: '20152691234567890',
      status: 'HELD',
      expiresAt: new Date(Date.now() + 600000).toISOString()
    });

    const mockHolds: StudentHoldSummary[] = [
      {
        holdId: 'h_test123',
        classId: 'c_test1',
        className: 'Class 6 - Morning Shift',
        status: 'HELD',
        expiresAt: new Date(Date.now() + 600000).toISOString()
      }
    ];
    vi.mocked(api.getMyHolds).mockResolvedValue(mockHolds);

    render(<App />);

    // Enter valid 17-digit student id
    const input = await screen.findByPlaceholderText('e.g. 20152691234567890');
    fireEvent.change(input, { target: { value: '20152691234567890' } });
    fireEvent.click(screen.getByText('Set Student ID'));

    // Click apply button
    const applyButton = await screen.findByText('Apply for Admission Seat');
    fireEvent.click(applyButton);

    await waitFor(() => {
      expect(api.createHold).toHaveBeenCalledWith('c_test1', '20152691234567890');
    });

    // Check that HELD badge and payment button are visible
    expect(await screen.findByText(/HELD/i)).toBeInTheDocument();
    expect(screen.getByText(/Pay Admission Fee/i)).toBeInTheDocument();
  });

  it('disables payment actions when a hold is EXPIRED', async () => {
    const expiredHolds: StudentHoldSummary[] = [
      {
        holdId: 'h_expired',
        classId: 'c_test1',
        className: 'Class 6 - Morning Shift',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 10000).toISOString()
      }
    ];

    localStorage.setItem('school_admission_student_id', '20152691234567890');
    vi.mocked(api.getMyHolds).mockResolvedValue(expiredHolds);

    render(<App />);

    // Switch to My Applications tab
    const tab = await screen.findByRole('button', { name: /My Applications/i });
    fireEvent.click(tab);

    expect(await screen.findByText('EXPIRED')).toBeInTheDocument();
    // Payment button must not be present for expired holds
    expect(screen.queryByText(/Pay & Confirm/i)).not.toBeInTheDocument();
  });

  it('renders a 409 Conflict API error as a readable notification message', async () => {
    localStorage.setItem('school_admission_student_id', '20152691234567890');

    const conflictError: ApiError = {
      status: 409,
      title: 'Conflict',
      detail: 'You already have an active or confirmed admission hold for this class.'
    };
    vi.mocked(api.createHold).mockRejectedValue(conflictError);

    render(<App />);

    const applyButton = await screen.findByText('Apply for Admission Seat');
    fireEvent.click(applyButton);

    expect(
      await screen.findByText('You already have an active or confirmed admission hold for this class.')
    ).toBeInTheDocument();
  });

  it('restores student ID from localStorage on load and queries applications', async () => {
    localStorage.setItem('school_admission_student_id', '20152691234567899');

    render(<App />);

    await waitFor(() => {
      expect(api.getMyHolds).toHaveBeenCalledWith('20152691234567899');
    });

    expect(screen.getByText(/Active ID: 20152691234567899/)).toBeInTheDocument();
  });
});
