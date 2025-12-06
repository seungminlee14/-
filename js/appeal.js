import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import { createAppeal, fetchRecentPunishments } from "./access.js";

const guard = document.getElementById("appealGuard");
const content = document.getElementById("appealContent");
const punishmentList = document.getElementById("punishmentList");
const punishmentStatus = document.getElementById("punishmentStatus");
const appealForm = document.getElementById("appealForm");
const appealTarget = document.getElementById("appealTarget");
const appealMessage = document.getElementById("appealMessage");
const appealFormStatus = document.getElementById("appealFormStatus");

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

const renderPunishments = (punishments) => {
  if (!punishmentList) return;
  punishmentList.innerHTML = "";
  appealTarget.innerHTML = "";

  if (!punishments.length) {
    punishmentList.innerHTML = '<li class="empty-state">최근 3년간 받은 처벌이 없습니다.</li>';
    appealTarget.innerHTML = '<option value="">최근 처벌 없음</option>';
    return;
  }

  punishments.forEach((p) => {
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
      await createAppeal({ email, punishmentId: appealTarget.value, message });
      setStatus(appealFormStatus, "제출되었습니다. 관리자 검토를 기다려주세요.", "success");
      appealForm.reset();
    } catch (error) {
      console.error(error);
      setStatus(appealFormStatus, "제출 중 오류가 발생했습니다.", "error");
    }
  });
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
    handleAppeal(user.email);
  });
};

init();
