if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        console.log('Service Worker registered successfully with scope:', reg.scope);

        // Check if there is already a waiting worker (e.g. from previous load)
        if (reg.waiting && navigator.serviceWorker.controller) {
          window.dispatchEvent(
            new CustomEvent('swUpdateAvailable', { detail: { waiting: reg.waiting } })
          );
        }

        // Listen for updates found while running
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New update available for Bunk Line PWA!');
                window.dispatchEvent(
                  new CustomEvent('swUpdateAvailable', {
                    detail: { waiting: installingWorker },
                  })
                );
              } else {
                console.log('Content is cached for offline use.');
              }
            }
          };
        };
      })
      .catch((err) => {
        console.error('Service Worker registration failed:', err);
      });
  });

  // Handle controller change (reloads page when skipWaiting is triggered)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}
