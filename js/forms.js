const statusEl = (id) => document.querySelector(`#${id}-status`);

const showStatus = (id, message, tone = "info") => {
  const target = statusEl(id);
  if (!target) return;
  target.textContent = message;
  target.dataset.tone = tone;
};

const loginForm = document.querySelector('#login-form');
if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(loginForm);
    const username = form.get('username');
    const password = form.get('password');

    if (!username || !password) {
      showStatus('login', '아이디와 비밀번호를 모두 입력해주세요.', 'error');
      return;
    }

    showStatus('login', 'Firebase 인증 연동 위치입니다.');
  });
}

const signupForm = document.querySelector('#signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', (event) => {
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

    showStatus('signup', 'Firebase 계정 생성 로직을 연결하세요.');
  });
}
