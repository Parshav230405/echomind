import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Meeting } from './pages/Meeting';
import { Sidebar } from './components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic } from 'lucide-react';

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-[#080C14]">
    {/* Ambient glows */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(99,102,241,0.12),transparent_55%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_80%,rgba(168,85,247,0.08),transparent_55%)]" />

    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-5 z-10"
    >
      {/* Animated Logo */}
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-indigo-600/40 blur-xl animate-pulse" />
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-600/40 border border-indigo-400/20">
          <Mic className="w-8 h-8 text-white" />
        </div>
      </div>
      {/* Spinner + text */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-400 tracking-wide">Loading EchoMind...</p>
      </div>
    </motion.div>
  </div>
);

const AppContent = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState('dashboard');

  if (loading) return <LoadingScreen />;
  if (!user) return <Auth />;

  const isMeetingView = view.startsWith('meeting-');
  const activeMeetingId = isMeetingView ? view.replace('meeting-', '') : null;

  return (
    <div className="min-h-screen flex bg-[#080C14] text-slate-100">
      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[radial-gradient(ellipse,rgba(99,102,241,0.06),transparent_70%)]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[radial-gradient(ellipse,rgba(168,85,247,0.04),transparent_70%)]" />
      </div>

      {/* Sidebar */}
      <Sidebar currentView={view} onViewChange={setView} />

      {/* Main Content */}
      <main className="relative z-10 flex-1 min-w-0 md:ml-[260px] min-h-screen">
        {/* Mobile top bar spacer */}
        <div className="h-16 md:hidden" />

        <div className="p-5 md:p-8 max-w-screen-xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
            >
              {view.startsWith('dashboard') && (
                <Dashboard
                  initialTab={view === 'dashboard-record' ? 'record' : 'upload'}
                  onViewChange={setView}
                />
              )}
              {isMeetingView && activeMeetingId && (
                <Meeting meetingId={activeMeetingId} onViewChange={setView} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
