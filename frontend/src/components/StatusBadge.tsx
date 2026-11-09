import React from 'react';
import { HoldStatus } from '../types/index.ts';

interface Props {
  status: HoldStatus;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const getStyle = (): { bg: string; color: string; label: string } => {
    switch (status) {
      case 'CONFIRMED':
        return { bg: '#e6f4ea', color: '#137333', label: 'CONFIRMED' };
      case 'HELD':
        return { bg: '#fef7e0', color: '#b06000', label: 'HELD (RESERVED)' };
      case 'EXPIRED':
        return { bg: '#f1f3f4', color: '#5f6368', label: 'EXPIRED' };
      case 'CANCELLED':
        return { bg: '#fce8e6', color: '#c5221f', label: 'CANCELLED' };
      default:
        return { bg: '#f1f3f4', color: '#3c4043', label: status };
    }
  };

  const { bg, color, label } = getStyle();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '600',
        backgroundColor: bg,
        color: color,
        border: `1px solid ${color}33`,
        letterSpacing: '0.5px'
      }}
    >
      ●&nbsp;{label}
    </span>
  );
};
