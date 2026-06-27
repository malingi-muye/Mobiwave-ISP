import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  multiline?: boolean;
  rows?: number;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', multiline, rows, ...props }) => {
  const baseClasses = `
    w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800
    placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-one-blue/20 focus:border-one-blue
    transition-all ${icon ? 'pl-10' : ''} ${error ? 'border-one-red ring-one-red/10' : ''} ${className}
  `;

  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        {multiline ? (
          <textarea 
            className={baseClasses}
            rows={rows || 3}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input 
            className={baseClasses}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
      </div>
      {error && <p className="text-[10px] text-one-red font-bold ml-1">{error}</p>}
    </div>
  );
};

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => {
  return (
    <div className="space-y-1.5 w-full">
      {label && <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{label}</label>}
      <select 
        className={`
          w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800
          focus:outline-none focus:ring-2 focus:ring-one-blue/20 focus:border-one-blue
          transition-all appearance-none cursor-pointer ${className}
        `}
        {...props}
      >
        {children}
      </select>
    </div>
  );
};
