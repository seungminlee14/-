import { getFirestore, doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseApp } from "./firebase.js";

const db = getFirestore(firebaseApp);
const OWNER_EMAIL = "seungminlee14@naver.com";
export const ADMIN_EMAILS = [OWNER_EMAIL];

const normalizeEmail = (email) => (email || "").trim().toLowerCase();
export const isAdminEmail = (email) => ADMIN_EMAILS.includes(normalizeEmail(email));
export const isOwnerEmail = (email) => normalizeEmail(email) === OWNER_EMAIL;

export const fetchActiveBan = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const banRef = doc(db, "bans", normalized);
  const snap = await getDoc(banRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  const untilDate = data.until?.toDate ? data.until.toDate() : data.until ? new Date(data.until) : null;
  if (untilDate && untilDate <= new Date()) {
    await deleteDoc(banRef);
    return null;
  }
  return { id: banRef.id, ...data, untilDate };
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
};

export const clearBan = async (email) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  await deleteDoc(doc(db, "bans", normalized));
};
