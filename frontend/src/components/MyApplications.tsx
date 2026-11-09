import React from 'react';
import { StudentHoldSummary } from '../types/index.ts';
import { StatusBadge } from './StatusBadge.tsx';
import { CountdownTimer } from './CountdownTimer.tsx';

interface Props {
  holds: StudentHoldSummary[];
  studentId: string;
  isLoading: boolean;
  onConfirm: (holdId: string) => void;
  onCancel: (holdId: string) => void;
  onRefresh: () => void;
}

export const MyApplications: React.FC<Props> = ({
  holds,
  studentId,
  isLoading,
  onConfirm,
  onCancel,
  onRefresh
}) => {
  if (!studentId) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '8px', border: '1px dashed #dadce0', color: '#5f6368' }}>
        Please enter a Student Birth Registration Number above to view your applications.
      </div>
    );
  }

  if (isLoading && holds.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#5f6368' }}>
        Loading applications...
      </div>
    );
  }

  if (holds.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', background: '#fff', borderRadius: '8px', border: '1px dashed #dadce0', color: '#5f6368' }}>
        No admission applications found for Student ID <strong>{studentId}</strong>.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {holds.map((h) => {
        const isHeld = h.status === 'HELD';
        return (
          <div
            key={h.holdId}
            style={{
              background: '#ffffff',
              border: '1px solid #dadce0',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{ fontWeight: 600, fontSize: '16px', color: '#202124' }}>{h.className}</span>
                <StatusBadge status={h.status} />
              </div>
              <div style={{ fontSize: '12px', color: '#5f6368', lineHeight: 1.5 }}>
                <span>Hold ID: <code style={{ background: '#f1f3f4', padding: '1px 4px' }}>{h.holdId}</code></span>
                &nbsp;|&nbsp;
                <span>Deadline: {new Date(h.expiresAt).toLocaleTimeString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isHeld && (
                <>
                  <CountdownTimer expiresAt={h.expiresAt} onExpired={onRefresh} />
                  <button
                    onClick={() => onConfirm(h.holdId)}
                    style={{
                      padding: '8px 14px',
                      background: '#1e8e3e',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Pay & Confirm
                  </button>
                  <button
                    onClick={() => onCancel(h.holdId)}
                    style={{
                      padding: '8px 12px',
                      background: '#fff',
                      color: '#d93025',
                      border: '1px solid #dadce0',
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
