import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export type AlertType = 'error' | 'warning' | 'success' | 'info';

export interface AlertBannerProps {
  type: AlertType;
  message: string;
  onDismiss?: () => void;
  actionText?: string;
  onAction?: () => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({
  type,
  message,
  onDismiss,
  actionText,
  onAction,
}) => {
  const getStyles = () => {
    switch (type) {
      case 'error':
        return {
          wrapper: 'bg-rose-950/70 border-rose-800/80 text-rose-200',
          icon: <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
          actionBtn: 'text-rose-300 hover:text-white bg-rose-900/60 hover:bg-rose-800/80',
        };
      case 'warning':
        return {
          wrapper: 'bg-amber-950/70 border-amber-800/80 text-amber-200',
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
          actionBtn: 'text-amber-300 hover:text-white bg-amber-900/60 hover:bg-amber-800/80',
        };
      case 'success':
        return {
          wrapper: 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200',
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
          actionBtn: 'text-emerald-300 hover:text-white bg-emerald-900/60 hover:bg-emerald-800/80',
        };
      case 'info':
      default:
        return {
          wrapper: 'bg-brand-950/70 border-brand-800/80 text-brand-200',
          icon: <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />,
          actionBtn: 'text-brand-300 hover:text-white bg-brand-900/60 hover:bg-brand-800/80',
        };
    }
  };

  const styles = getStyles();

  return (
    <div
      role="alert"
      className={`flex items-start justify-between gap-3 p-3 rounded-xl border backdrop-blur-md shadow-lg transition-all animate-in fade-in slide-in-from-top-1 duration-200 ${styles.wrapper}`}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        {styles.icon}
        <div className="text-xs leading-relaxed font-medium break-words">
          {message}
          {actionText && onAction && (
            <button
              onClick={onAction}
              className={`block mt-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${styles.actionBtn}`}
            >
              {actionText}
            </button>
          )}
        </div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};
