// Configuração exclusiva do aplicativo barbeiro; o motor comum não mistura seus caches.
self.APP_CONFIG = {
  "prefix": "maneirin-barbeiro-",
  "version": "v2",
  "scope": "/barbeiro/",
  "offline": "/barbeiro/offline.html",
  "shell": [
    "/barbeiro/",
    "/barbeiro/index.html",
    "/barbeiro/offline.html",
    "/barbeiro/manifest.webmanifest",
    "/barbeiro/icons/icon-192.png",
    "/barbeiro/icons/icon-512.png",
    "/styles.css",
    "/js/firebase.js",
    "/js/utils.js",
    "/js/ui.js",
    "/js/media.js",
    "/Fotos/Logo.png",
    "/dashboard.js",
    "/js/permissions.js",
    "/js/admin.js",
    "/js/calendar.js"
  ]
};
importScripts('/js/sw-runtime.js');
