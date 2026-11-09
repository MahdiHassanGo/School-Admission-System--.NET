import React, { useState } from 'react';
import { CreateClassRequest } from '../types/index.ts';

interface Props {
  isCreating: boolean;
  onCreateClass: (payload: CreateClassRequest) => Promise<boolean>;
}

export const CreateClassForm: React.FC<Props> = ({ isCreating, onCreateClass }) => {
  const [name, setName] = useState('');
  const [totalSeats, setTotalSeats] = useState<number | ''>(50);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Class and Shift name is required.');
      return;
    }

    if (totalSeats === '' || totalSeats <= 0) {
      setError('Total seats must be a positive integer greater than zero.');
      return;
    }

    const ok = await onCreateClass({
      name: trimmedName,
      totalSeats: Number(totalSeats)
    });

    if (ok) {
      setSuccess(`Class '${trimmedName}' created with ${totalSeats} seats.`);
      setName('');
      setTotalSeats(50);
    }
  };

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #dadce0',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
      }}
    >
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '18px', color: '#202124' }}>
          🏫 Add New Class / Shift Unit
        </h3>
        <p style={{ margin: 0, fontSize: '13px', color: '#5f6368' }}>
          Each class and shift (Morning / Day) is registered as an independent admission unit with its own seat capacity.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
          <div>
            <label htmlFor="class-name-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3c4043', marginBottom: '6px' }}>
              Class & Shift Name
            </label>
            <input
              id="class-name-input"
              type="text"
              placeholder="e.g. Class 6 - Morning Shift"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #dadce0',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label htmlFor="seats-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#3c4043', marginBottom: '6px' }}>
              Total Capacity (Seats)
            </label>
            <input
              id="seats-input"
              type="number"
              min={1}
              max={1000}
              placeholder="e.g. 100"
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              disabled={isCreating}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '6px',
                border: '1px solid #dadce0',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {error && (
          <div style={{ color: '#d93025', fontSize: '13px', fontWeight: 500 }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ color: '#137333', fontSize: '13px', fontWeight: 500 }}>
            ✓ {success}
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={isCreating}
            style={{
              padding: '10px 20px',
              backgroundColor: '#1a73e8',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isCreating ? 'not-allowed' : 'pointer'
            }}
          >
            {isCreating ? 'Creating Class...' : 'Create Class / Shift'}
          </button>
        </div>
      </form>
    </div>
  );
};
