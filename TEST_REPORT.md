# Manual Test Report

## Community post creation (unauthenticated visitor)
- Served the site locally via `python -m http.server 8000`.
- Opened `/community.html` in a headless browser.
- Clicked "게시물 생성".
- Observed alert message: "로그인하여 게시물을 올려보세요!" indicating the button is gated for signed-in users.

Outcome: Pass (expected login prompt displayed for unauthenticated users).
