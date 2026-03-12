// Bridge: receives messages from parent React app (Thiên Hoang Đại Lục shell)
window.addEventListener('message', (event) => {
  const { type, ...data } = event.data || {};

  switch (type) {
    case 'flyTo': {
      const { x, y, zoom } = data;
      if (window.svg && x != null && y != null) {
        const scale = zoom || 4;
        const transform = d3.zoomIdentity
          .translate(window.graphWidth / 2 - x * scale, window.graphHeight / 2 - y * scale)
          .scale(scale);
        window.svg.transition().duration(800).call(window.zoom.transform, transform);
      }
      break;
    }
    case 'themeChange': {
      const { theme } = data;
      document.documentElement.setAttribute('data-theme', theme);
      break;
    }
  }
});

// Force Vietnamese as default culture set for Thiên Hoang Đại Lục
localStorage.setItem('culturesSet', 'vietnamese');

// Notify parent when FMG is ready
window.addEventListener('load', () => {
  window.parent.postMessage({ type: 'fmgReady' }, '*');
});
