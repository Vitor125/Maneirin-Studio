import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyChDecK-r3NqC1wgYo0OUXl0R6e6qXF4HM",
    authDomain: "site-maneirin-studio.firebaseapp.com",
    projectId: "site-maneirin-studio",
    storageBucket: "site-maneirin-studio.firebasestorage.app",
    messagingSenderId: "974534005078",
    appId: "1:974534005078:web:1adb1420fec91092f086f7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
