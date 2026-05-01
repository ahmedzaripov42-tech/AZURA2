# AZURA Banner Audio Hotfix

Fixed root cause for banner video sound starting briefly and then stopping.

## Root causes fixed
- Stage 5 global click delegate and legacy inline `onclick` both toggled the same button, causing one click to unmute and then immediately mute again.
- Banner carousel auto-rotated after a few seconds while audio was playing, moving away from the audible video and making sound appear to stop by itself.

## Changes
- `js/05-banner.js`
  - Added one authoritative audio toggle path.
  - Mutes all other banner videos before enabling one video.
  - Keeps `playsinline`, `preload="metadata"`, and `object-fit: cover` on banner videos.
  - Pauses carousel auto-rotation while a banner video is audible.
  - Resumes carousel rotation after the user turns sound off.
  - Added `aria-pressed` state to audio buttons.
- `js/azura-stage5-rootfix.js`
  - Stops the legacy inline click handler from double-running.
  - Delegates to the core banner audio toggle exactly once.

## Not fully verified here
- Real browser audio playback with your exact uploaded R2 video file must be tested after deploy because autoplay/audio policies depend on the browser and user gesture.
