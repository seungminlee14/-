import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, firebaseApp } from "./firebase.js";
import { sendNotification } from "./notifications.js";
import {
  isAdminEmail,
  listActiveBans,
  fetchPunishmentHistory,
  clearBan,
  fetchAppeals,
  resolveAppeal,
} from "./access.js";

const db = getFirestore(firebaseApp);
const postsRef = collection(db, "posts");

const adminGuard = document.getElementById("adminGuard");
const adminContent = document.getElementById("adminContent");
const deleteForm = document.getElementById("deletePostForm");
const deleteStatus = document.getElementById("deletePostStatus");
const banList = document.getElementById("banList");
const banListStatus = document.getElementById("banListStatus");
const refreshBansButton = document.getElementById("refreshBans");
const banHistoryList = document.getElementById("banHistory");
const banHistoryStatus = document.getElementById("banHistoryStatus");
const refreshHistoryButton = document.getElementById("refreshBanHistory");
const notificationForm = document.getElementById("notificationForm");
const notificationStatus = document.getElementById("notificationStatus");
const appealList = document.getElementById("appealList");
const appealStatus = document.getElementById("appealStatus");
const refreshAppealsButton = document.getElementById("refreshAppeals");

const setStatus = (el, message, tone = "") => {
  if (!el) return;
  el.textContent = message;
  if (tone) {
    el.dataset.tone = tone;
  } else {
    delete el.dataset.tone;
  }
};

const findPostByNumber = async (number) => {
  const q = query(postsRef, where("number", "==", number), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : snap.docs[0];
};

const deleteCollectionDocs = async (colRef) => {
  const snap = await getDocs(colRef);
  await Promise.all(snap.docs.map((docSnap) => deleteDoc(docSnap.ref)));
};

const deletePost = async (postDoc) => {
  const commentsRef = collection(db, "posts", postDoc.id, "comments");
  const votesRef = collection(db, "posts", postDoc.id, "votes");
  await Promise.all([
    deleteCollectionDocs(commentsRef),
    deleteCollectionDocs(votesRef),
    deleteDoc(doc(db, "posts", postDoc.id)),
  ]);
};

const handleDelete = () => {
  if (!deleteForm) return;
  deleteForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const number = Number(event.target.postNumber.value);
    if (!Number.isFinite(number)) {
      setStatus(deleteStatus, "게시물 번호를 입력하세요.", "error");
      return;
    }

    setStatus(deleteStatus, "게시물 정보를 확인하는 중입니다...");
    const postDoc = await findPostByNumber(number);
    if (!postDoc) {
      setStatus(deleteStatus, "해당 번호의 게시물이 없습니다.", "error");
      return;
    }

    if (!confirm("정말 이 게시물을 삭제하시겠습니까?")) return;

    try {
      await deletePost(postDoc);
      setStatus(deleteStatus, `#${number} 게시물이 삭제되었습니다.`, "success");
      deleteForm.reset();
    } catch (error) {
      console.error(error);
      setStatus(deleteStatus, "삭제 중 오류가 발생했습니다. 다시 시도해주세요.", "error");
    }
  });
};

const formatDate = (date) =>
  date?.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const formatUntil = (ban) => (ban.untilDate ? `${formatDate(ban.untilDate)}까지` : "무기한");

const renderBanList = (bans) => {
  if (!banList) return;
  banList.innerHTML = "";

  if (!bans.length) {
    banList.innerHTML = '<li class="empty-state">현재 정지된 계정이 없습니다.</li>';
    return;
  }

  bans.forEach((ban) => {
    const item = document.createElement("li");
    item.className = "admin-list-item";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${ban.id}</div>
        <p class="admin-list-meta">${ban.reason || "관리자에 의해 차단되었습니다."}</p>
        <p class="admin-list-meta">${formatUntil(ban)}</p>
      </div>
      <div class="admin-list-actions">
        <button class="button ghost" data-unban="${ban.id}">해제</button>
      </div>
    `;
    banList.appendChild(item);
  });
};

const handleUnban = () => {
  if (!banList) return;
  banList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const email = target.dataset.unban;
    if (!email) return;

    if (!confirm(`${email} 계정의 정지를 해제하시겠습니까?`)) return;
    setStatus(banListStatus, "정지를 해제하는 중입니다...");
    try {
      await clearBan(email);
      setStatus(banListStatus, `${email} 정지가 해제되었습니다.`, "success");
      await loadBans();
      await loadBanHistory();
    } catch (error) {
      console.error(error);
      setStatus(banListStatus, "해제 중 오류가 발생했습니다. 다시 시도해주세요.", "error");
    }
  });
};

const handleNotificationSend = (adminEmail) => {
  if (!notificationForm) return;
  notificationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = event.target.message.value;
    const link = event.target.link.value;

    if (!message.trim()) {
      setStatus(notificationStatus, "알림 내용을 입력하세요.", "error");
      return;
    }

    setStatus(notificationStatus, "알림을 전송하는 중입니다...");
    try {
      await sendNotification({ message, link, createdBy: adminEmail });
      setStatus(notificationStatus, "알림이 전송되었습니다.", "success");
      notificationForm.reset();
    } catch (error) {
      console.error(error);
      setStatus(notificationStatus, "전송 중 오류가 발생했습니다. 다시 시도하세요.", "error");
    }
  });
};

const loadBans = async () => {
  if (!banListStatus) return;
  setStatus(banListStatus, "정지 목록을 불러오는 중입니다...");
  try {
    const bans = await listActiveBans();
    renderBanList(bans);
    setStatus(banListStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(banListStatus, "목록을 불러오지 못했습니다. 다시 시도하세요.", "error");
  }
};

const renderBanHistory = (logs) => {
  if (!banHistoryList) return;
  banHistoryList.innerHTML = "";

  if (!logs.length) {
    banHistoryList.innerHTML = '<li class="empty-state">기록이 아직 없습니다.</li>';
    return;
  }

  logs.forEach((log) => {
    const label =
      log.type === "warning"
        ? "경고"
        : log.type === "caution"
        ? "주의"
        : log.type === "suspension"
        ? "정지"
        : log.action === "unban"
        ? "해제"
        : "처리";
    const item = document.createElement("li");
    item.className = "admin-list-item";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${log.emailLower}</div>
        <p class="admin-list-meta">${label}${log.count ? ` x${log.count}` : ""}${
      log.untilDate ? ` (${formatUntil(log)})` : ""
    }</p>
        <p class="admin-list-meta">${log.reason || "관리자 처리"}</p>
      </div>
      <div class="admin-list-actions">
        <span class="badge subtle">${log.createdAtDate ? formatDate(log.createdAtDate) : "시간 정보 없음"}</span>
      </div>
    `;
    banHistoryList.appendChild(item);
  });
};

const loadBanHistory = async () => {
  if (!banHistoryStatus) return;
  setStatus(banHistoryStatus, "처벌 기록을 불러오는 중입니다...");
  try {
    const logs = await fetchPunishmentHistory();
    renderBanHistory(logs);
    setStatus(banHistoryStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(banHistoryStatus, "기록을 불러오지 못했습니다. 다시 시도하세요.", "error");
  }
};

const renderAppeals = (appeals) => {
  if (!appealList) return;
  appealList.innerHTML = "";

  if (!appeals.length) {
    appealList.innerHTML = '<li class="empty-state">이의제기가 없습니다.</li>';
    return;
  }

  appeals.forEach((appeal) => {
    const item = document.createElement("li");
    item.className = "admin-list-item";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${appeal.emailLower}</div>
        <p class="admin-list-meta">${appeal.message}</p>
        <p class="admin-list-meta">${appeal.punishmentId ? `관련 처벌: ${appeal.punishmentId}` : "최근 처벌"}</p>
      </div>
      <div class="admin-list-actions">
        <span class="badge subtle">${appeal.createdAt ? formatDate(appeal.createdAt) : ""}</span>
        ${
          appeal.status === "open"
            ? '<button class="button ghost" data-appeal-status="resolved" data-appeal-id="' +
              appeal.id +
              '">처리 완료</button>'
            : '<span class="badge">처리됨</span>'
        }
      </div>
    `;
    appealList.appendChild(item);
  });
};

const loadAppeals = async () => {
  if (!appealStatus) return;
  setStatus(appealStatus, "이의제기를 불러오는 중입니다...");
  try {
    const appeals = await fetchAppeals();
    renderAppeals(appeals);
    setStatus(appealStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(appealStatus, "이의제기를 불러오지 못했습니다.", "error");
  }
};

const handleAppealActions = () => {
  if (!appealList) return;
  appealList.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.appealId;
    const status = target.dataset.appealStatus;
    if (!id || !status) return;
    setStatus(appealStatus, "이의제기를 업데이트하는 중입니다...");
    try {
      await resolveAppeal({ id, status });
      await loadAppeals();
    } catch (error) {
      console.error(error);
      setStatus(appealStatus, "처리 중 오류가 발생했습니다.", "error");
    }
  });
};

const init = () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user || !isAdminEmail(user.email)) {
      if (adminGuard) {
        adminGuard.innerHTML = "<p class=\"settings-help\">관리자만 접근 가능합니다.</p>";
      }
      setTimeout(() => (window.location.href = "/"), 800);
      return;
    }

    if (adminGuard) adminGuard.hidden = true;
    if (adminContent) adminContent.hidden = false;
    handleDelete();
    handleUnban();
    handleNotificationSend(user.email);
    if (refreshBansButton) refreshBansButton.addEventListener("click", loadBans);
    if (refreshHistoryButton) refreshHistoryButton.addEventListener("click", loadBanHistory);
    if (refreshAppealsButton) refreshAppealsButton.addEventListener("click", loadAppeals);
    handleAppealActions();
    await loadBans();
    await loadBanHistory();
    await loadAppeals();
  });
};

init();
