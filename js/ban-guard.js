import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import { fetchActiveBan } from "./access.js";

const normalizePath = (pathname) => {
  const trimmed = pathname.replace(/\.html$/, "");
  if (trimmed.endsWith("/") && trimmed.length > 1) return trimmed.slice(0, -1);
  return trimmed;
};

const path = normalizePath(window.location.pathname);
const isBannedPage = path === "/banned";
const isAppealPage = path === "/appeal";
const reasonEl = document.getElementById("banReason");
const untilEl = document.getElementById("banUntil");

const formatDate = (date) =>
  date?.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    if (isBannedPage) {
      window.location.href = "/login";
    }
    return;
  }

  const ban = await fetchActiveBan(user.email);

  if (ban) {
    if (isBannedPage) {
      if (reasonEl) reasonEl.textContent = ban.reason || "관리자에 의해 차단되었습니다.";
      if (untilEl) {
        untilEl.textContent = ban.untilDate ? `${formatDate(ban.untilDate)}까지` : "해제 시점 미정";
        untilEl.hidden = false;
      }
    } else if (!isAppealPage) {
      sessionStorage.setItem("banReason", ban.reason || "관리자에 의해 차단되었습니다.");
      sessionStorage.setItem("banUntil", ban.untilDate ? ban.untilDate.toISOString() : "");
      window.location.href = "/banned";
    }
  } else if (isBannedPage) {
    window.location.href = "/";
  }
});

if (isBannedPage) {
  const cachedReason = sessionStorage.getItem("banReason");
  const cachedUntil = sessionStorage.getItem("banUntil");
  if (cachedReason && reasonEl) reasonEl.textContent = cachedReason;
  if (untilEl) {
    untilEl.textContent = cachedUntil ? `${formatDate(new Date(cachedUntil))}까지` : "해제 시점 미정";
    untilEl.hidden = false;
  }
}
