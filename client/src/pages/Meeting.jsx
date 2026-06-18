import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward,
  Clock, Calendar, FileText, CheckSquare, MessageSquare, Send,
  ListChecks, Bot, Sparkles, BadgeCheck, Square, Mic
} from 'lucide-react';

const formatTime = (s) => {
  if (isNaN(s) || !isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};
const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
const formatDuration = (s) => {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return m === 0 ? `${sec}s` : `${m}m ${sec > 0 ? ` ${sec}s` : ''}`;
};

const TABS = [
  { id: 'summary',   label: 'Summary',      icon: Sparkles },
  { id: 'actions',   label: 'Action Items', icon: ListChecks },
  { id: 'decisions', label: 'Decisions',    icon: BadgeCheck },
  { id: 'transcript',label: 'Transcript',   icon: FileText },
];

const SPEEDS = [1, 1.25, 1.5, 2];

export const Meeting = ({ meetingId, onViewChange }) => {
  const { apiFetch } = useAuth();
  const [meeting, setMeeting]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('summary');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput]   = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume]         = useState(1);
  const [muted, setMuted]           = useState(false);
  const [speedIdx, setSpeedIdx]     = useState(0);
  const [checkedItems, setCheckedItems] = useState({});

  const audioRef   = useRef(null);
  const chatEndRef = useRef(null);
  const saveTimer  = useRef(null);

  // Load meeting
  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch(`/api/meetings/${meetingId}`);
        if (typeof data.action_items === 'string') {
          try { data.action_items = JSON.parse(data.action_items); } catch { data.action_items = []; }
        }
        if (typeof data.decisions === 'string') {
          try { data.decisions = JSON.parse(data.decisions); } catch { data.decisions = []; }
        }
        setMeeting(data);
        setCheckedItems(typeof data.checked_items === 'object' ? (data.checked_items || {}) : {});
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, [meetingId]);

  // Load chat history
  useEffect(() => {
    if (!meetingId) return;
    apiFetch(`/api/meetings/${meetingId}/chats`).then(d => {
      if (Array.isArray(d)) setChatMessages(d);
    }).catch(() => {});
  }, [meetingId]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime  = () => setCurrentTime(audio.currentTime);
    const onMeta  = () => setAudioDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
    };
  }, [meeting]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else { audio.play(); setIsPlaying(true); }
  };

  const skip = (delta) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioDuration, currentTime + delta));
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const toggleMute = () => {
    setMuted(m => {
      if (audioRef.current) audioRef.current.muted = !m;
      return !m;
    });
  };

  const handleVolumeChange = (v) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  };

  const handleScrub = (v) => {
    setCurrentTime(v);
    if (audioRef.current) audioRef.current.currentTime = v;
  };

  // Checkbox toggle + debounced save
  const toggleCheck = useCallback((idx) => {
    setCheckedItems(prev => {
      const updated = { ...prev, [idx]: !prev[idx] };
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        apiFetch(`/api/meetings/${meetingId}/check`, {
          method: 'PATCH',
          body: { checkedItems: updated }
        }).catch(() => {});
      }, 800);
      return updated;
    });
  }, [meetingId, apiFetch]);

  // Send chat
  const sendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const resp = await apiFetch(`/api/meetings/${meetingId}/chats`, {
        method: 'POST',
        body: { message: msg }
      });
      setChatMessages(prev => [...prev, { role: 'assistant', content: resp.reply || resp.content || '...' }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {[1,2,3].map(i => <div key={i} className="skeleton-line h-20 rounded-2xl" />)}
      </div>
    );
  }

  if (!meeting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="p-4 bg-slate-900/60 rounded-2xl text-slate-600 mb-4 border border-slate-800">
          <Mic className="w-8 h-8" />
        </div>
        <p className="text-slate-400 font-semibold">Meeting not found</p>
        <button onClick={() => onViewChange('dashboard')} className="mt-4 text-xs text-indigo-400 hover:text-indigo-300 underline">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Audio (hidden) */}
      {meeting.audio_filename && (
        <audio ref={audioRef} src={`/api/uploads/${meeting.audio_filename}`} preload="metadata" />
      )}

      {/* ── BACK BUTTON ── */}
      <motion.button
        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
        onClick={() => onViewChange('dashboard')}
        className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-indigo-400 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Dashboard
      </motion.button>

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {meeting.is_mock && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold border border-amber-500/20">
              <Sparkles className="w-3 h-3" /> AI Mock Mode
            </span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">
          {meeting.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 mt-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Calendar className="w-3.5 h-3.5 text-slate-600" />
            {formatDate(meeting.created_at)}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Clock className="w-3.5 h-3.5 text-slate-600" />
            {formatDuration(meeting.duration_seconds)}
          </span>
        </div>
      </motion.div>

      {/* ── AUDIO PLAYER ── */}
      {meeting.audio_filename && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-panel rounded-2xl p-5 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Volume2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-slate-300">Audio Recording</span>
            {/* Dancing wave bars */}
            <div className="flex items-end gap-[2px] ml-2 h-4">
              {[1,2,3,4].map(i => (
                <span key={i}
                  className={`waveform-bar ${isPlaying ? `animate-dance-${i}` : 'h-1'}`}
                  style={{ height: isPlaying ? undefined : '4px' }}
                />
              ))}
            </div>
          </div>

          {/* Scrubber */}
          <div className="mb-3">
            <input type="range" min={0} max={audioDuration || 100} step={0.1} value={currentTime}
              onChange={e => handleScrub(parseFloat(e.target.value))}
              className="w-full h-1.5 appearance-none rounded-full bg-slate-800 cursor-pointer"
              style={{ accentColor: '#6366F1' }}
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => skip(-10)} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="-10s">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={togglePlay}
              className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 transition-all">
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>
            <button onClick={() => skip(10)} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="+10s">
              <SkipForward className="w-4 h-4" />
            </button>
            <button onClick={cycleSpeed}
              className="px-2.5 py-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg transition-all">
              {SPEEDS[speedIdx]}×
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={toggleMute} className="p-1.5 text-slate-500 hover:text-white rounded-lg transition-all">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume}
                onChange={e => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 h-1.5 appearance-none rounded-full bg-slate-800 cursor-pointer"
                style={{ accentColor: '#6366F1' }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TABS ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold rounded-xl transition-all duration-200 ${
                activeTab === id
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* ── TAB CONTENT ── */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}>

          {/* SUMMARY */}
          {activeTab === 'summary' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/5 border-l-4 border-l-indigo-500">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">AI Summary</span>
              </div>
              <p className="text-sm text-slate-300 leading-7">
                {meeting.summary || 'No summary available for this meeting.'}
              </p>
            </div>
          )}

          {/* ACTION ITEMS */}
          {activeTab === 'actions' && (
            <div className="space-y-3">
              {(!meeting.action_items || meeting.action_items.length === 0) ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-sm">No action items found.</div>
              ) : (
                meeting.action_items.map((item, i) => (
                  <div key={i} onClick={() => toggleCheck(i)}
                    className={`glass-panel rounded-xl p-4 flex items-start gap-3 cursor-pointer transition-all duration-200 hover:border-indigo-500/20 ${checkedItems[i] ? 'opacity-60' : ''}`}>
                    <div className={`mt-0.5 p-1 rounded-lg transition-all ${checkedItems[i] ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800/60 text-slate-600 border border-slate-700/50'}`}>
                      <CheckSquare className="w-3.5 h-3.5" />
                    </div>
                    <p className={`text-sm flex-1 leading-relaxed transition-all ${checkedItems[i] ? 'line-through text-slate-600' : 'text-slate-300'}`}>{item}</p>
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-900/60 px-2 py-1 rounded-lg shrink-0">#{i + 1}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* DECISIONS */}
          {activeTab === 'decisions' && (
            <div className="space-y-3">
              {(!meeting.decisions || meeting.decisions.length === 0) ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-sm">No decisions recorded.</div>
              ) : (
                meeting.decisions.map((d, i) => (
                  <div key={i} className="glass-panel rounded-xl p-4 flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0 mt-0.5">
                      <BadgeCheck className="w-4 h-4" />
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed flex-1">{d}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TRANSCRIPT */}
          {activeTab === 'transcript' && (
            <div className="glass-panel rounded-2xl p-6 border border-white/5">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Full Transcript</span>
              </div>
              <div className="max-h-96 overflow-y-auto pr-2">
                <p className="text-sm text-slate-400 leading-8 font-mono whitespace-pre-wrap">
                  {meeting.transcript || 'No transcript available.'}
                </p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── CHAT PANEL ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
        className="glass-panel rounded-2xl border border-white/5 overflow-hidden">

        {/* Chat Header */}
        <div className="flex items-center gap-3 p-5 border-b border-white/[0.05]">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Ask AI About This Meeting</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Powered by LLaMA 3.3 · Grounded in your transcript</p>
          </div>
        </div>

        {/* Messages */}
        <div className="h-72 overflow-y-auto p-5 space-y-4">
          {chatMessages.length === 0 && !chatLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-2">
              <MessageSquare className="w-6 h-6 text-slate-700" />
              <p className="text-xs text-slate-600">Ask anything about this meeting — action items, decisions, who said what...</p>
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5" />
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-sm'
                  : 'bg-slate-900/80 text-slate-300 border border-slate-800 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {chatLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="bg-slate-900/80 border border-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                {[0,1,2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-white/[0.05] p-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
              placeholder="Ask about this meeting..."
              className="input-field flex-1 text-xs"
              disabled={chatLoading}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 text-white rounded-xl shadow-lg shadow-indigo-600/20 transition-all disabled:cursor-not-allowed">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
