// ════════════════════════════════════════════════════════════════════════
// AZURA v15 — MODULE 06: READER (LEGACY STUB)
// 
// Old reader system has been removed. Reader is now in 12-reader-new.js
// This file only provides minimal stubs for backwards compatibility.
// ════════════════════════════════════════════════════════════════════════

// All old reader functions are now no-ops or redirects
window.renderReader = function() { /* handled by new reader */ };
window.readerPrevChapter = function() { /* handled by new reader */ };
window.readerNextChapter = function() { /* handled by new reader */ };
window.openReaderChat = function() { /* removed */ };
window.closeReaderChat = function() { /* removed */ };
window.toggleReaderChat = function() { /* removed */ };
window.handleReaderPdfUpload = function() { /* removed — use openChapterModal */ };
window.injectReaderCSS = function() { /* no-op — CSS is in main file */ };
window.reInitFixes = function() { /* no-op */ };
window.pingReaderActivity = function() { /* tracking moved */ };
window.rdrPostReadingActivity = function() { /* removed */ };

// Legacy chat functions (no-op)
window.openChatModal = function() {};
window.closeChatModal = function() {};
window.sendChatMessage = function() {};
window.openEmojiPicker = function() {};
window.toggleReactionMenu = function() {};

console.log('[AZURA v15] Module 06: Legacy reader stubs loaded (real reader in module 12)');

if (typeof window !== 'undefined' && window._azuraMarkLoaded) window._azuraMarkLoaded('06-reader');
