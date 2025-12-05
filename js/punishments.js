import { fetchPendingPunishment, acknowledgePunishment } from "./access.js";

const formatDate = (date) =>
  date?.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const buildModal = (punishment) => {
  const overlay = document.createElement("div");
  overlay.className = "punishment-overlay";
  const card = document.createElement("div");
  card.className = "punishment-card";

  const title = document.createElement("h2");
  const typeLabel = punishment.type === "warning" ? "경고" : punishment.type === "caution" ? "주의" : "정지";
  title.textContent =
    punishment.type === "suspension"
      ? "귀하는 계정 사용이 중지되었습니다. 다음 내용을 확인하세요."
      : `귀하는 ${typeLabel} 처벌을 받았습니다. 다음 내용을 확인하세요.`;

  const badge = document.createElement("div");
  badge.className = "badge warning";
  badge.textContent = `${typeLabel}${punishment.count ? ` x${punishment.count}` : ""}`;

  const reason = document.createElement("p");
  reason.className = "punishment-reason";
  reason.textContent = punishment.reason || "사유가 입력되지 않았습니다.";

  const when = document.createElement("p");
  when.className = "punishment-meta";
  const parts = [];
  if (punishment.createdAt) parts.push(formatDate(punishment.createdAt));
  if (punishment.untilDate) parts.push(`${formatDate(punishment.untilDate)}까지`);
  when.textContent = parts.join(" · ");

  const actions = document.createElement("div");
  actions.className = "button-row end";
  const appealBtn = document.createElement("a");
  appealBtn.href = "/appeal";
  appealBtn.className = "button ghost";
  appealBtn.textContent = "이의제기";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "button primary";
  closeBtn.textContent = "확인하기";

  actions.appendChild(appealBtn);
  actions.appendChild(closeBtn);

  card.appendChild(badge);
  card.appendChild(title);
  card.appendChild(reason);
  card.appendChild(when);
  card.appendChild(actions);
  overlay.appendChild(card);

  closeBtn.addEventListener("click", async () => {
    try {
      await acknowledgePunishment(punishment.id);
    } catch (error) {
      console.error(error);
    }
    overlay.remove();
  });

  return overlay;
};

export const showPendingPunishment = async (email) => {
  const punishment = await fetchPendingPunishment(email);
  if (!punishment) return;
  const modal = buildModal(punishment);
  document.body.appendChild(modal);
};
