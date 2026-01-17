// Background service worker for YouTube Transcript Fetcher

// Store pending transcript requests
const pendingRequests = new Map();

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Set side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender, sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
  try {
    switch (message.type) {
      case 'ACTIVATE_PICKER':
        const pickerResult = await activatePicker(message.tabId);
        sendResponse(pickerResult);
        break;

      case 'FETCH_TRANSCRIPT':
        // Fetch transcript using a background tab (doesn't disturb user's current page)
        const fetchResult = await fetchTranscriptInBackgroundTab(message.videoId);
        sendResponse(fetchResult);
        break;

      case 'TRANSCRIPT_RESULT':
        // Received from content script - resolve pending request
        const pendingResolve = pendingRequests.get('transcript');
        if (pendingResolve) {
          pendingResolve.resolve({ success: true, data: message.data });
          pendingRequests.delete('transcript');
        }
        sendResponse({ success: true });
        break;

      case 'TRANSCRIPT_ERROR':
        // Received from content script - reject pending request
        const pendingReject = pendingRequests.get('transcript');
        if (pendingReject) {
          pendingReject.resolve({ success: false, error: message.error });
          pendingRequests.delete('transcript');
        }
        sendResponse({ success: true });
        break;

      case 'GET_CURRENT_TAB':
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ success: true, tab });
        break;

      case 'YOUTUBE_URL_SELECTED':
      case 'PICKER_CANCELLED':
      case 'PICKER_TIMEOUT':
        // Forward these messages to the sidepanel
        console.log('Background forwarding message:', message.type);
        chrome.runtime.sendMessage(message)
          .then((response) => {
            console.log('Message forwarded successfully:', response);
          })
          .catch((err) => {
            console.log('Message forward error (sidepanel may not be open):', err);
          });
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Activate the element picker
async function activatePicker(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to inject picker:', error);
    return { success: false, error: error.message };
  }
}

// Fetch transcript by opening YouTube in a BACKGROUND tab
async function fetchTranscriptInBackgroundTab(videoId) {
  let backgroundTab = null;

  try {
    // Create a new tab in the background (not active)
    const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
    backgroundTab = await chrome.tabs.create({
      url: targetUrl,
      active: false  // This keeps the user on their current tab
    });

    // Wait for the tab to finish loading
    await waitForTabLoad(backgroundTab.id);

    // Give YouTube more time to initialize its player data
    // YouTube's JS needs time to set up ytInitialPlayerResponse and ytcfg
    await new Promise(r => setTimeout(r, 3000));

    // First inject the bridge script (ISOLATED world) to listen for messages
    await chrome.scripting.executeScript({
      target: { tabId: backgroundTab.id },
      files: ['transcript-bridge.js']
    });

    // Set up promise to receive result from content script
    const result = await new Promise((resolve) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        pendingRequests.delete('transcript');
        resolve({ success: false, error: 'Transcript fetch timed out' });
      }, 20000);

      // Store resolver
      pendingRequests.set('transcript', {
        resolve: (result) => {
          clearTimeout(timeoutId);
          resolve(result);
        }
      });

      // Inject the transcript fetcher into MAIN world to access page JS context
      chrome.scripting.executeScript({
        target: { tabId: backgroundTab.id },
        files: ['transcript-fetcher.js'],
        world: 'MAIN'  // This allows access to page's JavaScript variables
      }).catch(err => {
        clearTimeout(timeoutId);
        pendingRequests.delete('transcript');
        resolve({ success: false, error: err.message });
      });
    });

    return result;

  } catch (error) {
    console.error('Background tab error:', error);
    return { success: false, error: error.message };
  } finally {
    // Always close the background tab
    if (backgroundTab) {
      try {
        await chrome.tabs.remove(backgroundTab.id);
      } catch (e) {
        // Tab may already be closed
      }
    }
  }
}

// Helper to wait for tab to finish loading
function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, 15000);

    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Check if already complete
    chrome.tabs.get(tabId).then(tab => {
      if (tab.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    });
  });
}
