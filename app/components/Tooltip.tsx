'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

export const Tooltip = ({ title, content, children }: { title: string, content: string, children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <div onClick={() => setIsOpen(true)} className="cursor-help flex items-center touch-manipulation inline-flex">
        {children}
      </div>
      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setIsOpen(false)}
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="relative w-full max-w-sm bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl p-5"
              >
                <div className="flex justify-between items-start mb-3">
                  <p className="text-[12px] font-black uppercase text-blue-400 tracking-widest">{title}</p>
                  <button onClick={() => setIsOpen(false)} className="p-1 -mr-2 -mt-2">
                    <X className="w-5 h-5 text-zinc-500 hover:text-white transition-colors" />
                  </button>
                </div>
                <p className="text-[13px] text-zinc-300 leading-relaxed font-medium">{content}</p>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

