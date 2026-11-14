/* A single landscape stage, fitted to the window without changing map coordinates. */
(function (global) {
  'use strict';
  const MyGO = global.MyGO = global.MyGO || {};
  function measure(width, height) {
    const rotated = height > width;
    return { rotated, scale: Math.max(0.01, Math.min((rotated ? height : width) / 1360,
      (rotated ? width : height) / 768)) };
  }
  function pointToCell(rect, clientX, clientY, cols, rows, rotated) {
    if (!rect.width || !rect.height) return null;
    const nx = rotated ? (clientY - rect.top) / rect.height : (clientX - rect.left) / rect.width;
    const ny = rotated ? (rect.left + rect.width - clientX) / rect.width : (clientY - rect.top) / rect.height;
    if (nx < 0 || ny < 0 || nx >= 1 || ny >= 1) return null;
    return { x: Math.floor(nx * cols), y: Math.floor(ny * rows) };
  }
  function fit() {
    const root = global.document && document.getElementById('game-shell');
    if (!root) return;
    const size = measure(global.innerWidth, global.innerHeight);
    root.style.setProperty('--ui-scale', size.scale);
    root.style.setProperty('--ui-rotation', size.rotated ? '90deg' : '0deg');
    root.dataset.rotated = String(size.rotated);
  }
  MyGO.Viewport = { measure, pointToCell, fit };
  if (global.document) {
    fit();
    global.addEventListener('resize', fit);
    document.addEventListener('fullscreenchange', fit);
  }
})(window);
