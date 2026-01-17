// Element Picker for YouTube Transcript Fetcher
(function() {
  // Prevent multiple injections
  if (window.__ytTranscriptPickerActive) {
    return;
  }
  window.__ytTranscriptPickerActive = true;

  let highlightedElement = null;
  let overlay = null;
  let tooltip = null;

  // Create overlay for highlighting
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'yt-transcript-picker-overlay';
    overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      border: 3px solid #ff4757;
      background: rgba(255, 71, 87, 0.15);
      border-radius: 4px;
      z-index: 2147483647;
      transition: all 0.1s ease;
      display: none;
    `;
    document.body.appendChild(overlay);

    tooltip = document.createElement('div');
    tooltip.id = 'yt-transcript-picker-tooltip';
    tooltip.style.cssText = `
      position: fixed;
      background: #1a1a2e;
      color: #fff;
      padding: 8px 12px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      z-index: 2147483647;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      display: none;
      max-width: 300px;
      word-break: break-all;
    `;
    document.body.appendChild(tooltip);

    // Add instruction banner
    const banner = document.createElement('div');
    banner.id = 'yt-transcript-picker-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #ff4757 0%, #ff6b7a 100%);
      color: white;
      padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      z-index: 2147483647;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    banner.innerHTML = `
      <span>Click on any YouTube video link or thumbnail to get its transcript</span>
      <span style="margin-left: 15px; opacity: 0.8; font-size: 12px;">Press ESC to cancel</span>
    `;
    document.body.appendChild(banner);
  }

  // YouTube URL patterns
  const youtubePatterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  function extractVideoId(url) {
    if (!url) return null;
    for (const pattern of youtubePatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  function findYouTubeUrl(element) {
    // Check the element itself
    if (element.href) {
      const videoId = extractVideoId(element.href);
      if (videoId) return element.href;
    }

    // Check data attributes
    const dataAttrs = ['data-video-id', 'data-id', 'data-videoid'];
    for (const attr of dataAttrs) {
      const value = element.getAttribute(attr);
      if (value && extractVideoId(value)) {
        return `https://www.youtube.com/watch?v=${value}`;
      }
    }

    // Check for nested anchor tags
    const anchor = element.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]');
    if (anchor && anchor.href) {
      const videoId = extractVideoId(anchor.href);
      if (videoId) return anchor.href;
    }

    // Check parent elements (up to 5 levels)
    let parent = element.parentElement;
    let levels = 0;
    while (parent && levels < 5) {
      if (parent.href) {
        const videoId = extractVideoId(parent.href);
        if (videoId) return parent.href;
      }

      // Check data attributes on parent
      for (const attr of dataAttrs) {
        const value = parent.getAttribute(attr);
        if (value && extractVideoId(value)) {
          return `https://www.youtube.com/watch?v=${value}`;
        }
      }

      // Check for anchor in parent
      const parentAnchor = parent.querySelector('a[href*="youtube.com"], a[href*="youtu.be"]');
      if (parentAnchor && parentAnchor.href) {
        const videoId = extractVideoId(parentAnchor.href);
        if (videoId) return parentAnchor.href;
      }

      parent = parent.parentElement;
      levels++;
    }

    // Check if we're on YouTube and this might be a video element
    if (window.location.hostname.includes('youtube.com')) {
      // Check for video-id in URL or page
      const urlVideoId = extractVideoId(window.location.href);
      if (urlVideoId && element.closest('#movie_player, #player, .html5-video-player, ytd-player')) {
        return window.location.href;
      }
    }

    return null;
  }

  function handleMouseMove(e) {
    const element = document.elementFromPoint(e.clientX, e.clientY);
    if (!element || element === overlay || element === tooltip) return;

    // Don't highlight our own elements
    if (element.id && element.id.startsWith('yt-transcript-picker')) return;

    const youtubeUrl = findYouTubeUrl(element);

    if (youtubeUrl) {
      highlightedElement = element;
      const rect = element.getBoundingClientRect();

      overlay.style.display = 'block';
      overlay.style.left = rect.left + window.scrollX + 'px';
      overlay.style.top = rect.top + window.scrollY + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
      overlay.style.position = 'absolute';

      tooltip.style.display = 'block';
      tooltip.style.left = Math.min(e.clientX + 15, window.innerWidth - 320) + 'px';
      tooltip.style.top = (e.clientY + 15) + 'px';
      tooltip.innerHTML = `<strong style="color: #ff6b7a;">YouTube video found!</strong><br><span style="color: #a1a1aa; font-size: 11px;">${youtubeUrl}</span>`;
    } else {
      highlightedElement = null;
      overlay.style.display = 'none';
      tooltip.style.display = 'none';
    }
  }

  function handleClick(e) {
    e.preventDefault();
    e.stopPropagation();

    if (highlightedElement) {
      const youtubeUrl = findYouTubeUrl(highlightedElement);
      if (youtubeUrl) {
        // Send the URL back to the extension
        chrome.runtime.sendMessage({
          type: 'YOUTUBE_URL_SELECTED',
          url: youtubeUrl
        });
      }
    }

    cleanup();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      chrome.runtime.sendMessage({
        type: 'PICKER_CANCELLED'
      });
      cleanup();
    }
  }

  function cleanup() {
    window.__ytTranscriptPickerActive = false;
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('keydown', handleKeyDown, true);

    const overlay = document.getElementById('yt-transcript-picker-overlay');
    const tooltip = document.getElementById('yt-transcript-picker-tooltip');
    const banner = document.getElementById('yt-transcript-picker-banner');

    if (overlay) overlay.remove();
    if (tooltip) tooltip.remove();
    if (banner) banner.remove();
  }

  // Initialize
  createOverlay();
  document.addEventListener('mousemove', handleMouseMove, true);
  document.addEventListener('click', handleClick, true);
  document.addEventListener('keydown', handleKeyDown, true);

  // Auto-cleanup after 60 seconds
  setTimeout(() => {
    if (window.__ytTranscriptPickerActive) {
      chrome.runtime.sendMessage({
        type: 'PICKER_TIMEOUT'
      });
      cleanup();
    }
  }, 60000);
})();
