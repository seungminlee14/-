import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import { isAdminEmail, saveUserDirectoryEntry } from "./access.js";
import {
  getLastSeenTimestamp,
  listenToNotifications,
  markNotificationsSeen,
} from "./notifications.js";
import { showPendingPunishment } from "./punishments.js";

const navLinks = document.querySelector('.nav-links');
const notificationMenu = document.querySelector('.notification-menu');
const notificationDropdown = notificationMenu?.querySelector('.notification-dropdown');
const notificationTrigger = notificationMenu?.querySelector('.notification-trigger');
const notificationList = notificationMenu?.querySelector('.notification-list');
const notificationStatus = notificationMenu?.querySelector('.notification-status');
const notificationDot = notificationMenu?.querySelector('.notification-dot');
const profileMenu = document.querySelector('.profile-menu');
const dropdown = profileMenu?.querySelector('.profile-dropdown');
const trigger = profileMenu?.querySelector('.profile-trigger');
const profileName = profileMenu?.querySelector('.profile-name');
const profileAvatar = profileMenu?.querySelector('.profile-avatar');

let unsubscribeNotifications = null;
let latestNotificationTimestamp = 0;

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

const updateNotificationDot = () => {
  if (!notificationDot) return;
  const lastSeen = getLastSeenTimestamp();
  const hasNew = latestNotificationTimestamp > lastSeen;
  notificationDot.hidden = !hasNew;
};

const renderNotifications = (items) => {
  if (!notificationList) return;
  notificationList.innerHTML = '';

  if (!items.length) {
    notificationList.innerHTML = '<li class="empty-state">새로운 알림이 없습니다.</li>';
    if (notificationStatus) notificationStatus.textContent = '';
    latestNotificationTimestamp = 0;
    updateNotificationDot();
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'notification-item';
    li.innerHTML = `
      <div class="notification-text">${item.message || '알림'}</div>
      <div class="notification-meta">${item.createdAt ? item.createdAt.toLocaleString('ko-KR') : '시간 정보 없음'}</div>
      ${item.link ? `<a class="notification-link" href="${item.link}">열기</a>` : ''}
    `;
    notificationList.appendChild(li);
  });

  const newest = items[0]?.createdAt?.getTime?.();
  latestNotificationTimestamp = newest || 0;
  updateNotificationDot();
  if (notificationStatus) notificationStatus.textContent = '';
};

const setAvatar = (user) => {
  if (!profileAvatar) return;
  const fallback = (user?.displayName || user?.email || '미')[0]?.toUpperCase() || '미';
  if (user?.photoURL) {
    profileAvatar.style.backgroundImage = `url(${user.photoURL})`;
    profileAvatar.classList.add('with-photo');
    profileAvatar.textContent = '';
  } else {
    profileAvatar.style.backgroundImage = '';
    profileAvatar.classList.remove('with-photo');
    profileAvatar.textContent = fallback;
  }
};

const closeNotificationDropdown = () => {
  if (!notificationDropdown || !notificationTrigger) return;
  notificationDropdown.hidden = true;
  notificationTrigger.setAttribute('aria-expanded', 'false');
  notificationMenu?.classList.remove('open');
};

const toggleNotificationDropdown = () => {
  if (!notificationDropdown || !notificationTrigger) return;
  const willOpen = notificationDropdown.hidden;
  notificationDropdown.hidden = !willOpen;
  notificationTrigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  notificationMenu?.classList.toggle('open', willOpen);
  if (willOpen) {
    closeDropdown();
    const timestamp = latestNotificationTimestamp || Date.now();
    markNotificationsSeen(timestamp);
    updateNotificationDot();
  }
};

const bindNotificationActions = () => {
  if (!notificationDropdown) return;
  notificationDropdown.addEventListener('click', (event) => {
    const action = event.target.dataset?.action;
    if (action === 'mark-read') {
      const timestamp = latestNotificationTimestamp || Date.now();
      markNotificationsSeen(timestamp);
      updateNotificationDot();
    }
  });
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
  if (willOpen) {
    closeNotificationDropdown();
  }
};

const bindDropdownEvents = () => {
  if (!profileMenu || !dropdown || !trigger) return;

  trigger.addEventListener('click', () => toggleDropdown());
  notificationTrigger?.addEventListener('click', () => toggleNotificationDropdown());

  document.addEventListener('click', (event) => {
    if (!profileMenu.contains(event.target)) {
      closeDropdown();
    }
    if (!notificationMenu?.contains(event.target)) {
      closeNotificationDropdown();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
      closeNotificationDropdown();
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
  bindNotificationActions();

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
    if (!notificationMenu) return;

    if (unsubscribeNotifications) {
      unsubscribeNotifications();
      unsubscribeNotifications = null;
    }

    if (notificationStatus) notificationStatus.textContent = '알림을 불러오는 중...';
    unsubscribeNotifications = listenToNotifications((items) => {
      renderNotifications(items);
    });
  });
}
