import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";

const navLinks = document.querySelector('.nav-links');
if (navLinks) {
  const loggedOutMarkup = navLinks.innerHTML;

  const renderLoggedIn = (user) => {
    const displayName = user?.displayName || user?.email || '사용자';
    navLinks.innerHTML = `
      <a href="index.html" class="nav-link">홈</a>
      <span class="nav-greeting">안녕하세요 ${displayName} 님</span>
      <a href="mypage.html" class="nav-link nav-cta">마이페이지</a>
    `;
  };

  const renderLoggedOut = () => {
    navLinks.innerHTML = loggedOutMarkup;
  };

  onAuthStateChanged(auth, (user) => {
    if (user) {
      renderLoggedIn(user);
    } else {
      renderLoggedOut();
    }
  });
}
