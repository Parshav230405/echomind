import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Auth } from './pages/Auth';
import { Dashboard } from './pages/Dashboard';
import { Meeting } from './pages/Meeting';
import { Sidebar } from './components/Sidebar';
import { motion, AnimatePresence } from 'framer-motion';

const AppContent = () => {
  const { user, loading } = useAuth();
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'meeting-<id>'

  // Loading Screen
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-slate-400">Loading EchoMind...</p>
        </div>
      </div>
    );
  }

  // Not Logged In -> Show Authentication Flow
  if (!user) {
    return <Auth />;
  }

  // Helper to parse active meeting ID
  const isMeetingView = view.startsWith('meeting-');
  const activeMeetingId = isMeetingView ? view.replace('meeting-', '') : null;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#0B0F19] gradient-bg text-slate-100">
      
      {/* Sidebar Navigation */}
      <Sidebar currentView={view} onViewChange={setView} />
      
      {/* Main content body wrapper */}
      <main className="flex-1 min-w-0 md:ml-64 p-6 md:p-8 mt-16 md:mt-0 transition-all duration-300">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="h-full"
          >
            {view === 'dashboard' && (
              <Dashboard onViewChange={setView} />
            )}
            
            {isMeetingView && activeMeetingId && (
              <Meeting meetingId={activeMeetingId} onViewChange={setView} />
            )}
          </motion.div>
        </AnimatePresence>
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
