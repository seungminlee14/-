import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyCgD2fkdvuHmM2YBjXxXX39txiKebwO8rs",
  authDomain: "dats-games.firebaseapp.com",
  projectId: "dats-games",
  storageBucket: "dats-games.firebasestorage.app",
  messagingSenderId: "127131925580",
  appId: "1:127131925580:web:5edfaabfebb4e3626c48e9",
  measurementId: "G-3X0N5Z0CPH",
};

export const firebaseApp = initializeApp(firebaseConfig);

// Analytics는 브라우저 환경에서만 동작하도록 보호합니다.
isSupported()
  .then((supported) => {
    if (supported) {
      getAnalytics(firebaseApp);
    }
  })
  .catch(() => {
    // 로컬 파일 실행 등 지원되지 않는 환경에서는 조용히 무시합니다.
  });
