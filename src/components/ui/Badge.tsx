import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'gray' | 'indigo';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'gray', className = '' }) => {
  const variants = {
    blue: 'bg-one-blue/10 text-one-blue border-one-blue/20',
    green: 'bg-one-green/10 text-one-green border-one-green/20',
    red: 'bg-one-red/10 text-one-red border-one-red/20',
    purple: 'bg-one-purple/10 text-one-purple border-one-purple/20',
    orange: 'bg-one-orange/10 text-one-orange border-one-orange/20',
    indigo: 'bg-one-indigo/10 text-one-indigo border-one-indigo/20',
    gray: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
