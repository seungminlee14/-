import {
  EmailAuthProvider,
  deleteUser,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import { isOwnerEmail } from "./access.js";

const statusEl = (id) => document.querySelector(`#${id}-status`);

const showStatus = (id, message, tone = "info") => {
  const target = statusEl(id);
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
};

const nicknameForm = document.querySelector('#nickname-form');
const passwordForm = document.querySelector('#password-form');
const deleteForm = document.querySelector('#delete-form');
const logoutButton = document.querySelector('#logout-button');
const nicknameInput = document.querySelector('#nickname');
const nicknameCooldown = document.querySelector('#nickname-cooldown');
const guard = document.querySelector('#auth-guard');
const avatarForm = document.querySelector('#avatar-form');
const photoInput = document.querySelector('#photo-url');
const avatarPreview = document.querySelector('#avatar-preview');

const DAY_MS = 24 * 60 * 60 * 1000;
const COOL_DOWN_DAYS = 14;

const getCooldownKey = (uid) => `lastNicknameChange:${uid}`;

const updateNavProfile = (displayName, photoURL) => {
  const nameEl = document.querySelector('.profile-name');
  if (nameEl) {
    nameEl.textContent = displayName || '프로필';
  }
  const navAvatar = document.querySelector('.profile-avatar');
  if (navAvatar) {
    const initial = (displayName || '미')[0]?.toUpperCase() || '미';
    if (photoURL) {
      navAvatar.style.backgroundImage = `url(${photoURL})`;
      navAvatar.classList.add('with-photo');
      navAvatar.textContent = '';
    } else {
      navAvatar.style.backgroundImage = '';
      navAvatar.classList.remove('with-photo');
      navAvatar.textContent = initial;
    }
  }
};

let signOutRequested = false;

const setCooldownText = (timestamp) => {
  if (!nicknameCooldown || !timestamp) return;
  const nextDate = new Date(Number(timestamp) + COOL_DOWN_DAYS * DAY_MS);
  const dateText = nextDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  nicknameCooldown.hidden = false;
  nicknameCooldown.textContent = `${dateText} 이후 변경 가능`;
};

const clearCooldownText = () => {
  if (nicknameCooldown) {
    nicknameCooldown.hidden = true;
    nicknameCooldown.textContent = '';
  }
};

const initNickname = (user) => {
  if (!nicknameInput) return;
  nicknameInput.value = user.displayName || '';
};

const setAvatarPreview = (user) => {
  if (!avatarPreview) return;
  const initial = (user.displayName || user.email || '프')[0]?.toUpperCase() || '프';
  if (user.photoURL) {
    avatarPreview.style.backgroundImage = `url(${user.photoURL})`;
    avatarPreview.classList.add('with-photo');
    avatarPreview.textContent = '';
  } else {
    avatarPreview.style.backgroundImage = '';
    avatarPreview.classList.remove('with-photo');
    avatarPreview.textContent = initial;
  }
};

const initAvatar = (user) => {
  if (photoInput) {
    photoInput.value = user.photoURL || '';
  }
  setAvatarPreview(user);
};

const handleNicknameSubmit = (user) => {
  if (!nicknameForm) return;
  nicknameForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newNickname = nicknameInput.value.trim();

    if (!newNickname) {
      showStatus('nickname', '닉네임을 입력해주세요.', 'error');
      return;
    }

    const lastChanged = localStorage.getItem(getCooldownKey(user.uid));
    if (lastChanged) {
      const diffDays = Math.floor((Date.now() - Number(lastChanged)) / DAY_MS);
      if (diffDays < COOL_DOWN_DAYS) {
        showStatus('nickname', `닉네임은 ${COOL_DOWN_DAYS}일에 한 번만 변경할 수 있습니다.`, 'error');
        setCooldownText(lastChanged);
        return;
      }
    }

    showStatus('nickname', '닉네임을 변경하는 중입니다...');

    try {
      await updateProfile(user, { displayName: newNickname });
      localStorage.setItem(getCooldownKey(user.uid), Date.now().toString());
      updateNavProfile(newNickname, user.photoURL);
      clearCooldownText();
      showStatus('nickname', '닉네임이 변경되었습니다.', 'success');
    } catch (error) {
      showStatus('nickname', '닉네임 변경에 실패했습니다. 잠시 후 다시 시도해주세요.', 'error');
    }
  });
};

const handleAvatarSubmit = (user) => {
  if (!avatarForm) return;

  avatarForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = photoInput?.value.trim() || '';

    if (!url) {
      showStatus('avatar', '프로필 이미지 URL을 입력해주세요.', 'error');
      return;
    }

    showStatus('avatar', '프로필 이미지를 업데이트하는 중입니다...');

    try {
      await updateProfile(user, { photoURL: url });
      user.photoURL = url;
      setAvatarPreview(user);
      updateNavProfile(user.displayName || user.email, url);
      showStatus('avatar', '프로필 이미지가 업데이트되었습니다.', 'success');
    } catch (error) {
      showStatus('avatar', '프로필 이미지 업데이트에 실패했습니다. URL을 확인 후 다시 시도해주세요.', 'error');
    }
  });
};

const handlePasswordSubmit = (user) => {
  if (!passwordForm) return;
  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = event.target.currentPassword.value;
    const newPassword = event.target.newPassword.value;
    const confirmPassword = event.target.confirmPassword.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      showStatus('password', '모든 비밀번호 필드를 입력해주세요.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showStatus('password', '새 비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    showStatus('password', '비밀번호를 변경하는 중입니다...');

    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      showStatus('password', '비밀번호가 변경되었습니다.', 'success');
      passwordForm.reset();
    } catch (error) {
      let message = '비밀번호 변경에 실패했습니다. 다시 시도해주세요.';
      if (error.code === 'auth/wrong-password') {
        message = '현재 비밀번호가 올바르지 않습니다.';
      } else if (error.code === 'auth/weak-password') {
        message = '새 비밀번호는 최소 6자 이상이어야 합니다.';
      } else if (error.code === 'auth/requires-recent-login') {
        message = '보안을 위해 다시 로그인한 후 비밀번호를 변경해주세요.';
      }
      showStatus('password', message, 'error');
    }
  });
};

const handleDeleteSubmit = (user) => {
  if (!deleteForm) return;
  deleteForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = event.target.deletePassword.value;

    if (!password) {
      showStatus('delete', '비밀번호를 입력해주세요.', 'error');
      return;
    }

    if (isOwnerEmail(user.email)) {
      showStatus('delete', '소유자 계정은 삭제할 수 없습니다.', 'error');
      return;
    }

    if (!confirm('정말 계정을 삭제하시겠어요? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    showStatus('delete', '계정을 삭제하는 중입니다...');

    try {
      const credential = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, credential);
      await deleteUser(user);
      showStatus('delete', '계정이 삭제되었습니다. 이용해주셔서 감사합니다.', 'success');
      setTimeout(() => (window.location.href = '/'), 1200);
    } catch (error) {
      let message = '계정 삭제에 실패했습니다. 다시 시도해주세요.';
      if (error.code === 'auth/wrong-password') {
        message = '비밀번호가 올바르지 않습니다.';
      } else if (error.code === 'auth/requires-recent-login') {
        message = '보안을 위해 다시 로그인한 후 계정을 삭제해주세요.';
      }
      showStatus('delete', message, 'error');
    }
  });
};

const handleLogout = () => {
  if (!logoutButton) return;

  logoutButton.addEventListener('click', async () => {
    signOutRequested = true;
    showStatus('logout', '로그아웃 중입니다...');
    try {
      await signOut(auth);
      showStatus('logout', '로그아웃되었습니다. 잠시 후 홈으로 이동합니다.', 'success');
      setTimeout(() => (window.location.href = '/'), 800);
    } catch (error) {
      signOutRequested = false;
      showStatus('logout', '로그아웃에 실패했습니다. 다시 시도해주세요.', 'error');
    }
  });
};

onAuthStateChanged(auth, (user) => {
  if (!guard) return;
  if (!user) {
    if (signOutRequested) {
      guard.innerHTML = '<p class="settings-help">로그아웃 완료. 홈으로 이동합니다...</p>';
      setTimeout(() => (window.location.href = '/'), 400);
    } else {
      guard.innerHTML = '<p class="settings-help">로그인 후 이용 가능합니다. 로그인 페이지로 이동합니다...</p>';
      setTimeout(() => (window.location.href = '/login'), 700);
    }
    return;
  }

  guard.hidden = true;
  document.querySelector('#nickname-section')?.removeAttribute('hidden');
  document.querySelector('#avatar-section')?.removeAttribute('hidden');
  document.querySelector('#password-section')?.removeAttribute('hidden');
  document.querySelector('#delete-section')?.removeAttribute('hidden');
  document.querySelector('#logout-section')?.removeAttribute('hidden');

  initNickname(user);
  initAvatar(user);
  handleNicknameSubmit(user);
  handleAvatarSubmit(user);
  handlePasswordSubmit(user);
  handleDeleteSubmit(user);
  handleLogout();

  const lastChanged = localStorage.getItem(getCooldownKey(user.uid));
  if (lastChanged) {
    const diffDays = Math.floor((Date.now() - Number(lastChanged)) / DAY_MS);
    if (diffDays < COOL_DOWN_DAYS) {
      setCooldownText(lastChanged);
    }
  } else {
    clearCooldownText();
  }
});
