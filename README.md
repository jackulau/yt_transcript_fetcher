# YouTube Transcript Fetcher

A Chrome extension with a sleek sidebar UI that instantly fetches YouTube video transcripts.

## Features

- **Sidebar Interface** - Clean, always-accessible side panel (like Claude's extension)
- **Auto-detect** - One click to get transcript from current YouTube tab
- **Element Picker** - Click on any YouTube link/thumbnail on any page
- **Manual URL** - Paste any YouTube URL directly
- **Timestamp Filtering** - Filter transcript by time range
- **Multi-format Export** - Download as TXT, JSON, SRT, VTT, Markdown, or CSV
- **Speed Reader** - Built-in speed reading mode with adjustable WPM

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right corner)
4. Click **Load unpacked**
5. Select the `video_transcript_fetcher` folder
6. The extension icon appears in your toolbar

## Usage

### Opening the Sidebar
Click the extension icon in the toolbar. The sidebar opens on the right side of your browser.

### Getting Transcripts

**Option 1: Current Tab**
- Navigate to any YouTube video
- Click **"Get from Current Tab"**

**Option 2: Element Picker**
- Go to any page with YouTube links (search results, homepage, etc.)
- Click **"Select Video from Page"**
- Click on any YouTube video thumbnail or link

**Option 3: Paste URL**
- Paste a YouTube URL in the input field
- Press Enter or click the arrow button

### Options
- **Include timestamps** - Toggle timestamps in output
- **Filter by time range** - Get only a portion of the transcript

### Exporting

Click the **download icon** to choose from multiple formats:

| Format | Extension | Description |
|--------|-----------|-------------|
| **TXT** | .txt | Plain text with optional timestamps |
| **JSON** | .json | Structured data with title, segments, timestamps |
| **SRT** | .srt | SubRip subtitle format (for video players) |
| **VTT** | .vtt | WebVTT format (for web video players) |
| **MD** | .md | Markdown with headers and formatting |
| **CSV** | .csv | Spreadsheet-compatible with columns |

Click the **copy icon** to copy transcript to clipboard.

### Speed Reader

1. Fetch a transcript
2. Click the **play icon** button to open Speed Reader
3. Adjust settings:
   - **WPM** - Words per minute (50-1000)
   - **Font** - Choose your preferred font
   - **Size** - Adjust text size
4. Use playback controls or keyboard shortcuts:
   - `Space` - Play/Pause
   - `Left/Right` - Skip 10 words
   - `Up/Down` - Adjust WPM
   - `R` - Restart
   - `Esc` - Close

## Supported URL Formats

- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/shorts/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

## Requirements

- Google Chrome 114+ (for side panel support)
- YouTube video must have captions available

## Permissions

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access current tab URL |
| `sidePanel` | Display sidebar interface |
| `scripting` | Inject transcript fetcher and element picker |
| `tabs` | Query tab information |
| `clipboardWrite` | Copy transcript to clipboard |

## How It Works

1. When you request a transcript, the extension opens YouTube in a **background tab**
2. It injects scripts to access YouTube's internal player data
3. Extracts caption tracks and fetches the transcript
4. Closes the background tab and displays the transcript
5. You never leave your current page!

## License

MIT License
