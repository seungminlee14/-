import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import * as accessApi from "./access.js";

const { fetchPendingAppeals, isAdminEmail, updateAppealStatus } = accessApi;

const guard = document.getElementById("appealAdminGuard");
const content = document.getElementById("appealAdminContent");
const queueList = document.getElementById("appealQueue");
const queueStatus = document.getElementById("appealQueueStatus");
const refreshQueueButton = document.getElementById("refreshAppealQueue");
const reportNickname = document.getElementById("reportNickname");
const reportEmail = document.getElementById("reportEmail");
const reportPunishment = document.getElementById("reportPunishment");
const reportPunishedAt = document.getElementById("reportPunishedAt");
const reportMessage = document.getElementById("reportMessage");
const decisionForm = document.getElementById("appealDecisionForm");
const decisionReason = document.getElementById("appealDecisionReason");
const decisionStatus = document.getElementById("appealDecisionStatus");

let appeals = [];
let selectedId = "";

const formatDate = (date) =>
  date?.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) || "시간 정보 없음";

const setStatus = (el, message, tone = "") => {
  if (!el) return;
  el.textContent = message;
  if (tone) el.dataset.tone = tone;
  else delete el.dataset.tone;
};

const selectAppeal = (id) => {
  selectedId = id;
  const appeal = appeals.find((a) => a.id === id);
  if (!appeal) {
    reportNickname.textContent = "-";
    reportEmail.textContent = "-";
    reportPunishment.textContent = "-";
    reportPunishedAt.textContent = "-";
    reportMessage.textContent = "-";
    decisionForm.reset();
    return;
  }

  reportNickname.textContent = appeal.nickname || "닉네임 정보 없음";
  reportEmail.textContent = appeal.emailLower || "-";
  reportPunishment.textContent = appeal.punishmentSummary?.label || "처벌 내용 없음";
  reportPunishedAt.textContent = appeal.punishmentSummary?.createdAt
    ? formatDate(appeal.punishmentSummary.createdAt)
    : formatDate(appeal.createdAt);
  reportMessage.textContent = appeal.message || "이의제기 내용 없음";

  const statusField = decisionForm?.elements?.namedItem("status");
  if (statusField && statusField instanceof RadioNodeList) {
    statusField.value = appeal.status || "open";
  }
  if (decisionReason) decisionReason.value = appeal.statusReason || "";
};

const renderQueue = (items) => {
  if (!queueList) return;
  queueList.innerHTML = "";

  if (!items.length) {
    queueList.innerHTML = '<li class="empty-state">대기/보류 중인 이의제기가 없습니다.</li>';
    selectAppeal("");
    return;
  }

  items.forEach((appeal) => {
    const item = document.createElement("li");
    item.className = "admin-list-item";
    item.innerHTML = `
      <div>
        <div class="admin-list-title">${appeal.emailLower}</div>
        <p class="admin-list-meta">${appeal.punishmentSummary?.label || "처벌 내용 없음"}</p>
        <p class="admin-list-meta">${appeal.message}</p>
      </div>
      <div class="admin-list-actions">
        <span class="badge subtle">${appeal.createdAt ? formatDate(appeal.createdAt) : "접수 시간 없음"}</span>
        <button class="button ghost" data-open-report="${appeal.id}">보고서 보기</button>
      </div>
    `;
    queueList.appendChild(item);
  });
};

const loadAppeals = async () => {
  if (!queueStatus) return;
  setStatus(queueStatus, "이의제기를 불러오는 중입니다...");
  try {
    appeals = await fetchPendingAppeals();
    renderQueue(appeals);
    setStatus(queueStatus, appeals.length ? "" : "대기 중 항목이 없습니다.");
    if (appeals.length) {
      selectAppeal(appeals[0].id);
    }
  } catch (error) {
    console.error(error);
    setStatus(queueStatus, "목록을 불러오지 못했습니다. 다시 시도하세요.", "error");
  }
};

const bindQueueActions = () => {
  if (!queueList) return;
  queueList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.openReport;
    if (!id) return;
    selectAppeal(id);
  });
};

const bindDecisionForm = () => {
  if (!decisionForm) return;
  decisionForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedId) {
      setStatus(decisionStatus, "먼저 대기 중인 이의제기를 선택하세요.", "error");
      return;
    }
    const formStatus = decisionForm.elements.namedItem("status");
    const statusValue = formStatus?.value || "open";
    const reason = decisionReason.value.trim();
    if (!reason || reason.length < 15) {
      setStatus(decisionStatus, "사유를 15글자 이상 입력하세요.", "error");
      return;
    }
    setStatus(decisionStatus, "처리 중입니다...");
    try {
      const revoke = statusValue === "approved";
      await updateAppealStatus({ id: selectedId, status: statusValue, reason, revoke });
      setStatus(decisionStatus, "처리가 완료되었습니다.", "success");
      await loadAppeals();
    } catch (error) {
      console.error(error);
      setStatus(decisionStatus, error.message || "처리 중 오류가 발생했습니다.", "error");
    }
  });
};

const init = () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user || !isAdminEmail(user.email)) {
      if (guard) guard.innerHTML = "<p class=\"settings-help\">관리자만 접근 가능합니다.</p>";
      setTimeout(() => (window.location.href = "/"), 800);
      return;
    }

    if (guard) guard.hidden = true;
    if (content) content.hidden = false;
    bindQueueActions();
    bindDecisionForm();
    if (refreshQueueButton) refreshQueueButton.addEventListener("click", loadAppeals);
    await loadAppeals();
  });
};

init();
