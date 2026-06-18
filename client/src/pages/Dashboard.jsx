import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileAudio, Calendar, Clock, Trash2, ChevronRight,
  Mic, AlertCircle, FileText, Zap, TrendingUp, Search,
  BarChart2, Plus, X, Sparkles
} from 'lucide-react';
import { VoiceRecorder } from '../components/VoiceRecorder';

const StatCard = ({ icon: Icon, label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="relative glass-panel rounded-2xl p-5 flex items-center gap-4 overflow-hidden group hover:border-white/10 transition-all duration-300"
  >
    <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${color.bg}`} />
    <div className={`relative z-10 p-3.5 rounded-xl ${color.icon} border ${color.border}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="relative z-10">
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5 tracking-tight">{value}</p>
    </div>
  </motion.div>
);

const MeetingCard = ({ meeting, onView, onDelete, index }) => {
  const formatDuration = (s) => {
    if (!s) return '—';
    const m = Math.floor(s / 60), sec = s % 60;
    return m === 0 ? `${sec}s` : `${m}m ${sec}s`;
  };
  const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={() => onView(`meeting-${meeting.id}`)}
      className="glass-panel rounded-2xl p-5 cursor-pointer group hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            <h4 className="font-semibold text-white text-sm group-hover:text-indigo-300 transition-colors truncate">
              {meeting.title}
            </h4>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 ml-3.5">
            {meeting.summary || 'No summary available.'}
          </p>
          <div className="flex items-center gap-4 mt-3 ml-3.5">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <Calendar className="w-3 h-3" />
              {formatDate(meeting.created_at)}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium">
              <Clock className="w-3 h-3" />
              {formatDuration(meeting.duration_seconds)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(e, meeting.id); }}
            className="p-2 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="p-2 bg-slate-800/60 text-slate-500 group-hover:bg-indigo-600 group-hover:text-white rounded-xl transition-all duration-200">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const Dashboard = ({ onViewChange }) => {
  const { apiFetch, user } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [search, setSearch] = useState('');
  const fileInputRef = useRef(null);

  const fetchMeetings = async () => {
    try {
      const data = await apiFetch('/api/meetings');
      setMeetings(data);
    } catch (err) {
      console.error('Failed to load meetings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMeetings(); }, []);

  const formatDuration = (s) => {
    if (!s) return '0s';
    const m = Math.floor(s / 60), sec = s % 60;
    return m === 0 ? `${sec}s` : `${m}m ${sec}s`;
  };

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const validateAndSetFile = (f) => {
    setUploadError(null);
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { setUploadError('File exceeds 25MB limit.'); return; }
    const validExts = ['mp3','mp4','mpeg','mpga','m4a','wav','webm','ogg'];
    const ext = f.name.split('.').pop().toLowerCase();
    if (!validExts.includes(ext)) { setUploadError('Unsupported format. Use MP3, WAV, M4A, WEBM.'); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^/.]+$/, '').substring(0, 60));
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const processFormData = async (formData) => {
    setUploadError(null);
    setUploadProgress('uploading');
    const t1 = setTimeout(() => setUploadProgress('transcribing'), 4000);
    const t2 = setTimeout(() => setUploadProgress('summarizing'), 13000);
    try {
      const resp = await apiFetch('/api/meetings/upload', { method: 'POST', body: formData });
      clearTimeout(t1); clearTimeout(t2);
      setFile(null); setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchMeetings();
      onViewChange(`meeting-${resp.meeting.id}`);
    } catch (err) {
      clearTimeout(t1); clearTimeout(t2);
      setUploadError(err.message || 'Processing failed.');
    } finally { setUploadProgress(null); }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('audio', file);
    fd.append('title', title || 'Untitled Meeting');
    await processFormData(fd);
  };

  const handleVoiceRecordSubmit = async (blob, recTitle, dur) => {
    const fd = new FormData();
    fd.append('audio', new File([blob], 'recording.webm', { type: blob.type || 'audio/webm' }));
    fd.append('title', recTitle || 'Voice Recording');
    fd.append('duration_seconds', dur.toString());
    await processFormData(fd);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('Delete this meeting and all its data?')) return;
    try {
      await apiFetch(`/api/meetings/${id}/delete`, { method: 'POST' });
      setMeetings(m => m.filter(x => x.id !== id));
    } catch (err) { alert('Delete failed: ' + err.message); }
  };

  const filtered = meetings.filter(m =>
    m.title?.toLowerCase().includes(search.toLowerCase()) ||
    m.summary?.toLowerCase().includes(search.toLowerCase())
  );

  const totalDuration = meetings.reduce((a, m) => a + (m.duration_seconds || 0), 0);

  const progressStages = {
    uploading:   { label: 'Uploading audio file...', pct: 'w-1/4' },
    transcribing:{ label: 'Transcribing with Groq Whisper...', pct: 'w-2/3' },
    summarizing: { label: 'Generating AI insights...', pct: 'w-[92%]' },
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">

      {/* ── Header ── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <p className="text-sm text-slate-400">
            Welcome back, <span className="font-semibold text-white">{user?.name?.split(' ')[0] || 'there'}</span>
          </p>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight mt-2">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Transcribe, summarize and chat with your meeting recordings.</p>
      </motion.div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Total Meetings" value={meetings.length} color={{ bg: 'bg-indigo-500/5', icon: 'bg-indigo-500/10 text-indigo-400', border: 'border-indigo-500/20' }} delay={0.1} />
        <StatCard icon={Clock} label="Audio Transcribed" value={formatDuration(totalDuration)} color={{ bg: 'bg-purple-500/5', icon: 'bg-purple-500/10 text-purple-400', border: 'border-purple-500/20' }} delay={0.15} />
        <StatCard icon={Zap} label="AI Status" value={<span className="text-emerald-400 text-lg">Operational</span>} color={{ bg: 'bg-emerald-500/5', icon: 'bg-emerald-500/10 text-emerald-400', border: 'border-emerald-500/20' }} delay={0.2} />
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left: Upload / Record Panel */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="lg:col-span-5">
          <div className="glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-2xl">
            {/* Panel Header */}
            <div className="p-6 pb-0">
              <div className="flex items-center gap-2 mb-5">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h2 className="text-base font-bold text-white">Transcribe Meeting</h2>
              </div>

              {/* Error */}
              <AnimatePresence>
                {uploadError && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="flex items-start gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-5 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                    <span>{uploadError}</span>
                    <button onClick={() => setUploadError(null)} className="ml-auto text-rose-400 hover:text-rose-200"><X className="w-3.5 h-3.5" /></button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tab Switcher */}
              {!uploadProgress && (
                <div className="flex p-1 bg-slate-950/60 rounded-2xl border border-slate-800/80 gap-1 mb-6">
                  {[['upload','Upload File',Upload],['record','Record Live',Mic]].map(([id, label, Icon]) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold rounded-xl transition-all duration-200 ${
                        activeTab === id
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/20'
                          : 'text-slate-500 hover:text-slate-300'
                      }`}>
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 pb-6">
              {/* Processing Progress */}
              {uploadProgress ? (
                <div className="p-5 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 space-y-4">
                  <div className="flex justify-between items-center text-xs font-semibold">
                    <span className="text-indigo-400 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                      {progressStages[uploadProgress]?.label}
                    </span>
                    <span className="text-slate-500">Please wait...</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ${progressStages[uploadProgress]?.pct}`} />
                  </div>
                  <p className="text-[10px] text-slate-600 leading-relaxed">This may take up to a minute for long recordings.</p>
                </div>
              ) : activeTab === 'upload' ? (
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5">Meeting Title</label>
                    <input
                      type="text" value={title} onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Q3 Strategy Review"
                      className="input-field w-full" />
                  </div>
                  {/* Drop Zone */}
                  <div onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200 text-center ${
                      dragActive ? 'border-indigo-500 bg-indigo-500/5 scale-[1.01]' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-900/20'
                    }`}>
                    <input type="file" ref={fileInputRef} onChange={e => e.target.files?.[0] && validateAndSetFile(e.target.files[0])} accept="audio/*,video/mp4" className="hidden" />
                    {file ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                          <FileAudio className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-semibold text-white truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button type="button" onClick={e => { e.stopPropagation(); setFile(null); setTitle(''); }}
                          className="text-xs text-rose-400 hover:text-rose-300 font-medium underline mt-1">Remove</button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-slate-800/60 text-slate-400 rounded-xl mb-1 border border-slate-700/50">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-slate-300">Drop audio here or <span className="text-indigo-400 font-semibold">browse</span></p>
                        <p className="text-[11px] text-slate-600">MP3, WAV, M4A, WEBM · Max 25MB</p>
                      </div>
                    )}
                  </div>
                  <button type="submit" disabled={!file}
                    className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-2xl shadow-lg shadow-indigo-600/20 transition-all duration-200 flex items-center justify-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Process & Transcribe
                  </button>
                </form>
              ) : (
                <VoiceRecorder onProcessRecording={handleVoiceRecordSubmit} isProcessing={uploadProgress !== null} />
              )}
            </div>
          </div>
        </motion.div>

        {/* Right: Meeting History */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.25 }} className="lg:col-span-7 space-y-4">
          {/* List Header */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <h2 className="text-base font-bold text-white">Meeting History</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">{meetings.length} session{meetings.length !== 1 ? 's' : ''} recorded</p>
            </div>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search meetings..." 
                className="pl-9 pr-4 py-2.5 bg-slate-900/60 border border-slate-800 focus:border-slate-700 rounded-xl text-xs text-white placeholder-slate-600 outline-none transition-all w-full sm:w-52" />
            </div>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="glass-panel rounded-2xl p-5 space-y-3">
                  <div className="skeleton-line h-4 w-3/4 rounded-lg" />
                  <div className="skeleton-line h-3 w-full rounded-lg" />
                  <div className="skeleton-line h-3 w-1/2 rounded-lg" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass-panel rounded-3xl p-12 flex flex-col items-center text-center border-dashed">
              <div className="p-4 bg-slate-900/80 rounded-2xl text-slate-600 mb-4 border border-slate-800">
                <BarChart2 className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-slate-400 mb-1">
                {search ? 'No matches found' : 'No meetings yet'}
              </h3>
              <p className="text-xs text-slate-600 max-w-xs">
                {search ? 'Try a different search term.' : 'Upload or record your first meeting to see AI-powered summaries here.'}
              </p>
              {!search && (
                <button onClick={() => setActiveTab('record')}
                  className="mt-5 flex items-center gap-2 px-4 py-2.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-400 text-xs font-semibold rounded-xl transition-all">
                  <Plus className="w-3.5 h-3.5" />
                  Record your first meeting
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1 -mr-1">
              <AnimatePresence>
                {filtered.map((m, i) => (
                  <MeetingCard key={m.id} meeting={m} index={i} onView={onViewChange} onDelete={handleDelete} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};
