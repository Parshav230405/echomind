import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Mic2, LogOut, Menu, X,
  Sparkles, ChevronRight, Radio
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'record',    label: 'New Recording',   icon: Mic2 },
];

export const Sidebar = ({ currentView, onViewChange }) => {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (id) => {
    if (id === 'dashboard') return currentView === 'dashboard';
    if (id === 'record') return currentView === 'dashboard-record';
    return false;
  };

  const handleNav = (id) => {
    if (id === 'record') {
      onViewChange('dashboard-record');
    } else {
      onViewChange('dashboard');
    }
    setMobileOpen(false);
  };

  const initial = user?.name?.charAt(0)?.toUpperCase() || 'U';

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="p-5 pb-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="absolute inset-0 rounded-xl bg-indigo-600/40 blur-md" />
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400/20 shadow-lg">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight leading-none">EchoMind</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
              <span className="text-[10px] font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI Assistant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.15em] px-2 mb-2">Navigation</p>

        {navItems.map(({ id, label, icon: Icon }) => {
          const active = isActive(id);
          return (
            <button
              key={id}
              onClick={() => handleNav(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                active
                  ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-500/80 text-white shadow-lg shadow-indigo-600/20 border border-indigo-400/20'
                  : 'text-slate-500 hover:text-white hover:bg-white/[0.05]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-600 group-hover:text-slate-300'}`} />
              <span className="flex-1 text-left">{label}</span>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-white/60" />}
              {!active && <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
            </button>
          );
        })}

        {/* Divider */}
        <div className="pt-4 pb-2">
          <p className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.15em] px-2 mb-2">Status</p>
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <div className="relative">
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-emerald-400">AI Operational</p>
              <p className="text-[9px] text-slate-600">Groq Whisper + LLaMA</p>
            </div>
          </div>
        </div>
      </nav>

      {/* User profile */}
      <div className="p-4 border-t border-white/[0.05]">
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-all duration-200 group cursor-default">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-none">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-600 truncate mt-0.5">{user?.email || ''}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        <button
          onClick={logout}
          className="w-full mt-2 flex items-center justify-center gap-2 py-2 text-[11px] font-medium text-slate-600 hover:text-rose-400 hover:bg-rose-500/5 rounded-xl transition-all duration-200 border border-transparent hover:border-rose-500/10"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── MOBILE TOP BAR ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 flex items-center justify-between px-5 bg-[#080C14]/90 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Mic2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-extrabold text-white tracking-tight">EchoMind</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2.5 text-slate-400 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* ── MOBILE DRAWER ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[260px] bg-[#0F1623] border-r border-white/[0.06] shadow-2xl"
            >
              <div className="h-16 flex items-center justify-end px-4 border-b border-white/[0.05]">
                <button onClick={() => setMobileOpen(false)} className="p-2 text-slate-500 hover:text-white rounded-xl transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="h-[calc(100%-4rem)] overflow-hidden">
                <SidebarContent />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex fixed top-0 left-0 h-full w-[260px] z-40 flex-col bg-[#0A0F1C] border-r border-white/[0.05] shadow-xl">
        <SidebarContent />
      </aside>
    </>
  );
};
