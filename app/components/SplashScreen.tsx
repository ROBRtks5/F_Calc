'use client';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Hide splash screen after 2.5 seconds
    const timer = setTimeout(() => {
      setVisible(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: "easeInOut" } }}
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col items-center"
          >
            <div className="w-20 h-20 md:w-28 md:h-28 bg-zinc-950 border border-zinc-900 rounded-3xl flex items-center justify-center shadow-[0_0_80px_rgba(255,255,255,0.05)] mb-6">
              <span className="text-4xl md:text-6xl font-black text-white tracking-tighter">F.</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-white mb-2">F.Calc</h1>
            <p className="text-xs md:text-sm font-bold tracking-widest text-zinc-500 uppercase">Financial Terminal</p>
            
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: "100%" }}
               transition={{ duration: 1.5, delay: 0.5, ease: "easeInOut" }}
               className="h-[2px] bg-white rounded-full mt-12 w-48 max-w-[80vw]"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
