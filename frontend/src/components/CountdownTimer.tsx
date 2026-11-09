import React, { useState, useEffect } from 'react';

interface Props {
  expiresAt: string;
  onExpired?: () => void;
}

export const CountdownTimer: React.FC<Props> = ({ expiresAt, onExpired }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    const calculateSeconds = () => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
      const remaining = Math.max(0, diff);
      setSecondsLeft(remaining);

      if (remaining === 0 && onExpired) {
        onExpired();
      }
    };

    calculateSeconds();
    const interval = setInterval(calculateSeconds, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const isUrgent = secondsLeft > 0 && secondsLeft <= 60;

  if (secondsLeft <= 0) {
    return <span style={{ color: '#d93025', fontWeight: 'bold' }}>Expired</span>;
  }

  return (
    <span
      style={{
        fontFamily: 'monospace',
        fontSize: '15px',
        fontWeight: 'bold',
        color: isUrgent ? '#d93025' : '#1a73e8',
        backgroundColor: isUrgent ? '#fce8e6' : '#e8f0fe',
        padding: '2px 8px',
        borderRadius: '6px'
      }}
    >
      ⏱️ {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
    </span>
  );
};
