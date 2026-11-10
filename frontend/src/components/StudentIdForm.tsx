import React, { useState, useEffect } from 'react';

interface Props {
  currentStudentId: string;
  onStudentIdChange: (newId: string) => void;
}

export const StudentIdForm: React.FC<Props> = ({ currentStudentId, onStudentIdChange }) => {
  const [inputVal, setInputVal] = useState(currentStudentId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setInputVal(currentStudentId);
  }, [currentStudentId]);

  const isValidFormat = (val: string) => /^\d{17}$/.test(val.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputVal.trim();

    if (!trimmed) {
      setError('Please enter a student Birth Registration Number.');
      return;
    }

    if (!isValidFormat(trimmed)) {
      setError('Birth Registration Number must be exactly 17 numeric digits.');
      return;
    }

    setError(null);
    onStudentIdChange(trimmed);
  };

  const isCurrentValid = isValidFormat(currentStudentId);

  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '8px',
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '20px',
        border: '1px solid #e0e0e0'
      }}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <label htmlFor="student-id-input" style={{ fontWeight: 600, fontSize: '14px', color: '#202124' }}>
              Student Birth Registration Number (17 Digits)
            </label>
            <div style={{ fontSize: '12px', color: '#5f6368' }}>
              Used as identity (sent via <code style={{ background: '#f1f3f4', padding: '1px 4px' }}>X-Student-Id</code>). Persisted in browser localStorage.
            </div>
          </div>
          {isCurrentValid && (
            <span style={{ fontSize: '13px', color: '#137333', background: '#e6f4ea', padding: '4px 10px', borderRadius: '16px', fontWeight: 500 }}>
              ✓ Active ID: {currentStudentId}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <input
            id="student-id-input"
            type="text"
            maxLength={17}
            placeholder="e.g. 20152691234567890"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              if (error) setError(null);
            }}
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '6px',
              border: `1px solid ${error ? '#d93025' : '#dadce0'}`,
              backgroundColor: '#ffffff',
              color: '#202124',
              fontSize: '15px',
              fontFamily: 'monospace'
            }}
          />
          <button
            type="submit"
            style={{
              padding: '10px 20px',
              background: '#1a73e8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Set Student ID
          </button>
        </div>

        {error && (
          <div style={{ color: '#d93025', fontSize: '13px', fontWeight: 500, marginTop: '2px' }}>
            ⚠️ {error}
          </div>
        )}
      </form>
    </div>
  );
};
