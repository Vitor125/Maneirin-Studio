/**
 * client.js — Firebase SDK + Auth compartilhado entre todas as páginas.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import {
    getAuth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    updateProfile,
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyChDecK-r3NqC1wgYo0OUXl0R6e6qXF4HM",
    authDomain: "site-maneirin-studio.firebaseapp.com",
    projectId: "site-maneirin-studio",
    storageBucket: "site-maneirin-studio.firebasestorage.app",
    messagingSenderId: "974534005078",
    appId: "1:974534005078:web:cc2573a6772438d8f086f7",
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

window.__firebase = {
    auth,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    googleProvider,
    signOut,
    onAuthStateChanged,
    updateProfile,

    async getToken() {
        const user = auth.currentUser;
        if (!user) return null;
        return user.getIdToken();
    },

    async authFetch(url, options = {}) {
        const token = await this.getToken();
        if (token) {
            options.headers = {
                ...(options.headers || {}),
                Authorization: `Bearer ${token}`,
            };
        }
        return fetch(url, options);
    },
};

// Sinaliza que o Firebase está pronto para outros scripts
window.dispatchEvent(new Event('firebase-ready'));
