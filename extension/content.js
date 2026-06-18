// ============================================================
   ECHOMIND CHROME EXTENSION — CONTENT SCRIPT
   ============================================================

const HOSTNAME = window.location.hostname;

// 1. SYNC AUTH FROM ECHOMIND APP
if (HOSTNAME === 'localhost' || HOSTNAME.includes('echomind')) {
  // Sync on load
  syncAuthWithExtension();

  // Listen for storage events (e.g. login/logout)
  window.addEventListener('storage', (e) => {
    if (e.key === 'echomind_token') {
      syncAuthWithExtension();
    }
  });

  // Periodically check auth sync
  setInterval(syncAuthWithExtension, 5000);
}

function syncAuthWithExtension() {
  const token = localStorage.getItem('echomind_token');
  if (token) {
    // Parse JWT to get user details
    try {
      const payloadBase64 = token.split('.')[1];
      const payload = JSON.parse(atob(payloadBase64));
      
      // Fetch user details from API using token to get name
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          chrome.runtime.sendMessage({
            type: 'SYNC_AUTH',
            token: token,
            user: data.user
          });
        }
      })
      .catch(err => {
        // Fallback to basic payload info if API fetch fails
        chrome.runtime.sendMessage({
          type: 'SYNC_AUTH',
          token: token,
          user: { id: payload.userId, name: 'Active User' }
        });
      });
    } catch (e) {
      console.error('[EchoMind Extension] Error parsing token', e);
    }
  } else {
    // Logged out
    chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' });
  }
}

// 2. INJECT MEETING FLOATING CONTROLLER FOR MEET/ZOOM/TEAMS
const MEETING_DOMAINS = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com'];
const isMeetingSite = MEETING_DOMAINS.some(domain => HOSTNAME.includes(domain));

if (isMeetingSite) {
  let isRecordingLocal = false;
  let timerInterval = null;
  let startTime = null;

  // Poll DOM to detect if actually in a meeting room, not just lobby
  const meetingCheckInterval = setInterval(() => {
    const inMeeting = detectActiveMeeting();
    
    if (inMeeting && !document.getElementById('echomind-floating-trigger')) {
      injectFloatingWidget();
    } else if (!inMeeting && document.getElementById('echomind-floating-trigger')) {
      removeFloatingWidget();
    }

    // Update floating state if changed externally
    if (document.getElementById('echomind-floating-trigger')) {
      syncFloatingWidgetState();
    }
  }, 2000);

  function detectActiveMeeting() {
    if (HOSTNAME.includes('meet.google.com')) {
      // Check for Google Meet call controls
      return !!document.querySelector('[data-call-ended="false"]') ||
             !!document.querySelector('[aria-label="Leave call"]') ||
             !!document.querySelector('[data-meeting-title]');
    }
    if (HOSTNAME.includes('zoom.us')) {
      // Zoom Web Client controls
      return !!document.querySelector('#wc-footer') || 
             !!document.querySelector('.meeting-info-container') ||
             HOSTNAME.includes('/wc/');
    }
    if (HOSTNAME.includes('teams.microsoft.com') || HOSTNAME.includes('teams.live.com')) {
      // Teams Web Client call controls
      return !!document.querySelector('[data-tid="hangup-button"]') ||
             !!document.querySelector('#hangup-button') ||
             !!document.querySelector('.ts-calling-screen');
    }
    return false;
  }

  function injectFloatingWidget() {
    const widget = document.createElement('div');
    widget.id = 'echomind-floating-trigger';
    widget.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 99999;
      background: rgba(15, 22, 35, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 6px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      cursor: pointer;
      user-select: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const statusDot = document.createElement('div');
    statusDot.id = 'em-dot';
    statusDot.style.cssText = `
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: #6366F1;
      transition: background-color 0.3s;
    `;

    const textLabel = document.createElement('span');
    textLabel.id = 'em-text';
    textLabel.textContent = 'Record with EchoMind';
    textLabel.style.cssText = `
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.2px;
    `;

    widget.appendChild(statusDot);
    widget.appendChild(textLabel);
    document.body.appendChild(widget);

    // Hover effects
    widget.addEventListener('mouseenter', () => {
      widget.style.transform = 'translateY(-2px)';
      widget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
    });
    widget.addEventListener('mouseleave', () => {
      widget.style.transform = 'translateY(0)';
      widget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    });

    // Recording Toggle Trigger
    widget.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' }, (status) => {
        if (status.isRecording) {
          // Stop recording
          chrome.runtime.sendMessage({ type: 'STOP_RECORDING' }, () => {
            setUiStopped();
          });
        } else {
          // Start recording
          const meetingTitle = getMeetingTitle();
          chrome.runtime.sendMessage({
            type: 'START_RECORDING',
            title: meetingTitle
          }, (response) => {
            if (response && response.error) {
              alert('EchoMind: ' + response.error);
            } else {
              setUiRecording(Date.now());
            }
          });
        }
      });
    });
  }

  function removeFloatingWidget() {
    const el = document.getElementById('echomind-floating-trigger');
    if (el) el.remove();
    if (timerInterval) clearInterval(timerInterval);
  }

  function getMeetingTitle() {
    const titleEl = document.querySelector('[data-meeting-title]') || 
                    document.querySelector('h1') || 
                    document.querySelector('.meeting-info-container__topic');
    return titleEl?.textContent?.trim() || `Meeting - ${new Date().toLocaleDateString()}`;
  }

  function syncFloatingWidgetState() {
    chrome.runtime.sendMessage({ type: 'GET_RECORDING_STATUS' }, (status) => {
      if (status.isRecording && !isRecordingLocal) {
        setUiRecording(status.startTime);
      } else if (!status.isRecording && isRecordingLocal) {
        setUiStopped();
      }
    });
  }

  function setUiRecording(startedAt) {
    isRecordingLocal = true;
    startTime = startedAt;
    const widget = document.getElementById('echomind-floating-trigger');
    const statusDot = document.getElementById('em-dot');
    const textLabel = document.getElementById('em-text');

    if (!widget || !statusDot || !textLabel) return;

    widget.style.background = 'rgba(244, 63, 94, 0.12)';
    widget.style.borderColor = 'rgba(244, 63, 94, 0.25)';
    widget.style.boxShadow = '0 0 16px rgba(244, 63, 94, 0.15)';
    statusDot.style.backgroundColor = '#F43F5E';
    statusDot.style.boxShadow = '0 0 8px #F43F5E';

    // Add keyframe style if not exists for pulsing
    if (!document.getElementById('em-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'em-pulse-style';
      style.innerHTML = `
        @keyframes em-pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
        .em-pulsing { animation: em-pulse 1.5s infinite; }
      `;
      document.head.appendChild(style);
    }
    statusDot.className = 'em-pulsing';

    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      textLabel.textContent = `EchoMind Recording: ${m}:${s}`;
    }, 1000);
  }

  function setUiStopped() {
    isRecordingLocal = false;
    if (timerInterval) clearInterval(timerInterval);
    
    const widget = document.getElementById('echomind-floating-trigger');
    const statusDot = document.getElementById('em-dot');
    const textLabel = document.getElementById('em-text');

    if (!widget || !statusDot || !textLabel) return;

    widget.style.background = 'rgba(15, 22, 35, 0.85)';
    widget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    widget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
    statusDot.style.backgroundColor = '#6366F1';
    statusDot.style.boxShadow = 'none';
    statusDot.className = '';
    textLabel.textContent = 'Record with EchoMind';
  }
}
