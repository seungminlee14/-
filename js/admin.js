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
import {
  isAdminEmail,
  isOwnerEmail,
  saveBan,
  listActiveBans,
  fetchBanLogs,
  clearBan,
} from "./access.js";

const db = getFirestore(firebaseApp);
const postsRef = collection(db, "posts");

const adminGuard = document.getElementById("adminGuard");
const adminContent = document.getElementById("adminContent");
const deleteForm = document.getElementById("deletePostForm");
const deleteStatus = document.getElementById("deletePostStatus");
const banForm = document.getElementById("banForm");
const banStatus = document.getElementById("banStatus");
const banList = document.getElementById("banList");
const banListStatus = document.getElementById("banListStatus");
const refreshBansButton = document.getElementById("refreshBans");
const banHistoryList = document.getElementById("banHistory");
const banHistoryStatus = document.getElementById("banHistoryStatus");
const refreshHistoryButton = document.getElementById("refreshBanHistory");

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

const handleBan = (adminEmail) => {
  if (!banForm) return;
  banForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = event.target.targetEmail.value.trim();
    const days = Number(event.target.duration.value);
    const reason = event.target.reason.value.trim();

    if (!email) {
      setStatus(banStatus, "정지할 이메일을 입력하세요.", "error");
      return;
    }

    if (isOwnerEmail(email)) {
      setStatus(banStatus, "소유자 계정은 정지할 수 없습니다.", "error");
      return;
    }

    let untilDate = null;
    if (Number.isFinite(days) && days > 0) {
      untilDate = new Date();
      untilDate.setDate(untilDate.getDate() + days);
    }

    setStatus(banStatus, "정지 정보를 저장하는 중입니다...");
    try {
      await saveBan({ email, reason, untilDate, createdBy: adminEmail });
      setStatus(banStatus, `${email} 계정이 정지되었습니다.`, "success");
      banForm.reset();
      await loadBans();
      await loadBanHistory();
    } catch (error) {
      console.error(error);
      setStatus(banStatus, "정지 설정에 실패했습니다. 다시 시도해주세요.", "error");
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
    const item = document.createElement("li");
    item.className = "admin-list-item";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${log.emailLower}</div>
        <p class="admin-list-meta">${log.action === "unban" ? "해제" : "정지"}${
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
    const logs = await fetchBanLogs();
    renderBanHistory(logs);
    setStatus(banHistoryStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(banHistoryStatus, "기록을 불러오지 못했습니다. 다시 시도하세요.", "error");
  }
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
    handleBan(user.email);
    handleUnban();
    if (refreshBansButton) refreshBansButton.addEventListener("click", loadBans);
    if (refreshHistoryButton) refreshHistoryButton.addEventListener("click", loadBanHistory);
    await loadBans();
    await loadBanHistory();
  });
};

init();
