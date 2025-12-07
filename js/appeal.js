import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import { createAppeal, fetchRecentPunishments, fetchUserAppeals } from "./access.js";

const guard = document.getElementById("appealGuard");
const content = document.getElementById("appealContent");
const punishmentList = document.getElementById("punishmentList");
const punishmentStatus = document.getElementById("punishmentStatus");
const appealForm = document.getElementById("appealForm");
const appealTarget = document.getElementById("appealTarget");
const appealMessage = document.getElementById("appealMessage");
const appealFormStatus = document.getElementById("appealFormStatus");
const appealHistory = document.getElementById("appealHistory");
const appealHistoryStatus = document.getElementById("appealHistoryStatus");

const setStatus = (el, message, tone = "") => {
  if (!el) return;
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
};

const formatDate = (date) =>
  date?.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

let punishments = [];

const renderPunishments = (punishmentsList) => {
  if (!punishmentList || !appealTarget) return;
  punishmentList.innerHTML = "";
  appealTarget.innerHTML = "";

  if (!punishmentsList.length) {
    punishmentList.innerHTML = '<li class="empty-state">최근 3년간 받은 처벌이 없습니다.</li>';
    appealTarget.innerHTML = '<option value="">최근 처벌 없음</option>';
    return;
  }

  punishments = punishmentsList;

  punishmentsList.forEach((p) => {
    const item = document.createElement("li");
    item.className = "admin-list-item";
    const typeLabel = p.type === "warning" ? "경고" : p.type === "caution" ? "주의" : "정지";
    const until = p.untilDate ? ` / ${formatDate(p.untilDate)}까지` : "";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${typeLabel}${p.count ? ` x${p.count}` : ""}</div>
        <p class="admin-list-meta">${p.reason || "사유 미기입"}</p>
        <p class="admin-list-meta">${p.createdAt ? formatDate(p.createdAt) : "시간 미확인"}${until}</p>
      </div>
    `;
    punishmentList.appendChild(item);

    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = `${typeLabel} - ${p.createdAt ? formatDate(p.createdAt) : "시간 미확인"}`;
    appealTarget.appendChild(option);
  });
};

const loadPunishments = async (email) => {
  if (!punishmentStatus) return;
  setStatus(punishmentStatus, "최근 처벌을 불러오는 중입니다...");
  try {
    const punishments = await fetchRecentPunishments(email, 3);
    renderPunishments(punishments);
    setStatus(punishmentStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(punishmentStatus, "목록을 불러오지 못했습니다.", "error");
  }
};

const renderAppeals = (appeals) => {
  if (!appealHistory) return;
  appealHistory.innerHTML = "";

  if (!appeals.length) {
    appealHistory.innerHTML = '<li class="empty-state">등록된 이의제기가 없습니다.</li>';
    return;
  }

  appeals.forEach((appeal) => {
    const item = document.createElement("li");
    item.className = "admin-list-item";
    const statusLabel =
      appeal.status === "approved"
        ? "승인"
        : appeal.status === "rejected"
        ? "거부"
        : appeal.status === "onHold"
        ? "처리 보류"
        : "대기";
    const summaryLabel = appeal.punishmentSummary?.label || "최근 처벌";
    const summaryReason = appeal.punishmentSummary?.reason || "";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${summaryLabel}${summaryReason ? ` · ${summaryReason}` : ""}</div>
        <p class="admin-list-meta">${appeal.message}</p>
        <p class="admin-list-meta">상태: <span class="badge subtle">${statusLabel}</span>${
      appeal.statusReason ? ` · ${appeal.statusReason}` : ""
    }</p>
      </div>
      <div class="admin-list-actions">
        <span class="badge subtle">${appeal.createdAt ? formatDate(appeal.createdAt) : "제출 시간 미확인"}</span>
      </div>
    `;
    appealHistory.appendChild(item);
  });
};

const handleAppeal = (email) => {
  if (!appealForm) return;
  appealForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = appealMessage.value.trim();
    if (!message || message.length < 5) {
      setStatus(appealFormStatus, "이의제기 내용을 5글자 이상 입력하세요.", "error");
      return;
    }
    setStatus(appealFormStatus, "제출 중입니다...");
    try {
      const selected = punishments.find((p) => p.id === appealTarget.value);
      const label = selected
        ? `${selected.type === "warning" ? "경고" : selected.type === "caution" ? "주의" : "정지"} · ${
            selected.createdAt ? formatDate(selected.createdAt) : "시간 미확인"
          }`
        : "최근 처벌";
      const summaryReason = selected?.reason ? selected.reason : "";
      await createAppeal({
        email,
        punishmentId: appealTarget.value,
        message,
        punishmentSummary: { label, reason: summaryReason },
      });
      setStatus(appealFormStatus, "제출되었습니다. 관리자 검토를 기다려주세요.", "success");
      appealForm.reset();
      await loadAppealHistory(email);
    } catch (error) {
      console.error(error);
      setStatus(appealFormStatus, error.message || "제출 중 오류가 발생했습니다.", "error");
    }
  });
};

const loadAppealHistory = async (email) => {
  if (!appealHistoryStatus) return;
  setStatus(appealHistoryStatus, "이의제기 현황을 불러오는 중입니다...");
  try {
    const appeals = await fetchUserAppeals(email);
    renderAppeals(appeals);
    setStatus(appealHistoryStatus, "");
  } catch (error) {
    console.error(error);
    setStatus(appealHistoryStatus, "이의제기를 불러오지 못했습니다.", "error");
  }
};

const init = () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      if (guard) guard.innerHTML = "<p class=\"settings-help\">로그인 후 이용 가능합니다.</p>";
      setTimeout(() => (window.location.href = "/login"), 800);
      return;
    }
    if (guard) guard.hidden = true;
    if (content) content.hidden = false;
    await loadPunishments(user.email);
    await loadAppealHistory(user.email);
    handleAppeal(user.email);
  });
};

init();
