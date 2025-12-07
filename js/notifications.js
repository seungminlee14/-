import {
  addDoc,
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseApp } from "./firebase.js";

const db = getFirestore(firebaseApp);
const notificationsRef = collection(db, "notifications");
const LAST_SEEN_KEY = "notifications:lastSeen";

export const listenToNotifications = (callback, maxItems = 20) => {
  const q = query(notificationsRef, orderBy("createdAt", "desc"), limit(maxItems));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
      };
    });
    callback(items);
  });
};

export const sendNotification = async ({ message, link, createdBy }) => {
  const trimmedMessage = (message || "").trim();
  const trimmedLink = (link || "").trim();
  if (!trimmedMessage) throw new Error("알림 내용을 입력하세요.");

  await addDoc(notificationsRef, {
    message: trimmedMessage,
    link: trimmedLink || null,
    createdAt: serverTimestamp(),
    createdBy: createdBy || "",
  });
};

export const markNotificationsSeen = (timestamp = Date.now()) => {
  localStorage.setItem(LAST_SEEN_KEY, String(timestamp));
};

export const getLastSeenTimestamp = () => {
  const stored = Number(localStorage.getItem(LAST_SEEN_KEY));
  return Number.isFinite(stored) ? stored : 0;
};
