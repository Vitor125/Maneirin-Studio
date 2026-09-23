// Configuração exclusiva do aplicativo cliente; o motor comum não mistura seus caches.
self.APP_CONFIG = {
  "prefix": "maneirin-cliente-",
  "version": "v2",
  "scope": "/cliente/",
  "offline": "/cliente/offline.html",
  "shell": [
    "/cliente/",
    "/cliente/index.html",
    "/cliente/offline.html",
    "/cliente/manifest.webmanifest",
    "/cliente/icons/icon-192.png",
    "/cliente/icons/icon-512.png",
    "/styles.css",
    "/js/firebase.js",
    "/js/utils.js",
    "/js/ui.js",
    "/js/media.js",
    "/Fotos/Logo.png",
    "/script.js",
    "/js/carousel.js",
    "/cliente/agenda/",
    "/cliente/agenda/index.html",
    "/cliente/produtos/",
    "/cliente/produtos/index.html"
  ]
};
importScripts('/js/sw-runtime.js');
