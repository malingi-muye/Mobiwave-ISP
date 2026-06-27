import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer';

  const variants = {
    primary: 'bg-one-blue text-white shadow-lg shadow-one-blue/20 hover:bg-one-blue/90',
    secondary: 'bg-one-indigo text-white shadow-lg shadow-one-indigo/20 hover:bg-one-indigo/90',
    outline: 'bg-transparent border-2 border-one-blue text-one-blue hover:bg-one-blue/5',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
    danger: 'bg-one-red text-white shadow-lg shadow-one-red/20 hover:bg-one-red/90',
    success: 'bg-one-green text-white shadow-lg shadow-one-green/20 hover:bg-one-green/90',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-8 py-4 text-base',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
