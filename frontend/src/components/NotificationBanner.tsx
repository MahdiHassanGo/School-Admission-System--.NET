import React from 'react';
import { ApiError } from '../types/index.ts';

interface Props {
  error: ApiError | null;
  successMessage: string | null;
  onDismissError: () => void;
  onDismissSuccess: () => void;
}

export const NotificationBanner: React.FC<Props> = ({
  error,
  successMessage,
  onDismissError,
  onDismissSuccess
}) => {
  if (!error && !successMessage) return null;

  return (
    <div style={{ marginBottom: '20px' }}>
      {error && (
        <div
          style={{
            background: '#fce8e6',
            border: '1px solid #fad2cf',
            borderRadius: '8px',
            padding: '14px 18px',
            color: '#c5221f',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '12px',
            marginBottom: '10px'
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '2px' }}>
              ⚠️ {error.title} {error.status > 0 ? `(${error.status})` : ''}
            </div>
            <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{error.detail}</div>
          </div>
          <button
            onClick={onDismissError}
            style={{
              background: 'none',
              border: 'none',
              color: '#c5221f',
              fontSize: '18px',
              cursor: 'pointer',
              fontWeight: 'bold',
              lineHeight: 1
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div
          style={{
            background: '#e6f4ea',
            border: '1px solid #ceead6',
            borderRadius: '8px',
            padding: '14px 18px',
            color: '#137333',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '14px', fontWeight: 500 }}>
            ✓ {successMessage}
          </div>
          <button
            onClick={onDismissSuccess}
            style={{
              background: 'none',
              border: 'none',
              color: '#137333',
              fontSize: '18px',
              cursor: 'pointer',
              fontWeight: 'bold',
              lineHeight: 1
            }}
            aria-label="Dismiss success message"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
};
