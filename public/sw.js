// Minimal service worker. It exists for two reasons:
//  1) the app can be installed to the home screen (PWA)
//  2) phone notifications can be shown and, when tapped, bring the app to the front.
// It does NOT cache anything (API calls must always be live).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Tapping a notification: focus an open SafeRide tab, or open the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) return c.focus();
      }
      return self.clients.openWindow("/join");
    })
  );
});
