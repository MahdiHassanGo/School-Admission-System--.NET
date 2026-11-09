import React from 'react';
import { AdmissionClass } from '../types/index.ts';

interface Props {
  admissionClass: AdmissionClass;
  isStudentIdValid: boolean;
  isApplying: boolean;
  onApply: (classId: string) => void;
}

export const ClassCard: React.FC<Props> = ({
  admissionClass,
  isStudentIdValid,
  isApplying,
  onApply
}) => {
  const { id, name, totalSeats, heldSeats, confirmedSeats, availableSeats } = admissionClass;

  const confirmedPct = Math.round((confirmedSeats / totalSeats) * 100);
  const heldPct = Math.round((heldSeats / totalSeats) * 100);
  const isFull = availableSeats <= 0;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #dadce0',
        borderRadius: '8px',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '14px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', color: '#202124', fontWeight: 600 }}>{name}</h3>
          <span style={{ fontSize: '12px', color: '#5f6368', fontFamily: 'monospace' }}>ID: {id.substring(0, 8)}...</span>
        </div>

        {/* Progress bar */}
        <div
          style={{
            height: '8px',
            backgroundColor: '#e8eaed',
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
            margin: '10px 0 14px'
          }}
        >
          <div style={{ width: `${confirmedPct}%`, backgroundColor: '#137333' }} title={`Confirmed: ${confirmedSeats}`} />
          <div style={{ width: `${heldPct}%`, backgroundColor: '#f9ab00' }} title={`Held: ${heldSeats}`} />
        </div>

        {/* Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
          <div style={{ background: '#f8f9fa', padding: '8px 4px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#5f6368', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#202124' }}>{totalSeats}</div>
          </div>
          <div style={{ background: '#e6f4ea', padding: '8px 4px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#137333', textTransform: 'uppercase' }}>Confirmed</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#137333' }}>{confirmedSeats}</div>
          </div>
          <div style={{ background: '#fef7e0', padding: '8px 4px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: '#b06000', textTransform: 'uppercase' }}>Held</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#b06000' }}>{heldSeats}</div>
          </div>
          <div style={{ background: isFull ? '#fce8e6' : '#e8f0fe', padding: '8px 4px', borderRadius: '6px' }}>
            <div style={{ fontSize: '11px', color: isFull ? '#c5221f' : '#1a73e8', textTransform: 'uppercase' }}>Available</div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: isFull ? '#c5221f' : '#1a73e8' }}>{availableSeats}</div>
          </div>
        </div>
      </div>

      <div>
        <button
          onClick={() => onApply(id)}
          disabled={isFull || !isStudentIdValid || isApplying}
          style={{
            width: '100%',
            padding: '10px 16px',
            backgroundColor: isFull ? '#dadce0' : isStudentIdValid ? '#1a73e8' : '#8ab4f8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: isFull || !isStudentIdValid || isApplying ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {isApplying
            ? 'Holding Seat...'
            : isFull
            ? 'No Seats Available'
            : !isStudentIdValid
            ? 'Enter 17-digit Student ID to Apply'
            : 'Apply for Admission Seat'}
        </button>
      </div>
    </div>
  );
};
