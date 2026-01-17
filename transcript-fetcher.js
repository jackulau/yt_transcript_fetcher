// Content script to fetch transcript from within YouTube page context
// This runs in MAIN world to access page JavaScript variables

(async function() {
  try {
    const videoId = new URLSearchParams(window.location.search).get('v') ||
                    window.location.pathname.split('/').pop();

    if (!videoId) {
      dispatchResult({ type: 'error', error: 'No video ID found' });
      return;
    }

    // Get video title
    const title = document.querySelector('h1.ytd-video-primary-info-renderer yt-formatted-string')?.textContent?.trim() ||
                  document.querySelector('h1.ytd-watch-metadata yt-formatted-string')?.textContent?.trim() ||
                  document.title.replace(' - YouTube', '').trim() ||
                  'Unknown Video';

    console.log('[TranscriptFetcher] Starting fetch for video:', videoId, 'Title:', title);

    // Method 1: Try to get from ytInitialPlayerResponse captions
    let transcript = await tryGetTranscriptFromPlayerResponse();
    console.log('[TranscriptFetcher] Method 1 (PlayerResponse) result:', transcript ? transcript.length + ' segments' : 'null');

    // Method 2: Try using the innertube API
    if (!transcript || transcript.length === 0) {
      transcript = await tryGetTranscriptFromInnertubeAPI(videoId);
      console.log('[TranscriptFetcher] Method 2 (Innertube) result:', transcript ? transcript.length + ' segments' : 'null');
    }

    // Method 3: Try the get_transcript endpoint
    if (!transcript || transcript.length === 0) {
      transcript = await tryGetTranscriptFromPanel(videoId);
      console.log('[TranscriptFetcher] Method 3 (Panel) result:', transcript ? transcript.length + ' segments' : 'null');
    }

    if (!transcript || transcript.length === 0) {
      throw new Error('No transcript available for this video');
    }

    dispatchResult({
      type: 'success',
      data: {
        title: title,
        transcript: transcript,
        language: 'en',
        trackName: 'English'
      }
    });

  } catch (error) {
    console.error('[TranscriptFetcher] Error:', error);
    dispatchResult({ type: 'error', error: error.message });
  }
})();

// Dispatch result back to content script bridge
function dispatchResult(result) {
  window.postMessage({
    source: 'youtube-transcript-fetcher',
    payload: result
  }, '*');
}

// Method 1: Get transcript from ytInitialPlayerResponse
async function tryGetTranscriptFromPlayerResponse() {
  try {
    const playerResponse = window.ytInitialPlayerResponse;
    console.log('[TranscriptFetcher] ytInitialPlayerResponse exists:', !!playerResponse);

    if (!playerResponse) return null;

    const captions = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    console.log('[TranscriptFetcher] Caption tracks found:', captions?.length || 0);

    if (!captions || captions.length === 0) return null;

    // Find best track - prefer manual English, then auto English, then any English, then first
    let track = captions.find(c => c.languageCode === 'en' && c.kind !== 'asr');
    if (!track) track = captions.find(c => c.languageCode === 'en');
    if (!track) track = captions.find(c => c.languageCode?.startsWith('en'));
    if (!track) track = captions[0];

    console.log('[TranscriptFetcher] Selected track:', track.languageCode, track.kind || 'manual');

    const baseUrl = track.baseUrl;

    // Try JSON format first (more reliable)
    try {
      const jsonUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'fmt=json3';
      console.log('[TranscriptFetcher] Fetching JSON format from:', jsonUrl.substring(0, 100) + '...');

      const jsonResponse = await fetch(jsonUrl);
      if (jsonResponse.ok) {
        const jsonData = await jsonResponse.json();
        console.log('[TranscriptFetcher] JSON response events:', jsonData?.events?.length || 0);

        if (jsonData?.events) {
          const result = parseJson3Transcript(jsonData);
          if (result && result.length > 0) return result;
        }
      }
    } catch (e) {
      console.log('[TranscriptFetcher] JSON format failed:', e.message);
    }

    // Try XML format
    try {
      console.log('[TranscriptFetcher] Fetching XML format');
      const xmlResponse = await fetch(baseUrl);
      if (xmlResponse.ok) {
        const xml = await xmlResponse.text();
        console.log('[TranscriptFetcher] XML response length:', xml.length);

        if (xml && xml.length > 0) {
          const result = parseXmlTranscript(xml);
          if (result && result.length > 0) return result;
        }
      }
    } catch (e) {
      console.log('[TranscriptFetcher] XML format failed:', e.message);
    }

    return null;

  } catch (error) {
    console.log('[TranscriptFetcher] Player response method failed:', error);
    return null;
  }
}

// Method 2: Get transcript via innertube API
async function tryGetTranscriptFromInnertubeAPI(videoId) {
  try {
    const ytcfg = window.ytcfg;
    console.log('[TranscriptFetcher] ytcfg exists:', !!ytcfg);

    if (!ytcfg) return null;

    const apiKey = ytcfg.get?.('INNERTUBE_API_KEY') || ytcfg.data_?.INNERTUBE_API_KEY;
    const clientVersion = ytcfg.get?.('INNERTUBE_CLIENT_VERSION') || ytcfg.data_?.INNERTUBE_CLIENT_VERSION;

    console.log('[TranscriptFetcher] API Key:', apiKey ? 'found' : 'missing');

    if (!apiKey) return null;

    // Get player data
    const response = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: videoId,
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: clientVersion || '2.20240101.00.00',
            hl: 'en',
            gl: 'US'
          }
        }
      })
    });

    const data = await response.json();
    const captions = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    console.log('[TranscriptFetcher] Innertube captions found:', captions?.length || 0);

    if (!captions || captions.length === 0) return null;

    let track = captions.find(c => c.languageCode === 'en' && c.kind !== 'asr');
    if (!track) track = captions.find(c => c.languageCode === 'en');
    if (!track) track = captions.find(c => c.languageCode?.startsWith('en'));
    if (!track) track = captions[0];

    // Fetch with json3 format
    const jsonUrl = track.baseUrl + '&fmt=json3';
    const transcriptResponse = await fetch(jsonUrl);
    const transcriptData = await transcriptResponse.json();

    if (transcriptData?.events) {
      return parseJson3Transcript(transcriptData);
    }

    return null;

  } catch (error) {
    console.log('[TranscriptFetcher] Innertube API method failed:', error);
    return null;
  }
}

// Method 3: Get transcript from YouTube's transcript panel API
async function tryGetTranscriptFromPanel(videoId) {
  try {
    const ytcfg = window.ytcfg;
    if (!ytcfg) return null;

    const apiKey = ytcfg.get?.('INNERTUBE_API_KEY') || ytcfg.data_?.INNERTUBE_API_KEY;
    const clientVersion = ytcfg.get?.('INNERTUBE_CLIENT_VERSION') || ytcfg.data_?.INNERTUBE_CLIENT_VERSION || '2.20240101.00.00';

    if (!apiKey) return null;

    // Try to get transcript using the get_transcript endpoint
    const response = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: clientVersion,
            hl: 'en',
            gl: 'US'
          }
        },
        params: getTranscriptParams(videoId)
      })
    });

    const data = await response.json();
    console.log('[TranscriptFetcher] get_transcript response:', JSON.stringify(data).substring(0, 200));

    // Parse transcript from response
    const transcriptRenderer = data?.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer;
    const cueGroups = transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments
                   || transcriptRenderer?.body?.transcriptSegmentListRenderer?.initialSegments
                   || [];

    if (cueGroups.length === 0) return null;

    const transcript = [];
    for (const segment of cueGroups) {
      const renderer = segment?.transcriptSegmentRenderer;
      if (renderer) {
        const startMs = parseInt(renderer.startMs, 10) || 0;
        const endMs = parseInt(renderer.endMs, 10) || startMs;
        const text = renderer.snippet?.runs?.map(r => r.text).join('') || '';

        if (text.trim()) {
          transcript.push({
            start: startMs / 1000,
            duration: (endMs - startMs) / 1000,
            text: text.trim()
          });
        }
      }
    }

    return transcript.length > 0 ? transcript : null;

  } catch (error) {
    console.log('[TranscriptFetcher] Panel method failed:', error);
    return null;
  }
}

// Generate transcript params (base64 encoded protobuf-like structure)
function getTranscriptParams(videoId) {
  // Simple encoding for video ID - this is a simplified version
  const params = btoa(`\n\x0b${videoId}`);
  return params;
}

// Parse XML transcript format
function parseXmlTranscript(xml) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  const textElements = doc.querySelectorAll('text');

  console.log('[TranscriptFetcher] XML text elements:', textElements.length);

  if (textElements.length === 0) return null;

  const transcript = [];
  textElements.forEach(el => {
    const start = parseFloat(el.getAttribute('start')) || 0;
    const duration = parseFloat(el.getAttribute('dur')) || 0;
    let text = el.textContent || '';

    // Decode HTML entities
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value.replace(/\n/g, ' ').trim();

    if (text) {
      transcript.push({ start, duration, text });
    }
  });

  return transcript.length > 0 ? transcript : null;
}

// Parse JSON3 transcript format
function parseJson3Transcript(data) {
  const events = data.events || [];
  const transcript = [];

  for (const event of events) {
    // json3 format has events with segs array
    if (event.segs) {
      const start = (event.tStartMs || 0) / 1000;
      const duration = (event.dDurationMs || 0) / 1000;
      const text = event.segs.map(s => s.utf8 || '').join('').trim();

      if (text && text !== '\n') {
        transcript.push({ start, duration, text });
      }
    }
  }

  return transcript.length > 0 ? transcript : null;
}
