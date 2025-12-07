import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import { isAdminEmail, saveUserDirectoryEntry } from "./access.js";
import { showPendingPunishment } from "./punishments.js";

const navLinks = document.querySelector('.nav-links');
const profileMenu = document.querySelector('.profile-menu');
const dropdown = profileMenu?.querySelector('.profile-dropdown');
const trigger = profileMenu?.querySelector('.profile-trigger');
const profileName = profileMenu?.querySelector('.profile-name');
const profileAvatar = profileMenu?.querySelector('.profile-avatar');

const renderLinks = (user) => {
  if (!navLinks) return;
  const adminLink = user && isAdminEmail(user.email)
    ? '<a href="/admin" class="nav-link">관리자</a>'
    : '';
  navLinks.innerHTML = `
    <a href="/" class="nav-link">홈</a>
    <a href="/community" class="nav-link">커뮤니티</a>
    ${adminLink}
  `;
};

const setAvatar = (user) => {
  if (!profileAvatar) return;
  const fallback = (user?.displayName || user?.email || '미')[0]?.toUpperCase() || '미';

  const applyFallback = () => {
    profileAvatar.style.backgroundImage = '';
    profileAvatar.classList.remove('with-photo');
    profileAvatar.textContent = fallback;
  };

  if (user?.photoURL) {
    const img = new Image();
    img.onload = () => {
      profileAvatar.style.backgroundImage = `url(${user.photoURL})`;
      profileAvatar.classList.add('with-photo');
      profileAvatar.textContent = '';
    };
    img.onerror = applyFallback;
    img.src = user.photoURL;
  } else {
    applyFallback();
  }
};

const closeDropdown = () => {
  if (!dropdown || !trigger) return;
  dropdown.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  profileMenu?.classList.remove('open');
};

const toggleDropdown = () => {
  if (!dropdown || !trigger) return;
  const willOpen = dropdown.hidden;
  dropdown.hidden = !willOpen;
  trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  profileMenu?.classList.toggle('open', willOpen);
};

const bindDropdownEvents = () => {
  if (!profileMenu || !dropdown || !trigger) return;

  trigger.addEventListener('click', () => toggleDropdown());

  document.addEventListener('click', (event) => {
    if (!profileMenu.contains(event.target)) {
      closeDropdown();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
    }
  });

  dropdown.addEventListener('click', async (event) => {
    const action = event.target.dataset?.action;
    if (action === 'logout') {
      event.preventDefault();
      try {
        await signOut(auth);
      } catch (error) {
        console.error('로그아웃 실패', error);
      } finally {
        closeDropdown();
        window.location.href = '/';
      }
    }
  });
};

const renderProfileMenu = (user) => {
  if (!profileMenu || !dropdown || !profileName) return;
  if (user) {
    const displayName = user.displayName || user.email || '사용자';
    profileName.textContent = displayName;
    dropdown.innerHTML = `
      <a class="profile-action" href="/mypage">마이페이지</a>
      <button class="profile-action" type="button" data-action="logout">로그아웃</button>
    `;
  } else {
    profileName.textContent = '미로그인';
    dropdown.innerHTML = `
      <a class="profile-action" href="/login">로그인</a>
      <a class="profile-action" href="/signup">회원가입</a>
    `;
  }
  setAvatar(user);
  closeDropdown();
};

if (navLinks && profileMenu) {
  bindDropdownEvents();

  onAuthStateChanged(auth, async (user) => {
    renderLinks(user);
    renderProfileMenu(user);
    if (user) {
      try {
        await saveUserDirectoryEntry({ email: user.email, nickname: user.displayName, photoURL: user.photoURL });
        await showPendingPunishment(user.email);
      } catch (error) {
        console.error(error);
      }
    }
  });
}
