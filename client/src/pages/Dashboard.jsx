import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileAudio, Calendar, Clock, Trash2, ChevronRight, Mic, AlertCircle, FileText } from 'lucide-react';
import { VoiceRecorder } from '../components/VoiceRecorder';

export const Dashboard = ({ onViewChange }) => {
  const { apiFetch } = useAuth();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Upload states
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // 'uploading' | 'transcribing' | 'summarizing' | null
  const [uploadError, setUploadError] = useState(null);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'record'
  
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

  useEffect(() => {
    fetchMeetings();
  }, []);

  // Format helper for duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Format date helper
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // File Drag-Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    setUploadError(null);
    if (!selectedFile) return;

    // Check size limit: 25MB
    const maxSize = 25 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setUploadError('Audio file is too large. OpenAI Whisper has a 25MB size limit.');
      setFile(null);
      return;
    }

    // Check file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 'audio/m4a', 'audio/webm', 'video/mp4'];
    // Some browsers don't provide mime type for wav/m4a, so verify extensions as fallback
    const extension = selectedFile.name.split('.').pop().toLowerCase();
    const validExtensions = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'];
    
    if (!validTypes.includes(selectedFile.type) && !validExtensions.includes(extension)) {
      setUploadError('Invalid audio file type. Supported formats: mp3, wav, m4a, ogg, webm.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    if (!title) {
      // Auto fill title based on file name (removing extension)
      const cleanName = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(cleanName.substring(0, 50));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Submit audio for transcription
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploadError(null);
    setUploadProgress('uploading');

    const formData = new FormData();
    formData.append('audio', file);
    formData.append('title', title || 'Untitled Meeting');

    try {
      // Update progress state indicators sequentially for user experience
      const timer1 = setTimeout(() => setUploadProgress('transcribing'), 4000);
      const timer2 = setTimeout(() => setUploadProgress('summarizing'), 12000);

      const response = await apiFetch('/api/meetings/upload', {
        method: 'POST',
        body: formData
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      // Reset Form
      setFile(null);
      setTitle('');
      if (fileInputRef.current) fileInputRef.current.value = '';

      // Reload historical meetings and redirect to new meeting details page!
      await fetchMeetings();
      onViewChange(`meeting-${response.meeting.id}`);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Processing failed. Check your API settings and database.');
    } finally {
      setUploadProgress(null);
    }
  };

  // Submit voice recording blob
  const handleVoiceRecordSubmit = async (audioBlob, recordTitle, durationSeconds) => {
    setUploadError(null);
    setUploadProgress('uploading');

    const formData = new FormData();
    const audioFile = new File([audioBlob], 'recording.webm', { type: audioBlob.type || 'audio/webm' });
    formData.append('audio', audioFile);
    formData.append('title', recordTitle || 'Voice Recording');
    formData.append('duration_seconds', durationSeconds.toString());

    try {
      const timer1 = setTimeout(() => setUploadProgress('transcribing'), 4000);
      const timer2 = setTimeout(() => setUploadProgress('summarizing'), 12000);

      const response = await apiFetch('/api/meetings/upload', {
        method: 'POST',
        body: formData
      });

      clearTimeout(timer1);
      clearTimeout(timer2);

      await fetchMeetings();
      onViewChange(`meeting-${response.meeting.id}`);
    } catch (err) {
      console.error(err);
      setUploadError(err.message || 'Processing failed. Check your API settings and database.');
    } finally {
      setUploadProgress(null);
    }
  };

  // Delete handler
  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent card navigation
    if (!confirm('Are you sure you want to delete this meeting? This will erase all transcript details and chat logs.')) return;

    try {
      await apiFetch(`/api/meetings/${id}/delete`, { method: 'POST' });
      setMeetings(meetings.filter(m => m.id !== id));
    } catch (err) {
      alert('Failed to delete meeting: ' + err.message);
    }
  };

  // Calculate stat cards
  const totalDuration = meetings.reduce((acc, curr) => acc + (curr.duration_seconds || 0), 0);
  const meetingsCount = meetings.length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome & Stats Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Dashboard</h2>
          <p className="text-slate-400 text-sm mt-1">Upload meeting recordings to transcribe and extract AI summaries instantly.</p>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border border-white/5 shadow-lg shadow-black/10">
          <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Meetings</p>
            <p className="text-2xl font-bold text-white mt-1">{meetingsCount}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border border-white/5 shadow-lg shadow-black/10">
          <div className="p-4 bg-purple-500/10 text-purple-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Audio Transcribed</p>
            <p className="text-2xl font-bold text-white mt-1">{formatDuration(totalDuration)}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 border border-white/5 shadow-lg shadow-black/10">
          <div className="p-4 bg-pink-500/10 text-pink-400 rounded-xl">
            <Mic className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">System Status</p>
            <p className="text-sm font-semibold text-emerald-400 mt-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-ping" />
              AI Engines Ready
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Upload & List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Upload Widget */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-3xl border border-white/5 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4">Transcribe New Meeting</h3>
            
            {uploadError && (
              <div className="flex items-start gap-2.5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl mb-4 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Tab switchers */}
            {!uploadProgress && (
              <div className="flex bg-slate-950/40 p-1 rounded-2xl border border-slate-800/80 mb-5 gap-1 select-none">
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 outline-none ${
                    activeTab === 'upload'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('record')}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200 outline-none ${
                    activeTab === 'record'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Record Live
                </button>
              </div>
            )}

            {/* If uploading, show progress screen */}
            {uploadProgress ? (
              <div className="glass-panel p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-indigo-400 capitalize flex items-center gap-1.5 animate-soft-pulse">
                    <span className="w-2.5 h-2.5 bg-indigo-500 rounded-full inline-block animate-ping" />
                    {uploadProgress === 'uploading' && 'Uploading Audio File...'}
                    {uploadProgress === 'transcribing' && 'Transcribing with Groq Whisper...'}
                    {uploadProgress === 'summarizing' && 'Extracting AI Insights & Summary...'}
                  </span>
                  <span className="text-slate-400">Please wait...</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ${
                      uploadProgress === 'uploading' ? 'w-1/4' : 
                      uploadProgress === 'transcribing' ? 'w-2/3' : 'w-[92%]'
                    }`}
                  />
                </div>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Processing time depends on audio length. Large files may take up to a minute to process.
                </p>
              </div>
            ) : (
              // Show forms based on active tab
              activeTab === 'upload' ? (
                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      Meeting Title
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Q3 Product Roadmap Sync"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-900/40 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-2xl text-white placeholder-slate-500 outline-none text-sm transition-all"
                    />
                  </div>

                  {/* Drag & Drop Area */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => uploadProgress === null && fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-3xl text-center cursor-pointer transition-all duration-200 ${
                      dragActive 
                        ? 'border-indigo-500 bg-indigo-500/5' 
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
                    } ${uploadProgress !== null ? 'pointer-events-none opacity-40' : ''}`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="audio/*,video/mp4"
                      className="hidden"
                    />
                    
                    {file ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl">
                          <FileAudio className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-semibold text-white max-w-[200px] truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            setTitle('');
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold mt-2 underline"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="p-3 bg-slate-800/50 text-slate-400 rounded-2xl mb-1">
                          <Upload className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-medium text-white">Drag & drop your recording, or <span className="text-indigo-400 font-semibold">browse</span></p>
                        <p className="text-xs text-slate-500 mt-1">Supports MP3, WAV, M4A, WEBM (Max 25MB)</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={!file}
                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold text-sm rounded-2xl shadow-xl hover:shadow-indigo-600/20 border border-indigo-500/20 transition-all duration-200"
                  >
                    Process Meeting
                  </button>
                </form>
              ) : (
                <VoiceRecorder 
                  onProcessRecording={handleVoiceRecordSubmit}
                  isProcessing={uploadProgress !== null}
                />
              )
            )}
          </div>
        </div>

        {/* Right Side: Historical List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-lg font-bold text-white">Meeting History</h3>
            <span className="text-xs text-slate-400 font-medium">{meetings.length} items</span>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-slate-500">Loading meeting history...</p>
            </div>
          ) : meetings.length === 0 ? (
            <div className="glass-panel p-10 rounded-3xl border border-white/5 flex flex-col items-center text-center">
              <div className="p-4 bg-slate-900/50 rounded-2xl text-slate-500 mb-3 border border-slate-800">
                <FileAudio className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-semibold text-slate-300">No meetings processed yet</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
                Upload your first audio recording on the left to start generating insights.
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[560px] overflow-y-auto pr-1">
              <AnimatePresence>
                {meetings.map((meeting) => (
                  <motion.div
                    key={meeting.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    onClick={() => onViewChange(`meeting-${meeting.id}`)}
                    className="glass-panel glass-panel-hover p-5 rounded-2xl flex items-center justify-between cursor-pointer group"
                  >
                    <div className="space-y-2.5 flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-white text-base group-hover:text-indigo-400 transition-colors truncate">
                          {meeting.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed truncate max-w-xl">
                        {meeting.summary}
                      </p>
                      <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-600" />
                          {formatDate(meeting.created_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          {formatDuration(meeting.duration_seconds)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => handleDelete(e, meeting.id)}
                        className="p-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/10 rounded-xl transition-all"
                        title="Delete Meeting"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <div className="p-2 bg-slate-800/30 text-slate-400 group-hover:text-indigo-400 group-hover:bg-indigo-600/10 border border-slate-800/80 rounded-xl transition-all duration-200">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
