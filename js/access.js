import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseApp } from "./firebase.js";

const db = getFirestore(firebaseApp);
const OWNER_EMAIL = "seungminlee14@naver.com";
export const ADMIN_EMAILS = [OWNER_EMAIL];

const normalizeEmail = (email) => (email || "").trim().toLowerCase();
export const isAdminEmail = (email) => ADMIN_EMAILS.includes(normalizeEmail(email));
export const isOwnerEmail = (email) => normalizeEmail(email) === OWNER_EMAIL;

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
