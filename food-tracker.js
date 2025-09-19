import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAOQzY3XEFTKHTS6lODjDCdXdcNXH083lw",
  authDomain: "shopp-3e4a7.firebaseapp.com",
  projectId: "shopp-3e4a7",
  storageBucket: "shopp-3e4a7.firebasestorage.app",
  messagingSenderId: "567488643498",
  appId: "1:567488643498:web:9d69749f6131140db5ebd3",
  measurementId: "G-4LZE6Q0CD9"
};