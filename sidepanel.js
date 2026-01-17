/**
 * YouTube Transcript Fetcher - Sidepanel UI
 * Main application logic for the sidebar interface
 */

// ==========================================
// DOM Elements
// ==========================================
const detectBtn = document.getElementById('detectBtn');
const pickerBtn = document.getElementById('pickerBtn');
const videoUrlInput = document.getElementById('videoUrl');
const fetchBtn = document.getElementById('fetchBtn');
const statusDiv = document.getElementById('status');
const optionsToggle = document.getElementById('optionsToggle');
const optionsContent = document.getElementById('optionsContent');
const includeTimestampsCheckbox = document.getElementById('includeTimestamps');
const useTimestampsCheckbox = document.getElementById('useTimestamps');
const timeRange = document.getElementById('timeRange');
const startTimeInput = document.getElementById('startTime');
const endTimeInput = document.getElementById('endTime');
const transcriptSection = document.getElementById('transcriptSection');
const videoInfoDiv = document.getElementById('videoInfo');
const transcriptContent = document.getElementById('transcriptContent');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const downloadDropdown = document.querySelector('.download-dropdown');
const downloadMenu = document.getElementById('downloadMenu');
const downloadOptions = document.querySelectorAll('.download-option');

// Speed Reader DOM Elements
const speedReaderBtn = document.getElementById('speedReaderBtn');
const speedReaderModal = document.getElementById('speedReaderModal');
const closeSpeedReader = document.getElementById('closeSpeedReader');
const wpmInput = document.getElementById('wpmInput');
const wpmDecrease = document.getElementById('wpmDecrease');
const wpmIncrease = document.getElementById('wpmIncrease');
const fontSelect = document.getElementById('fontSelect');
const fontSizeSelect = document.getElementById('fontSizeSelect');
const wordDisplay = document.getElementById('wordDisplay');
const progressBar = document.getElementById('progressBar');
const wordCountDisplay = document.getElementById('wordCount');
const timeRemainingDisplay = document.getElementById('timeRemaining');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const restartBtn = document.getElementById('restartBtn');
const backwardBtn = document.getElementById('backwardBtn');
const forwardBtn = document.getElementById('forwardBtn');

// ==========================================
// State
// ==========================================
let currentTranscript = [];
let videoTitle = '';

// Speed Reader State
let speedReaderWords = [];
let currentWordIndex = 0;
let isPlaying = false;
let speedReaderInterval = null;
let wpm = 200;

// ==========================================
// Event Listeners
// ==========================================
detectBtn.addEventListener('click', detectCurrentTab);
pickerBtn.addEventListener('click', activatePicker);
fetchBtn.addEventListener('click', () => fetchTranscript(videoUrlInput.value.trim()));
videoUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchTranscript(videoUrlInput.value.trim());
});
optionsToggle.addEventListener('click', toggleOptions);
useTimestampsCheckbox.addEventListener('change', toggleTimeRange);
copyBtn.addEventListener('click', copyToClipboard);
downloadBtn.addEventListener('click', toggleDownloadMenu);

// Download format options
downloadOptions.forEach(option => {
  option.addEventListener('click', () => {
    const format = option.dataset.format;
    downloadTranscript(format);
    closeDownloadMenu();
  });
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!downloadDropdown.contains(e.target)) {
    closeDownloadMenu();
  }
});

// Speed Reader Event Listeners
speedReaderBtn.addEventListener('click', openSpeedReader);
closeSpeedReader.addEventListener('click', closeSpeedReaderModal);
playPauseBtn.addEventListener('click', togglePlayPause);
restartBtn.addEventListener('click', restartSpeedReader);
backwardBtn.addEventListener('click', () => skipWords(-10));
forwardBtn.addEventListener('click', () => skipWords(10));
wpmDecrease.addEventListener('click', () => adjustWpm(-25));
wpmIncrease.addEventListener('click', () => adjustWpm(25));
wpmInput.addEventListener('change', handleWpmChange);
fontSelect.addEventListener('change', updateFontFamily);
fontSizeSelect.addEventListener('change', updateFontSize);

// Speed Reader Keyboard Shortcuts
document.addEventListener('keydown', handleSpeedReaderKeyboard);

// Listen for messages from content script (via background)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Sidepanel received message:', message.type);
  if (message.type === 'YOUTUBE_URL_SELECTED') {
    videoUrlInput.value = message.url;
    fetchTranscript(message.url);
    resetPickerButton();
    sendResponse({ received: true });
  } else if (message.type === 'PICKER_CANCELLED') {
    console.log('Picker cancelled - resetting button');
    showStatus('Selection cancelled', 'error');
    resetPickerButton();
    sendResponse({ received: true });
  } else if (message.type === 'PICKER_TIMEOUT') {
    showStatus('Selection timed out', 'error');
    resetPickerButton();
    sendResponse({ received: true });
  }
  return true;
});

// Update transcript display when options change
includeTimestampsCheckbox.addEventListener('change', () => {
  if (currentTranscript.length > 0) displayTranscript();
});
startTimeInput.addEventListener('input', () => {
  if (currentTranscript.length > 0) displayTranscript();
});
endTimeInput.addEventListener('input', () => {
  if (currentTranscript.length > 0) displayTranscript();
});
useTimestampsCheckbox.addEventListener('change', () => {
  if (currentTranscript.length > 0) displayTranscript();
});

// ==========================================
// Core Functions
// ==========================================

function toggleOptions() {
  optionsToggle.classList.toggle('open');
  optionsContent.classList.toggle('open');
}

function toggleTimeRange() {
  timeRange.classList.toggle('visible', useTimestampsCheckbox.checked);
}

function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status visible ${type}`;
}

function hideStatus() {
  statusDiv.className = 'status';
}

function extractVideoId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

async function detectCurrentTab() {
  detectBtn.disabled = true;
  detectBtn.innerHTML = '<span class="loading-spinner"></span> Detecting...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.url) {
      throw new Error('Could not access current tab');
    }

    const videoId = extractVideoId(tab.url);
    if (videoId) {
      videoUrlInput.value = tab.url;
      await fetchTranscript(tab.url);
    } else {
      showStatus('No YouTube video detected on this tab', 'error');
    }
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    detectBtn.disabled = false;
    detectBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4"/>
        <path d="M12 8h.01"/>
      </svg>
      <span>Get from Current Tab</span>
    `;
  }
}

async function activatePicker() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      showStatus('No active tab found', 'error');
      return;
    }

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      showStatus('Cannot use picker on this page', 'error');
      return;
    }

    const response = await chrome.runtime.sendMessage({
      type: 'ACTIVATE_PICKER',
      tabId: tab.id
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to activate picker');
    }

    showStatus('Click on any YouTube video link...', 'loading');

    pickerBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
      <span>Waiting for selection...</span>
    `;
    pickerBtn.disabled = true;

    setTimeout(resetPickerButton, 60000);

  } catch (error) {
    console.error('Picker error:', error);
    showStatus('Picker error: ' + error.message, 'error');
    resetPickerButton();
  }
}

function resetPickerButton() {
  pickerBtn.disabled = false;
  pickerBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
      <path d="M13 13l6 6"/>
    </svg>
    <span>Select Video from Page</span>
  `;
}

async function fetchTranscript(url) {
  const videoId = extractVideoId(url);

  if (!videoId) {
    showStatus('Please enter a valid YouTube URL', 'error');
    return;
  }

  fetchBtn.disabled = true;
  detectBtn.disabled = true;
  fetchBtn.innerHTML = '<span class="loading-spinner"></span>';
  showStatus('Fetching transcript (this may take a few seconds)...', 'loading');
  transcriptSection.classList.add('hidden');

  try {
    // Fetch transcript via background tab (user stays on current page)
    const response = await chrome.runtime.sendMessage({
      type: 'FETCH_TRANSCRIPT',
      videoId: videoId
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to fetch transcript');
    }

    videoTitle = response.data.title;
    currentTranscript = response.data.transcript;

    if (!currentTranscript || currentTranscript.length === 0) {
      throw new Error('No transcript segments found');
    }

    displayTranscript();
    showStatus(`Loaded ${currentTranscript.length} segments (${response.data.trackName})`, 'success');

    setTimeout(hideStatus, 3000);

  } catch (error) {
    console.error('Error:', error);
    showStatus(error.message || 'Failed to fetch transcript', 'error');
  } finally {
    fetchBtn.disabled = false;
    detectBtn.disabled = false;
    fetchBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14"/>
        <path d="M12 5l7 7-7 7"/>
      </svg>
    `;
  }
}

function parseTimestamp(timeStr) {
  if (!timeStr || timeStr.trim() === '') return 0;
  const parts = timeStr.trim().split(':').map(Number);

  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getFilteredTranscript() {
  let filtered = [...currentTranscript];

  if (useTimestampsCheckbox.checked) {
    const startSeconds = parseTimestamp(startTimeInput.value);
    const endSeconds = parseTimestamp(endTimeInput.value) || Infinity;

    filtered = filtered.filter(item => item.start >= startSeconds && item.start <= endSeconds);
  }

  return filtered;
}

function displayTranscript() {
  const filtered = getFilteredTranscript();
  const includeTs = includeTimestampsCheckbox.checked;

  videoInfoDiv.innerHTML = `
    <div class="title">${escapeHtml(videoTitle)}</div>
    <div class="meta">${filtered.length} segments${useTimestampsCheckbox.checked ? ' (filtered)' : ''}</div>
  `;

  transcriptContent.innerHTML = filtered.map(item => {
    if (includeTs) {
      return `<div class="transcript-line">
        <span class="timestamp">${formatTimestamp(item.start)}</span>
        <span class="text">${escapeHtml(item.text)}</span>
      </div>`;
    }
    return `<div class="transcript-line"><span class="text">${escapeHtml(item.text)}</span></div>`;
  }).join('');

  transcriptSection.classList.remove('hidden');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getTranscriptText() {
  const filtered = getFilteredTranscript();
  const includeTs = includeTimestampsCheckbox.checked;

  return filtered.map(item => {
    if (includeTs) return `[${formatTimestamp(item.start)}] ${item.text}`;
    return item.text;
  }).join('\n');
}

async function copyToClipboard() {
  const text = getTranscriptText();

  try {
    await navigator.clipboard.writeText(text);

    copyBtn.classList.add('success');
    copyBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;

    setTimeout(() => {
      copyBtn.classList.remove('success');
      copyBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      `;
    }, 2000);
  } catch (e) {
    showStatus('Failed to copy', 'error');
  }
}

// ==========================================
// Download Functions
// ==========================================

function toggleDownloadMenu() {
  downloadDropdown.classList.toggle('open');
}

function closeDownloadMenu() {
  downloadDropdown.classList.remove('open');
}

function downloadTranscript(format) {
  const filtered = getFilteredTranscript();
  const baseFilename = videoTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50);

  let content, mimeType, extension;

  switch (format) {
    case 'txt':
      content = formatAsTxt(filtered);
      mimeType = 'text/plain';
      extension = 'txt';
      break;
    case 'json':
      content = formatAsJson(filtered);
      mimeType = 'application/json';
      extension = 'json';
      break;
    case 'srt':
      content = formatAsSrt(filtered);
      mimeType = 'text/plain';
      extension = 'srt';
      break;
    case 'vtt':
      content = formatAsVtt(filtered);
      mimeType = 'text/vtt';
      extension = 'vtt';
      break;
    case 'md':
      content = formatAsMarkdown(filtered);
      mimeType = 'text/markdown';
      extension = 'md';
      break;
    case 'csv':
      content = formatAsCsv(filtered);
      mimeType = 'text/csv';
      extension = 'csv';
      break;
    default:
      content = formatAsTxt(filtered);
      mimeType = 'text/plain';
      extension = 'txt';
  }

  const filename = `${baseFilename}_transcript.${extension}`;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatAsTxt(transcript) {
  const includeTs = includeTimestampsCheckbox.checked;
  return transcript.map(item => {
    if (includeTs) return `[${formatTimestamp(item.start)}] ${item.text}`;
    return item.text;
  }).join('\n');
}

function formatAsJson(transcript) {
  const data = {
    title: videoTitle,
    segmentCount: transcript.length,
    transcript: transcript.map(item => ({
      start: item.start,
      duration: item.duration,
      startFormatted: formatTimestamp(item.start),
      text: item.text
    }))
  };
  return JSON.stringify(data, null, 2);
}

function formatAsSrt(transcript) {
  return transcript.map((item, index) => {
    const startTime = formatSrtTimestamp(item.start);
    const endTime = formatSrtTimestamp(item.start + (item.duration || 2));
    return `${index + 1}\n${startTime} --> ${endTime}\n${item.text}\n`;
  }).join('\n');
}

function formatAsVtt(transcript) {
  let vtt = 'WEBVTT\n\n';
  vtt += transcript.map((item, index) => {
    const startTime = formatVttTimestamp(item.start);
    const endTime = formatVttTimestamp(item.start + (item.duration || 2));
    return `${index + 1}\n${startTime} --> ${endTime}\n${item.text}\n`;
  }).join('\n');
  return vtt;
}

function formatAsMarkdown(transcript) {
  let md = `# ${videoTitle}\n\n`;
  md += `**Segments:** ${transcript.length}\n\n`;
  md += `---\n\n`;
  md += `## Transcript\n\n`;

  const includeTs = includeTimestampsCheckbox.checked;
  transcript.forEach(item => {
    if (includeTs) {
      md += `**[${formatTimestamp(item.start)}]** ${item.text}\n\n`;
    } else {
      md += `${item.text}\n\n`;
    }
  });

  return md;
}

function formatAsCsv(transcript) {
  const header = 'Index,Start (seconds),Start (formatted),Duration,Text\n';
  const rows = transcript.map((item, index) => {
    const text = `"${item.text.replace(/"/g, '""')}"`;
    return `${index + 1},${item.start.toFixed(2)},${formatTimestamp(item.start)},${(item.duration || 0).toFixed(2)},${text}`;
  }).join('\n');
  return header + rows;
}

function formatSrtTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function formatVttTimestamp(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

// ==========================================
// Speed Reader Functions
// ==========================================

function openSpeedReader() {
  // Get transcript text and split into words
  const filtered = getFilteredTranscript();
  const fullText = filtered.map(item => item.text).join(' ');
  speedReaderWords = fullText.split(/\s+/).filter(word => word.length > 0);

  if (speedReaderWords.length === 0) {
    showStatus('No words to display', 'error');
    return;
  }

  // Reset state
  currentWordIndex = 0;
  isPlaying = false;
  updatePlayPauseButton();

  // Show modal
  speedReaderModal.classList.remove('hidden');
  speedReaderModal.classList.add('paused');

  // Apply saved settings
  updateFontFamily();
  updateFontSize();

  // Update display
  updateWordDisplay();
  updateProgress();
}

function closeSpeedReaderModal() {
  stopSpeedReader();
  speedReaderModal.classList.add('hidden');
}

function togglePlayPause() {
  if (isPlaying) {
    pauseSpeedReader();
  } else {
    startSpeedReader();
  }
}

function startSpeedReader() {
  if (currentWordIndex >= speedReaderWords.length) {
    currentWordIndex = 0;
  }

  isPlaying = true;
  speedReaderModal.classList.remove('paused');
  updatePlayPauseButton();

  const interval = 60000 / wpm; // milliseconds per word
  speedReaderInterval = setInterval(() => {
    if (currentWordIndex < speedReaderWords.length) {
      updateWordDisplay();
      updateProgress();
      currentWordIndex++;
    } else {
      pauseSpeedReader();
      wordDisplay.textContent = 'Done!';
    }
  }, interval);
}

function pauseSpeedReader() {
  isPlaying = false;
  speedReaderModal.classList.add('paused');
  updatePlayPauseButton();

  if (speedReaderInterval) {
    clearInterval(speedReaderInterval);
    speedReaderInterval = null;
  }
}

function stopSpeedReader() {
  pauseSpeedReader();
  currentWordIndex = 0;
}

function restartSpeedReader() {
  pauseSpeedReader();
  currentWordIndex = 0;
  updateWordDisplay();
  updateProgress();
}

function skipWords(count) {
  currentWordIndex = Math.max(0, Math.min(speedReaderWords.length - 1, currentWordIndex + count));
  updateWordDisplay();
  updateProgress();

  // If playing, restart with new position
  if (isPlaying) {
    pauseSpeedReader();
    startSpeedReader();
  }
}

function adjustWpm(delta) {
  const newWpm = Math.max(50, Math.min(1000, wpm + delta));
  wpm = newWpm;
  wpmInput.value = newWpm;

  // If playing, restart with new speed
  if (isPlaying) {
    pauseSpeedReader();
    startSpeedReader();
  }

  updateProgress();
}

function handleWpmChange() {
  const newWpm = parseInt(wpmInput.value, 10);
  if (!isNaN(newWpm) && newWpm >= 50 && newWpm <= 1000) {
    wpm = newWpm;

    // If playing, restart with new speed
    if (isPlaying) {
      pauseSpeedReader();
      startSpeedReader();
    }

    updateProgress();
  } else {
    wpmInput.value = wpm;
  }
}

function updateFontFamily() {
  wordDisplay.style.fontFamily = fontSelect.value;
}

function updateFontSize() {
  wordDisplay.style.fontSize = fontSizeSelect.value + 'px';
}

function updateWordDisplay() {
  if (currentWordIndex < speedReaderWords.length) {
    const word = speedReaderWords[currentWordIndex];
    wordDisplay.textContent = word;
  }
}

function updateProgress() {
  const total = speedReaderWords.length;
  const current = currentWordIndex;
  const progress = total > 0 ? (current / total) * 100 : 0;

  progressBar.style.width = progress + '%';
  wordCountDisplay.textContent = `${current} / ${total} words`;

  // Calculate time remaining
  const wordsRemaining = total - current;
  const secondsRemaining = Math.ceil((wordsRemaining / wpm) * 60);
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  timeRemainingDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')} remaining`;
}

function updatePlayPauseButton() {
  if (isPlaying) {
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
  } else {
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
  }
}

function handleSpeedReaderKeyboard(e) {
  // Only handle if speed reader is open
  if (speedReaderModal.classList.contains('hidden')) return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      skipWords(-10);
      break;
    case 'ArrowRight':
      e.preventDefault();
      skipWords(10);
      break;
    case 'ArrowUp':
      e.preventDefault();
      adjustWpm(25);
      break;
    case 'ArrowDown':
      e.preventDefault();
      adjustWpm(-25);
      break;
    case 'Escape':
      e.preventDefault();
      closeSpeedReaderModal();
      break;
    case 'KeyR':
      if (!e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        restartSpeedReader();
      }
      break;
  }
}
