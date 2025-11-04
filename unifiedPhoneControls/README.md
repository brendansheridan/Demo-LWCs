## Unified Phone Controls (LWC)

### Overview
Unified Phone Controls is a Lightning Web Component designed for the `VoiceCall` record page that surfaces a compact, modern call control experience for Service Cloud Voice. It listens to the Service Cloud Voice Toolkit API for live telephony events and provides agents with inline controls and call metrics during active calls.

### Key Features
- **Live call state**: Shows status (Incoming, Connected, On Hold, Ended) with SLDS badge styling.
- **Call duration + hold timer**: Tracks total call time and aggregates multiple hold sessions; shows color-coded thresholds.
- **Telephony controls**: Hold/Resume, Mute/Unmute, End Call, and a placeholder action for Transfer.
- **Floating mini-bar**: Pop-out/dock control for a draggable, space-saving mini control bar.
- **Debug panel (optional)**: View telephony availability, state flags, and a rolling event log.
- **Theming**: Configurable toolbar style (`modern`, `classic`, `minimal`, `custom`) and background color.
- **Responsive UI**: Uses CSS Container Queries for clean layouts across narrow and wide containers.

### Usage
- Add to a `VoiceCall` record page in App Builder.
- Requires Service Cloud Voice and the Toolkit API capability.
- Exposed properties in App Builder:
  - **debugMode (Boolean)**: Enable verbose on-screen debug info.
  - **toolbarBackgroundColor (String)**: CSS color or gradient when using `custom` style.
  - **toolbarStyle (String)**: One of `modern`, `classic`, `minimal`, `custom`.

### Files Included
- `unifiedPhoneControls.html`: Markup with toolbar, metrics, mini-bar, and debug panel.
- `unifiedPhoneControls.js`: Logic for call state, timers, and Toolkit API event handling.
- `unifiedPhoneControls.css`: SLDS2-forward styles with container queries and toolbar theming.
- `unifiedPhoneControls.js-meta.xml`: Targets `lightning__RecordPage` for `VoiceCall` and declares Toolkit capability.

### Notes
- This LWC listens to `lightning-service-cloud-voice-toolkit-api` events: `hold`, `resume`, `mute`, `unmute`, `callstarted`, `callconnected`, `callended`, `hangup`.
- Transfer action is scaffolded as a placeholder; implement per your telephony provider’s APIs.

