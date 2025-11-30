import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";

const statusEl = (id) => document.querySelector(`#${id}-status`);

const showStatus = (id, message, tone = "info") => {
  const target = statusEl(id);
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
};

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const username = form.get('username');
    const password = form.get('password');

    if (!username || !password) {
      showStatus('login', '아이디와 비밀번호를 모두 입력해주세요.', 'error');
      return;
    }

    showStatus('login', '로그인 중입니다...');

    try {
      await signInWithEmailAndPassword(auth, username, password);
      showStatus('login', '로그인에 성공했습니다! 곧 메인 화면으로 이동합니다.', 'success');
      setTimeout(() => (window.location.href = 'index.html'), 800);
    } catch (error) {
      let message = '로그인에 실패했습니다. 입력값을 다시 확인해주세요.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = '이메일 또는 비밀번호가 올바르지 않습니다.';
      } else if (error.code === 'auth/user-disabled') {
        message = '해당 계정은 비활성화되었습니다. 관리자에게 문의해주세요.';
      } else if (error.code === 'auth/user-not-found') {
        message = '등록되지 않은 계정입니다. 회원가입을 진행해주세요.';
      }
      showStatus('login', message, 'error');
    }
  });
}

const signupForm = document.querySelector('#signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(signupForm);
    const nickname = form.get('nickname');
    const email = form.get('email');
    const password = form.get('password');
    const confirm = form.get('passwordConfirm');

    if (password !== confirm) {
      showStatus('signup', '비밀번호가 일치하지 않습니다.', 'error');
      return;
    }

    if (!nickname || !email || !password) {
      showStatus('signup', '모든 필드를 채워주세요.', 'error');
      return;
    }

    showStatus('signup', '계정을 생성하는 중입니다...');

    try {
      const credentials = await createUserWithEmailAndPassword(auth, email, password);
      if (nickname) {
        await updateProfile(credentials.user, { displayName: nickname });
      }
      showStatus('signup', '회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.', 'success');
      setTimeout(() => (window.location.href = 'login.html'), 800);
    } catch (error) {
      let message = '회원가입에 실패했습니다. 정보를 다시 확인해주세요.';
      if (error.code === 'auth/email-already-in-use') {
        message = '이미 사용 중인 이메일입니다. 다른 이메일을 사용해주세요.';
      } else if (error.code === 'auth/weak-password') {
        message = '비밀번호는 최소 6자 이상이어야 합니다.';
      } else if (error.code === 'auth/invalid-email') {
        message = '올바른 이메일 형식을 입력해주세요.';
      }
      showStatus('signup', message, 'error');
    }
  });
}
