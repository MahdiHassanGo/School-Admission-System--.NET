import React from 'react';
import { StatusBadge } from './StatusBadge.tsx';
import { CountdownTimer } from './CountdownTimer.tsx';
import { HoldStatus } from '../types/index.ts';

interface Props {
  holdId: string;
  classId: string;
  className?: string;
  status: HoldStatus;
  expiresAt: string;
  isProcessingPayment: boolean;
  isProcessingCancel: boolean;
  onConfirm: (holdId: string) => void;
  onCancel: (holdId: string) => void;
  onRefreshHold: (holdId: string) => void;
}

export const HoldStatusCard: React.FC<Props> = ({
  holdId,
  classId,
  className,
  status,
  expiresAt,
  isProcessingPayment,
  isProcessingCancel,
  onConfirm,
  onCancel,
  onRefreshHold
}) => {
  const isHeld = status === 'HELD';
  const isConfirmed = status === 'CONFIRMED';
  const isExpired = status === 'EXPIRED';
  const isCancelled = status === 'CANCELLED';

  return (
    <div
      style={{
        background: isConfirmed ? '#f6fbf7' : isHeld ? '#fefcf3' : '#fafafa',
        border: `1.5px solid ${isConfirmed ? '#34a853' : isHeld ? '#f9ab00' : '#dadce0'}`,
        borderRadius: '10px',
        padding: '20px',
        marginBottom: '24px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#202124' }}>
            {className || `Class ID: ${classId}`}
          </h3>
          <StatusBadge status={status} />
        </div>
        {isHeld && (
          <CountdownTimer
            expiresAt={expiresAt}
            onExpired={() => onRefreshHold(holdId)}
          />
        )}
      </div>

      <div style={{ fontSize: '13px', color: '#5f6368', marginBottom: '16px', lineHeight: 1.6 }}>
        <div><strong>Hold Reference:</strong> <code style={{ background: '#f1f3f4', padding: '1px 6px', borderRadius: '4px' }}>{holdId}</code></div>
        <div><strong>Hold Deadline:</strong> {new Date(expiresAt).toLocaleString()} ({expiresAt})</div>
      </div>

      {isHeld && (
        <div style={{ background: '#fff', border: '1px solid #fce8b2', padding: '12px 14px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', color: '#b06000' }}>
          ⚠️ Your seat is temporarily reserved. Please complete payment before the countdown expires.
        </div>
      )}

      {isConfirmed && (
        <div style={{ background: '#e6f4ea', border: '1px solid #ceead6', padding: '12px 14px', borderRadius: '6px', fontSize: '13px', color: '#137333', fontWeight: 500 }}>
          🎉 Admission Confirmed! Your seat in this class/shift is securely allocated.
        </div>
      )}

      {isExpired && (
        <div style={{ background: '#f1f3f4', border: '1px solid #dadce0', padding: '12px 14px', borderRadius: '6px', fontSize: '13px', color: '#5f6368' }}>
          ⏳ This hold reservation has expired. The seat has been returned to the available pool.
        </div>
      )}

      {isCancelled && (
        <div style={{ background: '#fce8e6', border: '1px solid #fad2cf', padding: '12px 14px', borderRadius: '6px', fontSize: '13px', color: '#c5221f' }}>
          ❌ This hold was cancelled and the seat was released.
        </div>
      )}

      {/* Action buttons */}
      {isHeld && (
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button
            onClick={() => onConfirm(holdId)}
            disabled={isProcessingPayment || isProcessingCancel}
            style={{
              flex: 2,
              padding: '11px 20px',
              backgroundColor: '#1e8e3e',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isProcessingPayment ? 'not-allowed' : 'pointer'
            }}
          >
            {isProcessingPayment ? 'Processing Payment...' : '💳 Pay Admission Fee (Confirm Admission)'}
          </button>
          <button
            onClick={() => onCancel(holdId)}
            disabled={isProcessingPayment || isProcessingCancel}
            style={{
              flex: 1,
              padding: '11px 16px',
              backgroundColor: '#ffffff',
              color: '#d93025',
              border: '1px solid #d93025',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: isProcessingCancel ? 'not-allowed' : 'pointer'
            }}
          >
            {isProcessingCancel ? 'Cancelling...' : 'Cancel Hold'}
          </button>
        </div>
      )}
    </div>
  );
};
