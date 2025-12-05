import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseApp } from "./firebase.js";

const db = getFirestore(firebaseApp);
const OWNER_EMAIL = "seungminlee14@naver.com";
export const ADMIN_EMAILS = [OWNER_EMAIL];

const normalizeEmail = (email) => (email || "").trim().toLowerCase();
export const isAdminEmail = (email) => ADMIN_EMAILS.includes(normalizeEmail(email));
export const isOwnerEmail = (email) => normalizeEmail(email) === OWNER_EMAIL;

const userDirectoryRef = collection(db, "userDirectory");
const punishmentsRef = collection(db, "punishments");
const punishmentCountsRef = collection(db, "punishmentCounts");
const appealsRef = collection(db, "appeals");

const formatUntilDate = (untilValue) => {
  const untilDate = untilValue?.toDate ? untilValue.toDate() : untilValue ? new Date(untilValue) : null;
  return untilDate || null;
};

export const fetchActiveBan = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const banRef = doc(db, "bans", normalized);
  const snap = await getDoc(banRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  const untilDate = formatUntilDate(data.until);
  if (untilDate && untilDate <= new Date()) {
    await deleteDoc(banRef);
    return null;
  }
  return { id: banRef.id, ...data, untilDate };
};

export const listActiveBans = async () => {
  const bansRef = collection(db, "bans");
  const snap = await getDocs(bansRef);
  const now = new Date();
  const active = [];

  await Promise.all(
    snap.docs.map(async (docSnap) => {
      const data = docSnap.data();
      const untilDate = formatUntilDate(data.until);
      if (untilDate && untilDate <= now) {
        await deleteDoc(docSnap.ref);
        return;
      }
      active.push({ id: docSnap.id, ...data, untilDate });
    })
  );

  active.sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });

  return active;
};

export const fetchBanLogs = async () => {
  const logsRef = collection(db, "banLogs");
  const q = query(logsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      untilDate: formatUntilDate(data.until),
      createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : null,
    };
  });
};

export const fetchPunishmentHistory = async () => {
  const q = query(punishmentsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAtDate: data.createdAt?.toDate ? data.createdAt.toDate() : null,
      untilDate: formatUntilDate(data.until),
    };
  });
};

const recordBanLog = async ({ email, action, reason, untilDate, createdBy }) => {
  const normalized = normalizeEmail(email);
  await addDoc(collection(db, "banLogs"), {
    emailLower: normalized,
    action,
    reason: reason || "관리자에 의해 처리되었습니다.",
    until: untilDate ? Timestamp.fromDate(untilDate) : null,
    createdAt: serverTimestamp(),
    createdBy: createdBy ? normalizeEmail(createdBy) : "",
  });
};

export const saveBan = async ({ email, reason, untilDate, createdBy }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("이메일을 입력하세요.");
  const banRef = doc(db, "bans", normalized);
  await setDoc(banRef, {
    emailLower: normalized,
    reason: reason || "관리자에 의해 차단되었습니다.",
    until: untilDate ? Timestamp.fromDate(untilDate) : null,
    createdAt: serverTimestamp(),
    createdBy: createdBy ? normalizeEmail(createdBy) : "",
  });
  await recordBanLog({ email: normalized, action: "ban", reason, untilDate, createdBy });
};

export const clearBan = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await deleteDoc(doc(db, "bans", normalized));
  await recordBanLog({ email: normalized, action: "unban", reason: "관리자가 해제", untilDate: null, createdBy: null });
};

export const saveUserDirectoryEntry = async ({ email, nickname, photoURL }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const entryRef = doc(userDirectoryRef, normalized);
  await setDoc(
    entryRef,
    {
      emailLower: normalized,
      nickname: nickname || "",
      photoURL: photoURL || "",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

export const searchUsersByNickname = async (nickname) => {
  if (!nickname?.trim()) return [];
  const q = query(userDirectoryRef, where("nickname", "==", nickname.trim()));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
};

const warningStepDurations = [null, 3, 7, 14, 35, 0];

const getWarningSuspensionDays = (warningCount) => {
  if (warningCount <= 0) return null;
  const index = Math.min(warningCount, warningStepDurations.length - 1);
  return warningStepDurations[index];
};

export const getPunishmentCounts = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return { warningCount: 0, cautionRemainder: 0 };
  const countsRef = doc(punishmentCountsRef, normalized);
  const snap = await getDoc(countsRef);
  if (!snap.exists()) return { warningCount: 0, cautionRemainder: 0 };
  const data = snap.data();
  return {
    warningCount: data.warningCount || 0,
    cautionRemainder: data.cautionRemainder || 0,
  };
};

const savePunishmentCounts = async (email, counts) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const countsRef = doc(punishmentCountsRef, normalized);
  await setDoc(
    countsRef,
    {
      emailLower: normalized,
      warningCount: counts.warningCount,
      cautionRemainder: counts.cautionRemainder,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
};

const createSuspension = async ({ email, reason, days, createdBy }) => {
  const normalized = normalizeEmail(email);
  const untilDate = days === null ? null : (() => {
    if (typeof days !== "number") return null;
    if (days <= 0) return null;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  })();

  await saveBan({ email: normalized, reason, untilDate, createdBy });
  await addDoc(punishmentsRef, {
    emailLower: normalized,
    type: "suspension",
    reason,
    durationDays: days,
    until: untilDate ? Timestamp.fromDate(untilDate) : null,
    createdAt: serverTimestamp(),
    createdBy: createdBy ? normalizeEmail(createdBy) : "",
    acknowledged: false,
  });

  return untilDate;
};

export const applyPunishments = async ({
  email,
  createdBy,
  reason,
  addCautions = 0,
  addWarnings = 0,
  suspensionDays = null,
}) => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("이메일을 입력하세요.");
  if (!reason || reason.trim().length < 5) throw new Error("사유를 5글자 이상 입력하세요.");

  const counts = await getPunishmentCounts(normalized);
  const batch = writeBatch(db);
  const summary = [];
  let newWarnings = addWarnings || 0;

  if (addCautions > 0) {
    const totalCaution = counts.cautionRemainder + addCautions;
    const autoWarnings = Math.floor(totalCaution / 2);
    counts.cautionRemainder = totalCaution % 2;
    newWarnings += autoWarnings;

    batch.set(doc(punishmentsRef), {
      emailLower: normalized,
      type: "caution",
      count: addCautions,
      reason,
      createdAt: serverTimestamp(),
      createdBy: createdBy ? normalizeEmail(createdBy) : "",
      acknowledged: false,
    });

    if (autoWarnings > 0) {
      batch.set(doc(punishmentsRef), {
        emailLower: normalized,
        type: "warning",
        count: autoWarnings,
        autoFrom: "caution",
        reason,
        createdAt: serverTimestamp(),
        createdBy: createdBy ? normalizeEmail(createdBy) : "",
        acknowledged: false,
      });
      summary.push(`주의 ${addCautions}회 → 경고 ${autoWarnings}회 자동 전환`);
    }
  }

  if (newWarnings > 0) {
    batch.set(doc(punishmentsRef), {
      emailLower: normalized,
      type: "warning",
      count: newWarnings,
      reason,
      createdAt: serverTimestamp(),
      createdBy: createdBy ? normalizeEmail(createdBy) : "",
      acknowledged: false,
    });
  }

  const previousWarnings = counts.warningCount;
  counts.warningCount += newWarnings;
  await savePunishmentCounts(normalized, counts);

  let autoSuspensionDays = null;
  if (counts.warningCount > previousWarnings) {
    autoSuspensionDays = getWarningSuspensionDays(counts.warningCount);
  }

  if (suspensionDays !== null && typeof suspensionDays === "number" && suspensionDays >= 0) {
    summary.push(`정지 ${suspensionDays === 0 ? "영구" : `${suspensionDays}일`}`);
    await createSuspension({ email: normalized, reason, days: suspensionDays, createdBy });
  }

  if (autoSuspensionDays !== null) {
    summary.push(`경고 누적에 따른 정지 ${autoSuspensionDays === 0 ? "영구" : `${autoSuspensionDays}일`}`);
    await createSuspension({
      email: normalized,
      reason: `${reason} (경고 누적)`,
      days: autoSuspensionDays,
      createdBy,
    });
  }

  await batch.commit();
  return { warningCount: counts.warningCount, cautionRemainder: counts.cautionRemainder, summary };
};

export const fetchRecentPunishments = async (email, years = 3) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return [];
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - years);

  const q = query(
    punishmentsRef,
    where("emailLower", "==", normalized),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
      if (createdAt && createdAt < cutoff) return null;
      return { id: docSnap.id, ...data, createdAt, untilDate: formatUntilDate(data.until) };
    })
    .filter(Boolean);
};

export const acknowledgePunishment = async (id) => {
  if (!id) return;
  await updateDoc(doc(punishmentsRef, id), { acknowledged: true, acknowledgedAt: serverTimestamp() });
};

export const fetchPendingPunishment = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const q = query(
    punishmentsRef,
    where("emailLower", "==", normalized),
    where("acknowledged", "==", false),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
    untilDate: formatUntilDate(data.until),
  };
};

export const createAppeal = async ({ email, punishmentId, message }) => {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("이메일이 필요합니다.");
  if (!message || message.trim().length < 5) throw new Error("이의제기 내용을 5글자 이상 입력하세요.");
  await addDoc(appealsRef, {
    emailLower: normalized,
    punishmentId: punishmentId || "",
    message,
    status: "open",
    createdAt: serverTimestamp(),
  });
};

export const fetchAppeals = async () => {
  const q = query(appealsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data();
    return { id: docSnap.id, ...data, createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null };
  });
};

export const resolveAppeal = async ({ id, status }) => {
  if (!id) return;
  await updateDoc(doc(appealsRef, id), { status, resolvedAt: serverTimestamp() });
};
