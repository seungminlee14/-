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
import { isAdminEmail, isOwnerEmail, saveBan } from "./access.js";

const db = getFirestore(firebaseApp);
const postsRef = collection(db, "posts");

const adminGuard = document.getElementById("adminGuard");
const adminContent = document.getElementById("adminContent");
const deleteForm = document.getElementById("deletePostForm");
const deleteStatus = document.getElementById("deletePostStatus");
const banForm = document.getElementById("banForm");
const banStatus = document.getElementById("banStatus");

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
    } catch (error) {
      console.error(error);
      setStatus(banStatus, "정지 설정에 실패했습니다. 다시 시도해주세요.", "error");
    }
  });
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
  });
};

init();
