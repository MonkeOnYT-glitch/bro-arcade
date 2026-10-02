/* Monke Vault custom cursor — purple ring that follows the mouse.
   Ported from the Monke Vault. rAF-throttled; hidden on touch devices via CSS. */
(function () {
  'use strict';

  var cursor = null;
  var raf = null;
  var mx = -40, my = -40;

  function moveHandler(e) {
    mx = e.clientX;
    my = e.clientY;
    if (!raf) {
      raf = requestAnimationFrame(function () {
        if (cursor) {
          cursor.style.left = mx + 'px';
          cursor.style.top = my + 'px';
        }
        raf = null;
      });
    }
  }

  function leaveHandler() { if (cursor) cursor.style.opacity = '0'; }
  function enterHandler() { if (cursor) cursor.style.opacity = '1'; }

  document.addEventListener('DOMContentLoaded', function () {
    cursor = document.getElementById('custom-cursor');
    if (!cursor) return;
    // No point tracking a mouse that doesn't exist.
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
    document.addEventListener('mousemove', moveHandler, { passive: true });
    document.addEventListener('mouseleave', leaveHandler);
    document.addEventListener('mouseenter', enterHandler);
  });
})();
