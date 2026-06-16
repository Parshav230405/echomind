import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, LogOut, User, Menu, X, Mic } from 'lucide-react';

export const Sidebar = ({ currentView, onViewChange }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  ];

  const toggleMobileSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleNavClick = (viewId) => {
    onViewChange(viewId);
    setIsOpen(false); // Close mobile menu if open
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#111827] border-r border-gray-800 text-slate-200">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-800/60">
        <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/20">
          <Mic className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h1 className="font-bold text-xl tracking-tight text-white">EchoMind</h1>
          <span className="text-[10px] uppercase font-semibold text-indigo-400 tracking-wider">AI Assistant</span>
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (currentView.startsWith('meeting') && item.id === 'dashboard');
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 border border-indigo-500/30'
                  : 'text-slate-400 hover:bg-gray-800/50 hover:text-slate-100 border border-transparent'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.name}
            </button>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-gray-800/60 bg-gray-950/20">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex items-center justify-center w-10 h-10 bg-indigo-600/10 border border-indigo-500/30 rounded-full text-indigo-400 font-semibold">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name || 'User Profile'}</p>
            <p className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2.5 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-xl transition-colors duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between bg-[#0B0F19] border-b border-gray-800 px-6 py-4 fixed top-0 w-full z-40">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-indigo-500" />
          <span className="font-bold text-lg text-white">EchoMind</span>
        </div>
        <button
          onClick={toggleMobileSidebar}
          className="p-2 text-slate-400 hover:text-white hover:bg-gray-800 rounded-lg border border-gray-800"
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Desktop Sidebar (Permanent) */}
      <aside className="hidden md:block w-64 h-screen fixed top-0 left-0 z-30">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar (Slide-out drawer) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay */}
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={toggleMobileSidebar} />
          
          {/* Drawer Menu */}
          <div className="relative w-72 max-w-xs h-full z-10 flex flex-col shadow-2xl">
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
};
