// ============================================================
   ECHOMIND CHROME EXTENSION — SERVICE WORKER
   ============================================================

// Ensure storage states are initialized on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isRecording: false,
    meetingTitle: '',
    recordingStartTime: null,
    activeTabId: null,
    uploadStatus: 'idle',
    uploadError: null
  });
  console.log('[EchoMind Background] Extension installed and initialized.');
});

// Listener for messages from popup, content scripts, and offscreen
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  if (message.type === 'SYNC_AUTH') {
    chrome.storage.local.set({
      echomind_token: message.token,
      user_profile: message.user,
      api_url: message.apiUrl
    });
    console.log('[EchoMind Background] Auth credentials synchronized.');
    sendResponse({ success: true });
  }

  else if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['echomind_token', 'user_profile', 'api_url']);
    console.log('[EchoMind Background] Auth credentials cleared.');
    sendResponse({ success: true });
  }

  else if (message.type === 'GET_RECORDING_STATUS') {
    chrome.storage.local.get(['isRecording', 'recordingStartTime'], (data) => {
      sendResponse({
        isRecording: data.isRecording || false,
        startTime: data.recordingStartTime
      });
    });
    return true; // Keep channel open for async response
  }

  else if (message.type === 'START_RECORDING') {
    handleStartRecording(message.title, message.tabId, message.streamId)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message || 'Failed to start recording.' }));
    return true;
  }

  else if (message.type === 'STOP_RECORDING') {
    handleStopRecording()
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message || 'Failed to stop recording.' }));
    return true;
  }

  // Confirmations from Offscreen Document
  else if (message.type === 'RECORDING_STARTED_CONFIRM') {
    chrome.storage.local.set({ isRecording: true, recordingStartTime: Date.now() });
    console.log('[EchoMind Background] Audio recording confirms active.');
  }

  else if (message.type === 'RECORDING_FAILED') {
    console.error('[EchoMind Background] Recording failed:', message.error);
    cleanupRecordingState();
    chrome.storage.local.set({ uploadError: 'Recording failed: ' + message.error });
    closeOffscreenDocument();
  }

  else if (message.type === 'UPLOAD_STAGE_CHANGE') {
    chrome.storage.local.set({ uploadStatus: message.stage });
    console.log('[EchoMind Background] Upload stage changed:', message.stage);
  }

  else if (message.type === 'UPLOAD_COMPLETE') {
    console.log('[EchoMind Background] Upload complete. Meeting ID:', message.meeting.id);
    
    // Clear recording state
    cleanupRecordingState();
    
    // Notify user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'EchoMind Transcription Complete!',
      message: `"${message.meeting.title}" is ready on your dashboard.`
    });

    closeOffscreenDocument();
  }

  else if (message.type === 'UPLOAD_FAILED') {
    console.error('[EchoMind Background] Upload failed:', message.error);
    cleanupRecordingState();
    chrome.storage.local.set({ uploadError: 'Upload failed: ' + message.error });
    closeOffscreenDocument();
  }

  return true;
});

// Helper for starting offscreen record capture
async function handleStartRecording(title, tabId, streamId) {
  let targetTabId = tabId;
  let targetStreamId = streamId;

  if (!targetStreamId) {
    throw new Error('Tab capture stream ID is missing.');
  }
  
  // If tabId was not passed, query the active tab in current window
  if (!targetTabId) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      targetTabId = tabs[0].id;
    }
  }

  // Open offscreen document if not exists
  await createOffscreenDocument();

  // Save details in local storage
  await chrome.storage.local.set({
    meetingTitle: title,
    activeTabId: targetTabId,
    uploadStatus: 'idle',
    uploadError: null
  });

  // Instruct offscreen document to begin recording
  await chrome.runtime.sendMessage({
    type: 'START_RECORDING',
    streamId: targetStreamId,
    title: title
  });
}

// Helper for stopping offscreen record capture
async function handleStopRecording() {
  chrome.storage.local.set({ uploadStatus: 'uploading' });
  
  // Send stop command to offscreen
  await chrome.runtime.sendMessage({ type: 'STOP_RECORDING' });
}

// State cleanups
function cleanupRecordingState() {
  chrome.storage.local.set({
    isRecording: false,
    recordingStartTime: null,
    activeTabId: null,
    uploadStatus: 'idle'
  });
}

// Offscreen DOM management
async function createOffscreenDocument() {
  if (await hasOffscreenDocument()) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['userMedia', 'audioPlayback'],
    justification: 'Capture tab audio stream to record meeting audio.'
  });
}

async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
    console.log('[EchoMind Background] Offscreen document closed.');
  }
}

async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  for (const client of matchedClients) {
    if (client.url.indexOf(chrome.runtime.getURL('offscreen.html')) !== -1) {
      return true;
    }
  }
  return false;
}
