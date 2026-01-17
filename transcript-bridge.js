// Bridge script - runs in ISOLATED world to receive messages from MAIN world
// and forward them to the background script via chrome.runtime API

window.addEventListener('message', function(event) {
  // Only accept messages from our transcript fetcher
  if (event.source !== window) return;
  if (!event.data || event.data.source !== 'youtube-transcript-fetcher') return;

  const payload = event.data.payload;

  if (payload.type === 'success') {
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPT_RESULT',
      data: payload.data
    });
  } else if (payload.type === 'error') {
    chrome.runtime.sendMessage({
      type: 'TRANSCRIPT_ERROR',
      error: payload.error
    });
  }
});

// Signal that bridge is ready
console.log('[TranscriptBridge] Bridge script loaded and listening');
