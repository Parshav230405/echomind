import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Play, Pause, RotateCcw, Upload, AlertCircle, Volume2, VolumeX } from 'lucide-react';

export const VoiceRecorder = ({ onProcessRecording, isProcessing }) => {
  const [recordState, setRecordState] = useState('idle'); // 'idle' | 'recording' | 'paused' | 'stopped'
  const [duration, setDuration] = useState(0); // in seconds
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);

  // Playback preview states
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  // Refs for audio recording
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const streamRef = useRef(null);

  // Refs for Web Audio API visualizer
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(null);
  const sourceRef = useRef(null);

  // Refs for preview playback
  const previewAudioRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      cleanupRecording();
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const cleanupRecording = () => {
    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    // Stop microphone tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // Close AudioContext
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close();
    }
  };

  // Start recording
  const startRecording = async () => {
    setError(null);
    audioChunksRef.current = [];
    setDuration(0);

    try {
      // 1. Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 2. Set up Web Audio API visualizer
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256; // 128 data bins
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      // 3. Set up MediaRecorder
      // Choose container format supported by Whisper
      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/ogg';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = ''; // Let browser choose
      }

      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);

        // Pre-fill a default title using current date/time
        const now = new Date();
        const dateStr = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        setTitle(`Meeting Session - ${dateStr}, ${timeStr}`);
        setRecordState('stopped');
      };

      // 4. Start recording and animations
      mediaRecorder.start(250); // Slice data every 250ms
      setRecordState('recording');
      
      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);

      // Start canvas visualization
      visualize();
    } catch (err) {
      console.error('Microphone access error:', err);
      setError('Could not access microphone. Please allow permissions and try again.');
    }
  };

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordState('paused');
      clearInterval(timerIntervalRef.current);
      if (audioCtxRef.current) {
        audioCtxRef.current.suspend();
      }
    }
  };

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordState('recording');
      timerIntervalRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      if (audioCtxRef.current) {
        audioCtxRef.current.resume();
      }
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && (recordState === 'recording' || recordState === 'paused')) {
      mediaRecorderRef.current.stop();
      cleanupRecording();
    }
  };

  // Reset/Discard and start over
  const discardRecording = () => {
    // Stop preview playback if running
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      setIsPlaying(false);
    }
    
    // Revoke blob url to release memory
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setRecordState('idle');
    setAudioBlob(null);
    setAudioUrl('');
    setDuration(0);
    setTitle('');
    setPreviewTime(0);
    setPreviewDuration(0);
    setError(null);
  };

  // Canvas visualizer loop
  const visualize = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const canvasCtx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!canvasCtx || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      // Check if we are still recording/paused
      if (recordState !== 'recording' && recordState !== 'paused') {
        return;
      }

      animationFrameRef.current = requestAnimationFrame(draw);

      // Fetch frequency spectrum
      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;

      // Clear with very light transparency for a slight motion trail effect
      canvasCtx.clearRect(0, 0, width, height);

      // Render configuration
      const barWidth = 3;
      const gap = 3;
      const barCount = Math.floor(width / (barWidth + gap)) - 4;
      const centerIndex = Math.floor(barCount / 2);

      // Symmetrical bar drawing
      for (let i = 0; i < barCount; i++) {
        // Map bar index to frequency array (mirrored around center)
        const distanceFromCenter = Math.abs(i - centerIndex);
        const dataIndex = Math.floor((distanceFromCenter / centerIndex) * (bufferLength * 0.7)); // Focus on speech frequencies
        
        let value = dataArray[dataIndex] || 0;
        
        // If paused or silent, show minimal breathing line
        if (recordState === 'paused') {
          value = 5 + Math.sin(Date.now() * 0.005 + i) * 2;
        } else {
          // Add a baseline so visualizer never looks completely dead
          value = Math.max(value, 4);
        }

        // Scale bar height to fit canvas
        const barHeight = (value / 255) * (height * 0.75);

        // Compute bar positioning (symmetrical left/right distribution)
        const x = i * (barWidth + gap) + gap * 2;
        const y = (height - barHeight) / 2;

        // Visual gradients
        const gradient = canvasCtx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#A855F7'); // Purple
        gradient.addColorStop(0.5, '#6366F1'); // Indigo
        gradient.addColorStop(1, '#EC4899'); // Pink

        canvasCtx.fillStyle = gradient;
        
        // Add premium glow
        canvasCtx.shadowBlur = recordState === 'recording' && value > 10 ? 8 : 0;
        canvasCtx.shadowColor = 'rgba(99, 102, 241, 0.4)';

        // Draw rounded bars
        drawRoundedRect(canvasCtx, x, y, barWidth, barHeight, 1.5);
      }
    };

    draw();
  };

  // Helper for drawing rounded bars
  const drawRoundedRect = (ctx, x, y, width, height, radius) => {
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.lineTo(x, y + height - radius);
    ctx.arcTo(x, y + height, x + radius, y + height, radius);
    ctx.lineTo(x + width - radius, y + height);
    ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    ctx.lineTo(x + width, y + radius);
    ctx.arcTo(x + width, y, x + width - radius, y, radius);
    ctx.lineTo(x + radius, y);
    ctx.arcTo(x, y, x, y + radius, radius);
    ctx.fill();
  };

  // Timer format (e.g. 02:45)
  const formatTime = (secs) => {
    const minutes = Math.floor(secs / 60);
    const seconds = secs % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Custom Preview Player handlers
  const handlePlayPause = () => {
    if (!previewAudioRef.current) return;
    
    if (isPlaying) {
      previewAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      previewAudioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleAudioTimeUpdate = () => {
    if (previewAudioRef.current) {
      setPreviewTime(previewAudioRef.current.currentTime);
    }
  };

  const handleAudioLoadedMetadata = () => {
    if (previewAudioRef.current) {
      setPreviewDuration(previewAudioRef.current.duration);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPreviewTime(0);
    if (previewAudioRef.current) {
      previewAudioRef.current.currentTime = 0;
    }
  };

  const handleScrub = (e) => {
    if (previewAudioRef.current) {
      const seekTime = parseFloat(e.target.value);
      previewAudioRef.current.currentTime = seekTime;
      setPreviewTime(seekTime);
    }
  };

  const toggleMute = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (previewAudioRef.current) {
      previewAudioRef.current.volume = val;
      previewAudioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!audioBlob || !title.trim()) return;
    onProcessRecording(audioBlob, title.trim(), duration);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* IDLE STATE */}
      {recordState === 'idle' && (
        <div className="flex flex-col items-center justify-center p-8 py-10 border border-slate-800/80 rounded-3xl bg-slate-950/20 text-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startRecording}
            className="w-20 h-20 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 border border-indigo-500/30 transition-all cursor-pointer relative group"
          >
            <span className="absolute inset-0 bg-indigo-600 rounded-full group-hover:animate-ping opacity-25" />
            <Mic className="w-8 h-8" />
          </motion.button>
          
          <h4 className="font-bold text-white text-base mt-6">Record Meeting Session</h4>
          <p className="text-slate-400 text-xs mt-2 max-w-[280px] leading-relaxed">
            Record a meeting directly from your browser microphone. Groq Whisper will transcribing details in real time.
          </p>
        </div>
      )}

      {/* RECORDING / PAUSED STATES */}
      {(recordState === 'recording' || recordState === 'paused') && (
        <div className="flex flex-col items-center justify-center p-6 border border-indigo-500/10 rounded-3xl bg-indigo-950/5 relative overflow-hidden">
          {/* Live Wave Visualizer Canvas */}
          <canvas
            ref={canvasRef}
            width={340}
            height={90}
            className="w-full h-[90px] mb-4 pointer-events-none"
          />

          {/* Time & State indicator */}
          <div className="flex items-center gap-2 mb-6 select-none">
            {recordState === 'recording' ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" />
            )}
            <span className="text-2xl font-mono font-bold text-white tracking-wider">
              {formatTime(duration)}
            </span>
            <span className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
              {recordState === 'recording' ? 'Recording' : 'Paused'}
            </span>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-6">
            {recordState === 'recording' ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={pauseRecording}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700/60 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Pause className="w-3.5 h-3.5" />
                  Pause
                </div>
              </motion.button>
            ) : (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={resumeRecording}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold border border-indigo-500/40 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5" />
                  Resume
                </div>
              </motion.button>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={stopRecording}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold border border-rose-500/30 transition-colors shadow-lg shadow-rose-600/10"
            >
              <div className="flex items-center gap-1.5">
                <Square className="w-3.5 h-3.5 fill-white" />
                Finish & Stop
              </div>
            </motion.button>
          </div>
        </div>
      )}

      {/* STOPPED STATE - PLAYBACK PREVIEW & SUBMIT */}
      {recordState === 'stopped' && (
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <h4 className="font-bold text-white text-sm">Review & Process Recording</h4>

          {/* Custom audio playback element */}
          <audio
            ref={previewAudioRef}
            src={audioUrl}
            onTimeUpdate={handleAudioTimeUpdate}
            onLoadedMetadata={handleAudioLoadedMetadata}
            onEnded={handleAudioEnded}
            className="hidden"
          />

          {/* Custom Audio Player UI */}
          <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-4">
              {/* Play Pause */}
              <button
                type="button"
                onClick={handlePlayPause}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              {/* Slider scrubber */}
              <div className="flex-1 space-y-1">
                <input
                  type="range"
                  min={0}
                  max={previewDuration || 100}
                  value={previewTime}
                  onChange={handleScrub}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>{formatTime(Math.round(previewTime))}</span>
                  <span>{formatTime(Math.round(previewDuration))}</span>
                </div>
              </div>

              {/* Mute and volume */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleMute}
                  className="p-1.5 text-slate-400 hover:text-white"
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
                  className="w-12 h-1 accent-indigo-500 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Duration: {formatTime(duration)}</span>
              <span>Audio size: {(audioBlob ? audioBlob.size / (1024 * 1024) : 0).toFixed(2)} MB</span>
            </div>
          </div>

          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Recording Name
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Brainstorming session"
                disabled={isProcessing}
                className="w-full px-4 py-3 bg-slate-900/40 border border-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 rounded-2xl text-white placeholder-slate-500 outline-none text-sm transition-all"
                required
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={discardRecording}
                disabled={isProcessing}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700/60 transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Discard
              </button>

              <button
                type="submit"
                disabled={isProcessing || !title.trim()}
                className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-850 text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {isProcessing ? 'Processing...' : 'Process & Transcribe'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
