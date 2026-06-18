// ============================================================
   ECHOMIND CHROME EXTENSION — OFFSCREEN RECORDER
   ============================================================

let mediaRecorder = null;
let audioChunks = [];
let startTime = null;
let title = '';

// Listen for messages from background script
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'START_RECORDING') {
    startCapture(message.streamId, message.title);
    sendResponse({ success: true });
  } else if (message.type === 'STOP_RECORDING') {
    stopCapture();
    sendResponse({ success: true });
  }
  return true;
});

async function startCapture(streamId, meetingTitle) {
  audioChunks = [];
  title = meetingTitle || 'Recorded Meeting';
  startTime = Date.now();

  try {
    // 1. Capture stream using tab stream ID
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: streamId
        }
      },
      video: false
    });

    // 2. Playback audio locally so the user can still hear the meeting!
    // (Without this loopback, capturing the tab audio silences it for the user)
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(audioCtx.destination);

    // 3. Set up MediaRecorder
    let mimeType = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'audio/ogg';
    }
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = ''; // Let browser choose
    }

    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Release tracks
      stream.getTracks().forEach(track => track.stop());
      audioCtx.close();

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
    // 1. Fetch Auth Token from storage
    const storage = await chrome.storage.local.get(['echomind_token']);
    const token = storage.echomind_token;

    if (!token) {
      throw new Error('User session not found. Please open EchoMind page and log in.');
    }

    // 2. Build FormData
    const formData = new FormData();
    const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
    formData.append('audio', audioFile);
    formData.append('title', title);
    formData.append('duration_seconds', durationSeconds.toString());

    // 3. POST request to backend server
    const response = await fetch('http://localhost:5000/api/meetings/upload', {
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
