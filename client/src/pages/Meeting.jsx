import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MessageSquare, FileText, ClipboardList, CheckCircle, Send, Play, Pause, Volume2, VolumeX, Calendar, Clock, Sparkles } from 'lucide-react';

export const Meeting = ({ meetingId, onViewChange }) => {
  const { apiFetch } = useAuth();
  const [meeting, setMeeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'action_items' | 'decisions' | 'transcript'
  
  // Chat States
  const [chats, setChats] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Audio Playback States
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Load meeting data
  const loadMeetingDetails = async () => {
    try {
      const data = await apiFetch(`/api/meetings/${meetingId}`);
      setMeeting(data);
      
      // Load chats
      const chatData = await apiFetch(`/api/meetings/${meetingId}/chats`);
      setChats(chatData);
    } catch (err) {
      console.error(err);
      alert('Failed to retrieve meeting details: ' + err.message);
      onViewChange('dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetingDetails();
  }, [meetingId]);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, chatLoading]);

  // Action items local checked state toggling
  const [checkedItems, setCheckedItems] = useState({});
  const toggleCheck = (idx) => {
    setCheckedItems(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // Submit chat question
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const query = chatInput.trim();
    setChatInput('');
    
    // Add user message locally first
    setChats(prev => [...prev, { role: 'user', content: query }]);
    setChatLoading(true);

    try {
      const data = await apiFetch(`/api/meetings/${meetingId}/chats`, {
        method: 'POST',
        body: { message: query }
      });
      // Add assistant response
      setChats(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      console.error(err);
      setChats(prev => [...prev, { role: 'assistant', content: 'Sorry, I failed to process your request. Please check that OpenAI API keys are correctly set.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleScrub = (e) => {
    if (audioRef.current) {
      const seekTime = parseFloat(e.target.value);
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleSpeedCycle = () => {
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.25;
    else if (playbackRate === 1.25) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  // Timer format (e.g. 02:45)
  const formatTime = (secs) => {
    if (isNaN(secs)) return '00:00';
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading meeting AI insights...</p>
      </div>
    );
  }

  if (!meeting) return null;

  // Format helper for duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      {/* Header breadcrumb & title */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => onViewChange('dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">{meeting.title}</h2>
              {meeting.is_mock && (
                <span className="px-2.5 py-0.5 text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full animate-pulse shrink-0">
                  Mock Mode
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-500" />
                {formatDate(meeting.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-500" />
                {formatDuration(meeting.duration_seconds)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Custom Audio Player Card */}
      {meeting.audio_filename && (
        <div className="glass-panel p-5 rounded-3xl border border-white/5 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900/40 relative overflow-hidden">
          {/* Hidden HTML Audio Element */}
          <audio
            ref={audioRef}
            src={`/api/uploads/${meeting.audio_filename}`}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleAudioEnded}
            className="hidden"
          />

          {/* Left Block: Controls & Speed */}
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              className="w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-600/15 transition-all outline-none shrink-0"
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 fill-white ml-0.5" />
              )}
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">Audio Playback</span>
                {/* Dancing Wave Animation */}
                {isPlaying && (
                  <div className="flex items-end gap-[3px] h-3.5 w-6 pb-0.5">
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-dance-1" style={{ height: '4px' }} />
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-dance-2" style={{ height: '8px' }} />
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-dance-3" style={{ height: '6px' }} />
                    <span className="w-0.5 bg-indigo-400 rounded-full animate-dance-4" style={{ height: '10px' }} />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">
                {isPlaying ? 'Streaming Session Audio' : 'Audio Player Paused'}
              </p>
            </div>
          </div>

          {/* Middle Block: Scrubber Progress */}
          <div className="flex-1 flex items-center gap-3 w-full">
            <span className="text-xs font-mono font-medium text-slate-400 w-10 shrink-0 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={audioDuration || 100}
              value={currentTime}
              onChange={handleScrub}
              className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer outline-none transition-all"
            />
            <span className="text-xs font-mono font-medium text-slate-400 w-10 shrink-0">
              {formatTime(audioDuration)}
            </span>
          </div>

          {/* Right Block: Speed & Volume */}
          <div className="flex items-center gap-5 justify-between md:justify-start">
            {/* Speed Multiplier Button */}
            <button
              onClick={handleSpeedCycle}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-mono font-bold border border-slate-700/60 transition-colors shrink-0"
              title="Playback Speed"
            >
              {playbackRate.toFixed(2)}x
            </button>

            {/* Mute and volume */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleMute}
                className="p-2 text-slate-400 hover:text-white bg-slate-800/40 hover:bg-slate-800 rounded-xl border border-slate-800/60 transition-all"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 h-1 accent-indigo-500 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Mock Mode Notice Box */}
      {meeting.is_mock && (
        <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-xs text-amber-400/90 leading-relaxed shadow-sm">
          <strong>Notice:</strong> This meeting was processed in <strong>Mock Mode</strong> because the OpenAI API was unreachable or out of credit quota. A simulated transcript, summary, and action items were generated to keep the application fully testable. Configure a valid OpenAI API key in your <code>.env</code> file to run real transcriptions.
        </div>
      )}

      {/* Main Grid: Details Panel vs Chat Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Side: Summary, Transcripts, Actions (8 cols) */}
        <div className="lg:col-span-8 flex flex-col glass-panel rounded-3xl overflow-hidden border border-white/5 shadow-xl">
          {/* Tabs header */}
          <div className="flex border-b border-slate-800 bg-slate-950/20 overflow-x-auto">
            {[
              { id: 'summary', name: 'AI Summary', icon: Sparkles },
              { id: 'action_items', name: 'Action Items', icon: ClipboardList },
              { id: 'decisions', name: 'Decisions', icon: CheckCircle },
              { id: 'transcript', name: 'Transcript', icon: FileText }
            ].map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold whitespace-nowrap transition-all border-b-2 outline-none ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>

          {/* Tab Content body */}
          <div className="p-6 md:p-8 flex-1 overflow-y-auto max-h-[500px]">
            {activeTab === 'summary' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  Meeting TL;DR
                </h3>
                <p className="text-slate-300 leading-relaxed text-sm bg-slate-900/30 p-5 rounded-2xl border border-slate-800/40">
                  {meeting.summary}
                </p>
              </div>
            )}

            {activeTab === 'action_items' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-400" />
                  Extracts of Action Items
                </h3>
                {meeting.action_items.length === 0 ? (
                  <p className="text-sm text-slate-500">No action items detected in this meeting.</p>
                ) : (
                  <div className="space-y-2.5">
                    {meeting.action_items.map((item, idx) => (
                      <div 
                        key={idx}
                        onClick={() => toggleCheck(idx)}
                        className={`flex items-start gap-3 p-4 bg-slate-950/20 border rounded-2xl cursor-pointer select-none transition-colors ${
                          checkedItems[idx] 
                            ? 'border-emerald-500/30 bg-emerald-500/5 text-slate-400' 
                            : 'border-slate-800/80 hover:border-slate-700 text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!checkedItems[idx]}
                          readOnly
                          className="mt-1 w-4 h-4 accent-emerald-500 text-white rounded border-slate-800"
                        />
                        <span className={`text-sm leading-normal ${checkedItems[idx] ? 'line-through text-slate-500' : ''}`}>
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'decisions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-indigo-400" />
                  Decisions Logged
                </h3>
                {meeting.decisions.length === 0 ? (
                  <p className="text-sm text-slate-500">No major decisions logged from this meeting.</p>
                ) : (
                  <ul className="space-y-3">
                    {meeting.decisions.map((decision, idx) => (
                      <li 
                        key={idx}
                        className="flex items-start gap-3 p-4 bg-slate-900/30 border border-slate-800/50 rounded-2xl text-sm text-slate-300 leading-relaxed"
                      >
                        <span className="flex items-center justify-center w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20 text-xs font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span>{decision}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {activeTab === 'transcript' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  Full Transcript
                </h3>
                <div className="bg-slate-950/40 border border-slate-800/80 p-5 rounded-2xl max-h-[360px] overflow-y-auto">
                  <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">
                    {meeting.transcript || 'No transcript text available.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Chat Panel (4 cols) */}
        <div className="lg:col-span-4 flex flex-col h-[580px] lg:h-auto glass-panel rounded-3xl border border-white/5 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2.5 p-4 border-b border-slate-800 bg-slate-950/20">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Chat with Meeting</h3>
              <p className="text-[10px] text-slate-400 font-medium">Ask questions about this transcript</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/10">
            {chats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="p-3 bg-slate-900 border border-slate-800 text-slate-500 rounded-2xl mb-2">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-semibold text-slate-400">Ask a question</h4>
                <p className="text-[10px] text-slate-500 max-w-[180px] mt-1 leading-normal">
                  "What deadlines were set?" or "Who is assigned to the API task?"
                </p>
              </div>
            ) : (
              chats.map((chat, idx) => {
                const isUser = chat.role === 'user';
                return (
                  <div
                    key={idx}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`px-4 py-2.5 text-xs leading-relaxed max-w-[85%] shadow-sm ${
                        isUser
                          ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-none'
                          : 'bg-slate-850 border border-slate-800 text-slate-200 rounded-2xl rounded-tl-none'
                      }`}
                    >
                      {chat.content}
                    </div>
                  </div>
                );
              })
            )}
            {chatLoading && (
              <div className="flex items-center gap-2 bg-slate-850 border border-slate-800 text-slate-400 px-4 py-2.5 rounded-2xl rounded-tl-none w-fit max-w-[85%] text-xs shadow-sm">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
                </div>
                <span>Thinking...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Form input */}
          <form onSubmit={handleChatSubmit} className="p-3 border-t border-slate-800 bg-slate-950/20">
            <div className="relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask about this meeting..."
                disabled={chatLoading}
                className="w-full pl-4 pr-11 py-3 bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/10 rounded-2xl text-xs text-white placeholder-slate-500 outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || chatLoading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl transition-all"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
