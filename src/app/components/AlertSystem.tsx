'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, ShieldAlert } from 'lucide-react';

interface AlertItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export default function AlertSystem() {
  const [activeAlerts, setActiveAlerts] = useState<AlertItem[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAlertEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ message: string; type: 'success' | 'error' | 'info' | 'warning' }>;
      const { message, type } = customEvent.detail;
      const id = Math.random().toString();
      setActiveAlerts(prev => [...prev, { id, message, type: type || 'info' }]);
    };

    window.addEventListener('earnly_alert_internal', handleAlertEvent);

    // Override window.alert
    const originalAlert = window.alert;
    window.alert = (message: string) => {
      // Determine type based on message keywords
      let type: 'success' | 'error' | 'info' | 'warning' = 'info';
      const msgLower = message.toLowerCase();
      if (
        msgLower.includes('success') || 
        msgLower.includes('berhasil') || 
        msgLower.includes('unlocked') || 
        msgLower.includes('registered') || 
        msgLower.includes('completed') ||
        msgLower.includes('diterima') ||
        msgLower.includes('dikirim')
      ) {
        type = 'success';
      } else if (
        msgLower.includes('fail') || 
        msgLower.includes('error') || 
        msgLower.includes('reject') || 
        msgLower.includes('insufficient') || 
        msgLower.includes('tidak dapat') || 
        msgLower.includes('tidak verified') ||
        msgLower.includes('gagal')
      ) {
        type = 'error';
      } else if (
        msgLower.includes('warning') || 
        msgLower.includes('notice') || 
        msgLower.includes('please') || 
        msgLower.includes('required') ||
        msgLower.includes('perhatian')
      ) {
        type = 'warning';
      }

      window.dispatchEvent(new CustomEvent('earnly_alert_internal', {
        detail: { message, type }
      }));
    };

    return () => {
      window.removeEventListener('earnly_alert_internal', handleAlertEvent);
      window.alert = originalAlert;
    };
  }, []);

  const removeAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  return (
    <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
      <AnimatePresence>
        {activeAlerts.map((alert) => {
          const isSuccess = alert.type === 'success';
          const isError = alert.type === 'error';
          const isWarning = alert.type === 'warning';

          return (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto"
            >
              <div className={`p-4 rounded-xl border backdrop-blur-md shadow-2xl flex gap-3 items-start relative overflow-hidden bg-zinc-950 ${
                isSuccess ? 'border-emerald-500/20 shadow-emerald-950/10' :
                isError ? 'border-rose-500/20 shadow-rose-950/10' :
                isWarning ? 'border-amber-500/20 shadow-amber-950/10' :
                'border-indigo-500/20 shadow-indigo-950/10'
              }`}>
                {/* Glow Background */}
                <div className={`absolute -right-10 -top-10 w-24 h-24 rounded-full blur-2xl opacity-10 ${
                  isSuccess ? 'bg-emerald-500' :
                  isError ? 'bg-rose-500' :
                  isWarning ? 'bg-amber-500' :
                  'bg-indigo-500'
                }`} />

                {/* Left Colored Bar */}
                <div className={`absolute top-0 bottom-0 left-0 w-1.5 ${
                  isSuccess ? 'bg-emerald-500' :
                  isError ? 'bg-rose-500' :
                  isWarning ? 'bg-amber-500' :
                  'bg-indigo-500'
                }`} />

                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5 ml-1">
                  {isSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> :
                   isError ? <AlertCircle className="w-5 h-5 text-rose-400" /> :
                   isWarning ? <ShieldAlert className="w-5 h-5 text-amber-400" /> :
                   <Info className="w-5 h-5 text-indigo-400" />}
                </div>

                {/* Message */}
                <div className="flex-1 min-w-0 pr-4">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 font-mono">
                    {isSuccess ? 'Success' :
                     isError ? 'Error / Failed' :
                     isWarning ? 'Notice' :
                     'Information'}
                  </h5>
                  <p className="text-xs text-zinc-200 mt-1 font-sans leading-relaxed text-left break-words">
                    {alert.message}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => removeAlert(alert.id)}
                  className="absolute top-2.5 right-2.5 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-zinc-800 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
