import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, "ai-studio-rjworld-35564e6f-5ce8-4789-a6a9-64ea283ece47");
