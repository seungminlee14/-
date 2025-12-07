import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { auth } from "./firebase.js";
import {
  applyPunishments,
  isAdminEmail,
  isOwnerEmail,
  searchUsersByNickname,
  getPunishmentCounts,
} from "./access.js";

const guard = document.getElementById("adminPunishGuard");
const content = document.getElementById("adminPunishContent");
const nicknameInput = document.getElementById("searchNickname");
const nicknameButton = document.getElementById("searchNicknameButton");
const searchResults = document.getElementById("userSearchResults");
const emailInput = document.getElementById("targetEmail");
const addCautionsInput = document.getElementById("addCautions");
const addWarningsInput = document.getElementById("addWarnings");
const suspensionInput = document.getElementById("suspensionDays");
const reasonInput = document.getElementById("punishReason");
const previewBox = document.getElementById("punishPreview");
const statusBox = document.getElementById("punishStatus");
const submitButton = document.getElementById("punishSubmit");

const setStatus = (message, tone = "") => {
  if (!statusBox) return;
  statusBox.textContent = message;
  if (tone) statusBox.dataset.tone = tone;
  else delete statusBox.dataset.tone;
};

const renderResults = (users) => {
  if (!searchResults) return;
  searchResults.innerHTML = "";
  if (!users.length) {
    searchResults.innerHTML = '<span class="chip subtle">검색 결과 없음</span>';
    return;
  }
  users.forEach((user) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chip";
    button.textContent = `${user.nickname || "닉네임 없음"} (${user.id})`;
    button.addEventListener("click", () => {
      emailInput.value = user.id;
      setStatus("닉네임 검색 결과가 적용되었습니다.", "success");
    });
    searchResults.appendChild(button);
  });
};

const clamp = (value, min, max) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, num));
};

const renderPreview = async () => {
  if (!previewBox || !emailInput.value) return;
  const counts = await getPunishmentCounts(emailInput.value);
  const addCautions = clamp(addCautionsInput.value, 0, 10);
  const addWarnings = clamp(addWarningsInput.value, 0, 5);
  const totalCaution = counts.cautionRemainder + addCautions;
  const autoWarnings = Math.floor(totalCaution / 2);
  const newWarnings = addWarnings + autoWarnings;
  const warningAfter = counts.warningCount + newWarnings;
  const lines = [`현재 경고 ${counts.warningCount}회 → ${warningAfter}회`];
  if (autoWarnings > 0) lines.push(`주의 ${addCautions}회 중 ${autoWarnings}회가 경고로 전환됩니다.`);
  if (Number.isFinite(Number(suspensionInput.value))) {
    const days = Number(suspensionInput.value);
    if (days > 0) lines.push(`추가 정지 ${days}일 적용`);
    else if (days === 0) lines.push("추가 정지 영구 적용");
  }
  previewBox.textContent = lines.join(" · ");
};

const validate = () => {
  const email = emailInput.value.trim();
  const reason = reasonInput.value.trim();
  if (!email) {
    setStatus("대상 이메일을 입력하세요.", "error");
    return false;
  }
  if (isOwnerEmail(email)) {
    setStatus("소유자 계정은 처벌할 수 없습니다.", "error");
    return false;
  }
  if (!reason || reason.length < 5) {
    setStatus("사유를 5글자 이상 입력하세요.", "error");
    return false;
  }
  if (
    clamp(addCautionsInput.value, 0, 10) === 0 &&
    clamp(addWarningsInput.value, 0, 5) === 0 &&
    (!suspensionInput.value || Number(suspensionInput.value) < 0)
  ) {
    setStatus("추가할 처벌을 선택하세요.", "error");
    return false;
  }
  return true;
};

const handleSearch = () => {
  if (!nicknameButton) return;
  nicknameButton.addEventListener("click", async () => {
    if (!nicknameInput.value.trim()) return;
    const results = await searchUsersByNickname(nicknameInput.value.trim());
    renderResults(results);
  });
};

const handlePreviewChanges = () => {
  [addCautionsInput, addWarningsInput, suspensionInput, emailInput].forEach((el) => {
    el?.addEventListener("input", renderPreview);
  });
};

const handleSubmit = (adminEmail) => {
  if (!submitButton) return;
  submitButton.addEventListener("click", async () => {
    if (!validate()) return;
    setStatus("처벌을 적용하는 중입니다...");
    try {
      const result = await applyPunishments({
        email: emailInput.value.trim(),
        createdBy: adminEmail,
        reason: reasonInput.value.trim(),
        addCautions: clamp(addCautionsInput.value, 0, 10),
        addWarnings: clamp(addWarningsInput.value, 0, 5),
        suspensionDays: suspensionInput.value === "" ? null : Number(suspensionInput.value),
      });
      setStatus(`처리가 완료되었습니다. (경고 ${result.warningCount}회 누적)`, "success");
      if (result.summary?.length) {
        previewBox.textContent = result.summary.join(" · ");
      }
      addCautionsInput.value = "0";
      addWarningsInput.value = "0";
      suspensionInput.value = "";
      renderPreview();
    } catch (error) {
      console.error(error);
      setStatus("처리 중 오류가 발생했습니다. 입력을 확인하세요.", "error");
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
    handleSearch();
    handlePreviewChanges();
    handleSubmit(user.email);
    renderPreview();
  });
};

init();
