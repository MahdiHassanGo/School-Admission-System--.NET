import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './lib/api/client.ts';
import {
  AdmissionClass,
  CreateClassRequest,
  StudentHoldSummary,
  ApiError
} from './types/index.ts';
import { StudentIdForm } from './components/StudentIdForm.tsx';
import { ClassCard } from './components/ClassCard.tsx';
import { HoldStatusCard } from './components/HoldStatusCard.tsx';
import { MyApplications } from './components/MyApplications.tsx';
import { CreateClassForm } from './components/CreateClassForm.tsx';
import { NotificationBanner } from './components/NotificationBanner.tsx';

const LOCAL_STORAGE_KEY = 'school_admission_student_id';

export function App() {
  const [activeTab, setActiveTab] = useState<'admission' | 'applications' | 'admin'>('admission');
  const [studentId, setStudentId] = useState<string>(() => {
    return localStorage.getItem(LOCAL_STORAGE_KEY) || '';
  });

  const [classes, setClasses] = useState<AdmissionClass[]>([]);
  const [studentHolds, setStudentHolds] = useState<StudentHoldSummary[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(true);
  const [isLoadingHolds, setIsLoadingHolds] = useState<boolean>(false);

  // Operation loading flags
  const [applyingClassId, setApplyingClassId] = useState<string | null>(null);
  const [processingPaymentHoldId, setProcessingPaymentHoldId] = useState<string | null>(null);
  const [processingCancelHoldId, setProcessingCancelHoldId] = useState<string | null>(null);
  const [isCreatingClass, setIsCreatingClass] = useState<boolean>(false);

  // User feedback
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isStudentIdValid = /^\d{17}$/.test(studentId);

  // Load Classes
  const fetchClasses = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoadingClasses(true);
    try {
      const data = await api.getClasses();
      setClasses(data);
    } catch (err: unknown) {
      if (!quiet) setError(err as ApiError);
    } finally {
      if (!quiet) setIsLoadingClasses(false);
    }
  }, []);

  // Load My Holds
  const fetchMyHolds = useCallback(async (sid: string, quiet = false) => {
    if (!/^\d{17}$/.test(sid)) {
      setStudentHolds([]);
      return;
    }

    if (!quiet) setIsLoadingHolds(true);
    try {
      const data = await api.getMyHolds(sid);
      setStudentHolds(data);
    } catch (err: unknown) {
      if (!quiet) setError(err as ApiError);
    } finally {
      if (!quiet) setIsLoadingHolds(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (isStudentIdValid) {
      fetchMyHolds(studentId);
    }
  }, [studentId, isStudentIdValid, fetchMyHolds]);

  // Periodic polling every 4 seconds
  const studentIdRef = useRef(studentId);
  studentIdRef.current = studentId;

  useEffect(() => {
    const interval = setInterval(() => {
      fetchClasses(true);
      if (/^\d{17}$/.test(studentIdRef.current)) {
        fetchMyHolds(studentIdRef.current, true);
      }
    }, 4000);

    const handleFocus = () => {
      fetchClasses(true);
      if (/^\d{17}$/.test(studentIdRef.current)) {
        fetchMyHolds(studentIdRef.current, true);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [fetchClasses, fetchMyHolds]);

  // Student ID Change
  const handleStudentIdChange = (newId: string) => {
    setStudentId(newId);
    localStorage.setItem(LOCAL_STORAGE_KEY, newId);
    setError(null);
    setSuccessMessage(`Active Student ID updated to ${newId}.`);
  };

  // Find most recent active HELD hold for student
  const activeHold = studentHolds.find((h) => h.status === 'HELD');

  // Handle Apply
  const handleApply = async (classId: string) => {
    if (!isStudentIdValid) {
      setError({
        status: 400,
        title: 'Validation Error',
        detail: 'Please enter a valid 17-digit student Birth Registration Number first.'
      });
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setApplyingClassId(classId);

    try {
      const result = await api.createHold(classId, studentId);
      setSuccessMessage(`Seat held successfully! Reference: ${result.holdId}. Complete payment within the countdown window.`);
      await Promise.all([fetchClasses(true), fetchMyHolds(studentId, true)]);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setApplyingClassId(null);
    }
  };

  // Handle Confirm (Simulated Payment)
  const handleConfirm = async (holdId: string) => {
    setError(null);
    setSuccessMessage(null);
    setProcessingPaymentHoldId(holdId);

    try {
      await api.confirmHold(holdId, studentId);
      setSuccessMessage(`Admission confirmed successfully! Seat allocation is permanent.`);
      await Promise.all([fetchClasses(true), fetchMyHolds(studentId, true)]);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setProcessingPaymentHoldId(null);
    }
  };

  // Handle Cancel
  const handleCancel = async (holdId: string) => {
    setError(null);
    setSuccessMessage(null);
    setProcessingCancelHoldId(holdId);

    try {
      await api.cancelHold(holdId, studentId);
      setSuccessMessage(`Admission hold cancelled and seat released.`);
      await Promise.all([fetchClasses(true), fetchMyHolds(studentId, true)]);
    } catch (err: unknown) {
      setError(err as ApiError);
    } finally {
      setProcessingCancelHoldId(null);
    }
  };

  // Refresh single hold
  const handleRefreshHold = async (holdId: string) => {
    try {
      await api.getHoldById(holdId);
      await Promise.all([fetchClasses(true), fetchMyHolds(studentId, true)]);
    } catch {
      // ignore
    }
  };

  // Handle Create Class (Admin)
  const handleCreateClass = async (payload: CreateClassRequest): Promise<boolean> => {
    setError(null);
    setIsCreatingClass(true);
    try {
      await api.createClass(payload);
      await fetchClasses(true);
      return true;
    } catch (err: unknown) {
      setError(err as ApiError);
      return false;
    } finally {
      setIsCreatingClass(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#202124', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Top Header */}
      <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #dadce0', padding: '16px 24px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#1a73e8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🎓 School Admission System
            </h1>
            <div style={{ fontSize: '13px', color: '#5f6368', marginTop: '2px' }}>
              OnnoRokom Projukti Limited — .NET 8, PostgreSQL & React
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setActiveTab('admission')}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                background: activeTab === 'admission' ? '#1a73e8' : '#f1f3f4',
                color: activeTab === 'admission' ? '#ffffff' : '#3c4043',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Guardian / Admission
            </button>
            <button
              onClick={() => setActiveTab('applications')}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                background: activeTab === 'applications' ? '#1a73e8' : '#f1f3f4',
                color: activeTab === 'applications' ? '#ffffff' : '#3c4043',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              My Applications {studentHolds.length > 0 && `(${studentHolds.length})`}
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              style={{
                padding: '8px 16px',
                borderRadius: '20px',
                border: 'none',
                background: activeTab === 'admin' ? '#1a73e8' : '#f1f3f4',
                color: activeTab === 'admin' ? '#ffffff' : '#3c4043',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              School Admin
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1100px', margin: '24px auto', padding: '0 20px' }}>
        {/* Global Notifications */}
        <NotificationBanner
          error={error}
          successMessage={successMessage}
          onDismissError={() => setError(null)}
          onDismissSuccess={() => setSuccessMessage(null)}
        />

        {/* Student ID Identifier Banner */}
        <StudentIdForm
          currentStudentId={studentId}
          onStudentIdChange={handleStudentIdChange}
        />

        {/* Tab 1: Guardian Admission */}
        {activeTab === 'admission' && (
          <div>
            {/* Active Hold Highlight */}
            {activeHold && (
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#b06000', marginBottom: '10px' }}>
                  ⚡ Current Active Hold Reservation
                </h2>
                <HoldStatusCard
                  holdId={activeHold.holdId}
                  classId={activeHold.classId}
                  className={activeHold.className}
                  status={activeHold.status}
                  expiresAt={activeHold.expiresAt}
                  isProcessingPayment={processingPaymentHoldId === activeHold.holdId}
                  isProcessingCancel={processingCancelHoldId === activeHold.holdId}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  onRefreshHold={handleRefreshHold}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>Available Classes & Shifts</h2>
                <span style={{ fontSize: '12px', color: '#5f6368' }}>
                  Live availability refreshed every 4 seconds
                </span>
              </div>
              <button
                onClick={() => fetchClasses()}
                style={{
                  background: '#ffffff',
                  border: '1px solid #dadce0',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ↻ Refresh Live Counts
              </button>
            </div>

            {isLoadingClasses && classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#5f6368' }}>
                Loading classes and seat counts...
              </div>
            ) : classes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '8px', border: '1px dashed #dadce0', color: '#5f6368' }}>
                No classes registered yet. Switch to the <strong>School Admin</strong> tab to create admission classes.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {classes.map((c) => (
                  <ClassCard
                    key={c.id}
                    admissionClass={c}
                    isStudentIdValid={isStudentIdValid}
                    isApplying={applyingClassId === c.id}
                    onApply={handleApply}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: My Applications */}
        {activeTab === 'applications' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>My Admission Applications</h2>
                <span style={{ fontSize: '12px', color: '#5f6368' }}>
                  Showing all held, confirmed, expired, and cancelled records for Student ID <strong>{studentId || '(None)'}</strong>
                </span>
              </div>
              {isStudentIdValid && (
                <button
                  onClick={() => fetchMyHolds(studentId)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #dadce0',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  ↻ Refresh My Holds
                </button>
              )}
            </div>

            <MyApplications
              holds={studentHolds}
              studentId={studentId}
              isLoading={isLoadingHolds}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
              onRefresh={() => fetchMyHolds(studentId, true)}
            />
          </div>
        )}

        {/* Tab 3: School Admin */}
        {activeTab === 'admin' && (
          <div>
            <CreateClassForm
              isCreating={isCreatingClass}
              onCreateClass={handleCreateClass}
            />

            <div style={{ marginTop: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>All Registered Classes & Live Occupancy</h3>
                <span style={{ fontSize: '12px', color: '#5f6368' }}>Total: {classes.length} classes</span>
              </div>

              {classes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '8px', border: '1px dashed #dadce0', color: '#5f6368' }}>
                  No classes created yet. Use the form above to add one.
                </div>
              ) : (
                <div style={{ background: '#fff', border: '1px solid #dadce0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dadce0', color: '#5f6368' }}>
                        <th style={{ padding: '12px 16px' }}>Class / Shift</th>
                        <th style={{ padding: '12px 16px' }}>Class ID</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total Seats</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Confirmed</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Held</th>
                        <th style={{ padding: '12px 16px', textAlign: 'right' }}>Available</th>
                      </tr>
                    </thead>
                    <tbody>
                      {classes.map((c) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, color: '#202124' }}>{c.name}</td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#5f6368' }}>{c.id}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{c.totalSeats}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#137333', fontWeight: 600 }}>{c.confirmedSeats}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: '#b06000', fontWeight: 600 }}>{c.heldSeats}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', color: c.availableSeats <= 0 ? '#c5221f' : '#1a73e8', fontWeight: 700 }}>
                            {c.availableSeats}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
