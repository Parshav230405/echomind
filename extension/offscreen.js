// ============================================================
// ECHOMIND CHROME EXTENSION — OFFSCREEN RECORDER
// ============================================================

let mediaRecorder = null;
let audioChunks = [];
let startTime = null;
let title = '';
let authToken = '';
let apiHost = '';

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    startCapture(message.streamId, message.title);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    authToken = message.token;
    apiHost = message.apiUrl;
    stopCapture();
    sendResponse({ success: true });
  }
  return true;
});

async function startCapture(streamId, meetingTitle) {
  audioChunks = [];
  title = meetingTitle || 'Recorded Meeting';
  startTime = Date.now();

  let tabStream = null;
  let micStream = null;
  let audioCtx = null;

  try {
    // 1. Capture stream using tab stream ID (other participants' audio)
    tabStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    // 2. Capture microphone audio stream (user's own voice)
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        },
        video: false
      });
      console.log('[EchoMind Offscreen] Microphone stream captured successfully.');
    } catch (micError) {
      console.warn('[EchoMind Offscreen] Could not capture microphone (will record tab-only):', micError);
    }

    // 3. Set up AudioContext for mixing
    audioCtx = new AudioContext();
    const tabSource = audioCtx.createMediaStreamSource(tabStream);
    
    // Create combined destination stream
    const mixDestination = audioCtx.createMediaStreamDestination();

    // Loopback tab audio to system speakers so the user can still hear the call
    tabSource.connect(audioCtx.destination);
    
    // Connect tab audio to the recorder mix
    tabSource.connect(mixDestination);

    // Connect microphone audio to the recorder mix if available
    if (micStream) {
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(mixDestination);
    }

    // 4. Set up MediaRecorder to capture the mixed stream
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/ogg';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = ''; // Let browser choose
    }

    const mixedStream = mixDestination.stream;
    mediaRecorder = new MediaRecorder(mixedStream, mimeType ? { mimeType } : undefined);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Release all audio tracks
      if (tabStream) {
        tabStream.getTracks().forEach(track => track.stop());
      }
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
      
      // Close Web Audio context
      if (audioCtx && audioCtx.state !== 'closed') {
        await audioCtx.close();
      }

      const durationSeconds = Math.round((Date.now() - startTime) / 1000);
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      // Upload recording to backend
      await uploadAudio(audioBlob, durationSeconds);
    };

    mediaRecorder.start(1000); // 1-second chunks
    
    // Notify background script that recording started successfully
    chrome.runtime.sendMessage({ type: 'RECORDING_STARTED_CONFIRM' });

  } catch (error) {
    console.error('[EchoMind Offscreen] Capture initialization failed:', error);
    
    // Clean up streams if partially initialized
    if (tabStream) tabStream.getTracks().forEach(t => t.stop());
    if (micStream) micStream.getTracks().forEach(t => t.stop());
    if (audioCtx) audioCtx.close();
    
    chrome.runtime.sendMessage({ type: 'RECORDING_FAILED', error: error.message });
  }
}

function stopCapture() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

async function uploadAudio(blob, durationSeconds) {
  chrome.runtime.sendMessage({ type: 'UPLOAD_STAGE_CHANGE', stage: 'uploading' });

  try {
    // 1. Use Auth Token and API URL passed from background page
    const token = authToken;
    const apiUrl = apiHost || 'http://localhost:5000';

    if (!token) {
      throw new Error('User session credentials missing. Please reload extension and refresh tab.');
    }

    // 2. Build FormData
    const formData = new FormData();
    const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
    formData.append('audio', audioFile);
    formData.append('title', title);
    formData.append('duration_seconds', durationSeconds.toString());

    // 3. POST request to dynamic backend server
    const response = await fetch(`${apiUrl}/api/meetings/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Server rejected audio upload.');
    }

    // 4. Notify background script that upload succeeded
    chrome.runtime.sendMessage({ 
      type: 'UPLOAD_COMPLETE', 
      meeting: data.meeting 
    });

  } catch (err) {
    console.error('[EchoMind Offscreen] Upload failed:', err);
    chrome.runtime.sendMessage({ 
      type: 'UPLOAD_FAILED', 
      error: err.message || 'Upload failed.' 
    });
  }
}
