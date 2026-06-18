// ============================================================
   ECHOMIND CHROME EXTENSION — POPUP LOGIC
   ============================================================

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const connectionBadge = document.getElementById('connection-badge');
  const authSyncPanel = document.getElementById('auth-sync-panel');
  const controlPanel = document.getElementById('control-panel');
  const openAppBtn = document.getElementById('open-app-btn');
  const viewDashboardLink = document.getElementById('view-dashboard-link');
  
  const avatarLetter = document.getElementById('avatar-letter');
  const userDisplayName = document.getElementById('user-display-name');
  
  const inputsGroup = document.getElementById('inputs-group');
  const meetingTitleInput = document.getElementById('meeting-title');
  const recordTriggerBtn = document.getElementById('record-trigger-btn');
  const recordBtnIcon = document.getElementById('record-btn-icon');
  const recordBtnText = document.getElementById('record-btn-text');
  
  const visualizerAnim = document.getElementById('visualizer-anim');
  const timerVal = document.getElementById('timer-val');
  const statusText = document.getElementById('status-text');

  let timerInterval = null;

  // Initial UI check
  await checkState();

  // Poll state occasionally while popup is open to keep timer and details synced
  const statePoller = setInterval(checkState, 1000);
  window.addEventListener('unload', () => clearInterval(statePoller));

  // Event Listeners
  openAppBtn.addEventListener('click', openAppTab);
  viewDashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    openAppTab();
  });

  recordTriggerBtn.addEventListener('click', async () => {
    const state = await getStorageData(['isRecording', 'meetingTitle']);
    
    if (state.isRecording) {
      // Send stop command
      chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, (response) => {
        if (response && response.error) {
          showStatus(response.error, true);
        } else {
          showStatus('Stopping recording and uploading...', false);
          recordTriggerBtn.disabled = true;
        }
      });
    } else {
      // Validate title
      let title = meetingTitleInput.value.trim();
      if (!title) {
        title = `Meeting - ${new Date().toLocaleDateString()}`;
      }

      // Query active tab to ensure we capture the correct one
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
          showStatus('No active tab found to record.', true);
          return;
        }
        
        const activeTab = tabs[0];
        // Don't record chrome:// system pages
        if (activeTab.url && activeTab.url.startsWith('chrome://')) {
          showStatus('Cannot capture browser system pages.', true);
          return;
        }

        showStatus('Requesting tab capture permissions...', false);

        // Call tabCapture inside the click listener context (user gesture is active!)
        chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id }, (streamId) => {
          if (chrome.runtime.lastError) {
            showStatus('Error capturing tab: ' + chrome.runtime.lastError.message, true);
            console.error('[EchoMind Extension] Tab capture error:', chrome.runtime.lastError);
            return;
          }

          if (!streamId) {
            showStatus('Failed to retrieve tab capture stream ID.', true);
            return;
          }

          // Send start command to service worker, passing the active stream ID
          chrome.runtime.sendMessage({
            type: 'START_RECORDING',
            title: title,
            tabId: activeTab.id,
            streamId: streamId
          }, (response) => {
            if (response && response.error) {
              showStatus(response.error, true);
            } else {
              showStatus('Recording tab audio...', false);
              checkState();
            }
          });
        });
      });
    }
  });

  // Check state and refresh UI
  async function checkState() {
    const data = await getStorageData([
      'echomind_token',
      'user_profile',
      'isRecording',
      'meetingTitle',
      'recordingStartTime'
    ]);

    if (!data.echomind_token) {
      // Not logged in / not synced
      connectionBadge.textContent = 'Disconnected';
      connectionBadge.className = 'badge disconnected';
      authSyncPanel.classList.remove('hidden');
      controlPanel.classList.add('hidden');
      return;
    }

    // Logged in
    connectionBadge.textContent = 'Connected';
    connectionBadge.className = 'badge connected';
    authSyncPanel.classList.add('hidden');
    controlPanel.classList.remove('hidden');

    // Display user profile
    if (data.user_profile) {
      userDisplayName.textContent = data.user_profile.name;
      avatarLetter.textContent = data.user_profile.name.charAt(0).toUpperCase();
    } else {
      userDisplayName.textContent = 'Active Session';
      avatarLetter.textContent = 'E';
    }

    // Recording State UI Adjustments
    if (data.isRecording) {
      inputsGroup.classList.add('hidden');
      visualizerAnim.classList.remove('hidden');
      timerVal.classList.remove('hidden');
      
      recordTriggerBtn.className = 'btn record-btn recording';
      recordBtnText.textContent = 'Stop & Transcribe';
      recordBtnIcon.innerHTML = '<rect x="6" y="6" width="12" height="12" fill="currentColor"/>';
      
      // Calculate and display timer
      if (data.recordingStartTime) {
        const elapsed = Math.floor((Date.now() - data.recordingStartTime) / 1000);
        timerVal.textContent = formatTime(elapsed);
        statusText.textContent = `Recording: "${data.meetingTitle || 'Tab Audio'}"`;
      }
    } else {
      // Reset button if it was disabled/uploading
      if (recordTriggerBtn.disabled && statusText.textContent.includes('transcribing')) {
        // Still uploading in background, keep it disabled
      } else {
        recordTriggerBtn.disabled = false;
        inputsGroup.classList.remove('hidden');
        visualizerAnim.classList.add('hidden');
        timerVal.classList.add('hidden');
        
        recordTriggerBtn.className = 'btn record-btn';
        recordBtnText.textContent = 'Start Recording Tab';
        recordBtnIcon.innerHTML = '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor"/>';
      }
    }

    // Handle background uploading messages
    const uploadStatus = await getStorageData(['uploadStatus', 'uploadError']);
    if (uploadStatus.uploadStatus === 'uploading' || uploadStatus.uploadStatus === 'transcribing') {
      recordTriggerBtn.disabled = true;
      statusText.textContent = uploadStatus.uploadStatus === 'uploading' 
        ? 'Uploading file to server...' 
        : 'Whisper transcribing...';
      visualizerAnim.classList.add('hidden');
      timerVal.classList.add('hidden');
    } else if (uploadStatus.uploadError) {
      showStatus(uploadStatus.uploadError, true);
      // clear error after showing
      chrome.storage.local.remove('uploadError');
    }
  }

  // Helpers
  function openAppTab() {
    chrome.tabs.create({ url: 'http://localhost:3000' });
  }

  function showStatus(msg, isError = false) {
    statusText.textContent = msg;
    statusText.style.color = isError ? 'var(--color-danger)' : 'var(--color-text-secondary)';
  }

  function getStorageData(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
});
