import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, User, Mic, AlertCircle, X,
  Sparkles, CheckCircle2, Brain, FileText, MessageSquare, Zap
} from 'lucide-react';

const features = [
  { icon: Mic, label: 'Record or Upload', desc: 'Capture meetings via mic or file upload' },
  { icon: Brain, label: 'AI Transcription', desc: 'Groq Whisper converts audio to text instantly' },
  { icon: FileText, label: 'Smart Summary', desc: 'LLaMA extracts insights, actions & decisions' },
  { icon: MessageSquare, label: 'Chat with Meetings', desc: 'Ask questions about any past recording' },
];

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } }
};

export const Auth = () => {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (!email || !password || (!isLogin && !name)) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
    setName(''); setEmail(''); setPassword('');
  };

  return (
    <div className="min-h-screen flex bg-[#080C14]">

      {/* ── LEFT HERO PANEL (desktop only) ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col items-center justify-center p-16">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0E1220] via-[#0B1230] to-[#0D0C1F]" />

        {/* Animated orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-indigo-600/10 blur-[80px] animate-soft-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-purple-600/10 blur-[80px] animate-soft-pulse" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-10 right-10 w-32 h-32 rounded-full bg-indigo-500/5 blur-[40px]" />

        {/* Grid lines overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        {/* Content */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 max-w-sm text-center"
        >
          {/* Logo */}
          <motion.div variants={fadeUp} className="flex flex-col items-center mb-10">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-3xl bg-indigo-600/40 blur-2xl scale-110" />
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl border border-indigo-400/20">
                <Mic className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">EchoMind</h1>
            <div className="flex items-center gap-1.5 mt-2">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-sm text-indigo-300/80 font-medium">AI-Powered Meeting Intelligence</p>
            </div>
          </motion.div>

          {/* Features */}
          <motion.div variants={fadeUp} className="space-y-3 text-left mb-10">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">{label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Footer note */}
          <motion.p variants={fadeUp} className="text-[11px] text-slate-600 leading-relaxed">
            Powered by Groq Whisper & LLaMA 3.3 · Your data stays private
          </motion.p>
        </motion.div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        {/* Mobile ambient glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(99,102,241,0.08),transparent_60%)] lg:hidden" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,rgba(168,85,247,0.05),transparent_60%)] lg:hidden" />

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md z-10"
        >
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 lg:hidden">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-xl shadow-indigo-600/30 border border-indigo-400/20 mb-3">
              <Mic className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold text-white">EchoMind</h2>
            <p className="text-xs text-slate-500 mt-1">AI Meeting Intelligence</p>
          </div>

          {/* Card */}
          <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-white/5">
            {/* Title */}
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white">
                {isLogin ? 'Welcome back' : 'Get started free'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {isLogin ? 'Sign in to your EchoMind workspace' : 'Create your EchoMind account in seconds'}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80 gap-1 mb-6">
              {[['Sign In', true], ['Sign Up', false]].map(([label, loginMode]) => (
                <button key={label} onClick={() => { if (isLogin !== loginMode) toggleMode(); }}
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                    isLogin === loginMode
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}>{label}</button>
              ))}
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  className="overflow-hidden mb-4"
                >
                  <div className="flex items-start gap-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <p className="flex-1">{error}</p>
                    <button onClick={() => setError(null)}><X className="w-3.5 h-3.5 text-rose-400 hover:text-rose-200" /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <AnimatePresence initial={false}>
                {!isLogin && (
                  <motion.div
                    key="name-field"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pb-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Full Name</label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600">
                          <User className="w-4 h-4" />
                        </span>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" required={!isLogin}
                          className="input-field w-full pl-11" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Email Address</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@company.com" required
                    className="input-field w-full pl-11" />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Password</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-600">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    className="input-field w-full pl-11" />
                </div>
              </div>

              <button type="submit" disabled={loading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-200 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Please wait...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>{isLogin ? 'Sign In' : 'Create Account'}</span>
                  </>
                )}
              </button>
            </form>

            {/* Terms note */}
            {!isLogin && (
              <p className="text-[10px] text-slate-600 text-center mt-4 leading-relaxed">
                By creating an account you agree to our Terms of Service and Privacy Policy.
              </p>
            )}
          </div>

          {/* Bottom toggle */}
          <p className="text-center mt-5 text-xs text-slate-600">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={toggleMode} className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
              {isLogin ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
};
