import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  where,
  runTransaction,
  doc,
  serverTimestamp,
  getDoc,
  updateDoc,
  increment,
  startAfter,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { auth, firebaseApp } from "./firebase.js";

const db = getFirestore(firebaseApp);
const postsRef = collection(db, "posts");

const PAGE_SIZE = 10;

const openPostFormBtn = document.getElementById("openPostForm");
const closePostFormBtn = document.getElementById("closePostForm");
const postFormSection = document.getElementById("postFormSection");
const postForm = document.getElementById("postForm");
const postStatus = document.getElementById("postStatus");
const postsContainer = document.getElementById("postsContainer");
const paginationEl = document.getElementById("pagination");
const postListSection = document.getElementById("postListSection");
const postDetailSection = document.getElementById("postDetailSection");
const backToListBtn = document.getElementById("backToList");
const commentForm = document.getElementById("commentForm");
const commentsContainer = document.getElementById("commentsContainer");
const commentStatus = document.getElementById("commentStatus");

const detailTitle = document.getElementById("detailTitle");
const detailMeta = document.getElementById("detailMeta");
const detailContent = document.getElementById("detailContent");
const detailImage = document.getElementById("detailImage");
const likeButton = document.getElementById("likeButton");
const dislikeButton = document.getElementById("dislikeButton");
const likeCount = document.getElementById("likeCount");
const dislikeCount = document.getElementById("dislikeCount");

let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let currentDetail = null;
let currentVote = null;
let hasInitialized = false;

const getRouteState = () => {
  const path = window.location.pathname.replace(/\.html$/, "");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "community" && parts[1]) {
    if (parts[1].toLowerCase() === "create") return { create: true };
    const n = Number(parts[1]);
    if (Number.isFinite(n)) return { detail: n };
    return { invalidDetail: true };
  }
  const params = new URLSearchParams(window.location.search);
  const searchPost = params.get("post");
  if (searchPost) {
    const n = Number(searchPost);
    return Number.isFinite(n) ? { detail: n } : { invalidDetail: true };
  }
  const searchCreate = params.get("create");
  if (searchCreate === "true") return { create: true };
  if (params.get("previewCreate") === "true") return { create: true, previewCreate: true };
  return {};
};

const routeState = getRouteState();
const isDetailView = Boolean(routeState.detail);
const isCreateView = Boolean(routeState.create);
const isPreviewCreate = Boolean(routeState.previewCreate);

const togglePostForm = (show) => {
  if (!postFormSection) return;
  postFormSection.classList.toggle("hidden", !show);
};

const setStatus = (el, message, tone = "") => {
  if (!el) return;
  el.textContent = message;
  if (tone) {
    el.dataset.tone = tone;
  } else {
    delete el.dataset.tone;
  }
};

const formatDate = (timestamp) => {
  if (!timestamp) return "";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(
    date.getDate()
  ).padStart(2, "0")}`;
};

const renderPosts = (docs, startIndex) => {
  if (!postsContainer) return;
  postsContainer.innerHTML = "";
  if (docs.length === 0) {
    postsContainer.innerHTML = '<div class="empty-state">아직 게시물이 없어요. 첫 글을 올려주세요!</div>';
    return;
  }

  docs.forEach((snap, idx) => {
    const data = snap.data();
    const item = document.createElement("div");
    item.className = "post-item";
    const number = data.number ?? startIndex + idx + 1;

    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = data.title || "제목 없음";
    title.className = "post-title";

    const link = document.createElement("a");
    link.href = buildDetailUrl(number);
    link.appendChild(title);

    const meta = document.createElement("p");
    meta.className = "post-meta";
    meta.textContent = `${number} · ${data.authorName || "익명"} · ${formatDate(data.createdAt)}`;

    info.appendChild(link);
    info.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "post-actions";
    const like = document.createElement("span");
    like.className = "badge";
    like.textContent = `👍 ${data.likes || 0}`;
    const dislike = document.createElement("span");
    dislike.className = "badge";
    dislike.textContent = `👎 ${data.dislikes || 0}`;
    const comments = document.createElement("span");
    comments.className = "badge";
    comments.textContent = `💬 ${data.commentsCount || 0}`;
    actions.append(like, dislike, comments);

    item.append(info, actions);
    postsContainer.appendChild(item);
  });
};

const renderPagination = () => {
  if (!paginationEl) return;
  paginationEl.innerHTML = "";
  for (let i = 1; i <= totalPages; i += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `page-btn ${i === currentPage ? "active" : ""}`;
    btn.textContent = i;
    btn.addEventListener("click", () => {
      if (i !== currentPage) {
        currentPage = i;
        loadPosts();
      }
    });
    paginationEl.appendChild(btn);
  }
};

const buildDetailUrl = (number) => {
  const path = window.location.pathname;
  if (path.endsWith("community.html")) {
    return `community.html?post=${number}`;
  }
  return `/community/${number}`;
};

const buildListUrl = () => {
  const path = window.location.pathname;
  return path.endsWith("community.html") ? "community.html" : "/community";
};

const handleMissingPost = () => {
  alert("게시물이 없습니다");
  window.location.href = buildListUrl();
};

const loadCounts = async () => {
  const countSnapshot = await getCountFromServer(postsRef);
  const total = countSnapshot.data().count || 0;
  totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
};

const loadPosts = async () => {
  try {
    await loadCounts();
    const skip = (currentPage - 1) * PAGE_SIZE;
    let postsQuery = query(postsRef, orderBy("number", "desc"), limit(PAGE_SIZE));

    if (skip > 0) {
      const cursorSnapshot = await getDocs(query(postsRef, orderBy("number", "desc"), limit(skip)));
      const lastDoc = cursorSnapshot.docs[cursorSnapshot.docs.length - 1];
      if (lastDoc) {
        postsQuery = query(postsRef, orderBy("number", "desc"), startAfter(lastDoc), limit(PAGE_SIZE));
      }
    }

    const snapshot = await getDocs(postsQuery);
    renderPosts(snapshot.docs, skip);
    renderPagination();
  } catch (error) {
    setStatus(postStatus, "게시물을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.", "error");
    console.error(error);
  }
};

const toggleCreateAccess = (user) => {
  const shouldEnable = Boolean(user);
  if (postForm) {
    Array.from(postForm.elements).forEach((el) => {
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.disabled = !shouldEnable;
      }
    });
  }
  if (commentForm) {
    Array.from(commentForm.elements).forEach((el) => {
      if (el instanceof HTMLButtonElement || el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.disabled = !shouldEnable;
      }
    });
  }
};

const getNextPostNumber = () => {
  const counterRef = doc(db, "meta", "counters");
  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? snap.data().postCounter || 0 : 0;
    const next = current + 1;
    transaction.set(counterRef, { postCounter: next }, { merge: true });
    return next;
  });
}; 

const handleCreatePost = async (event) => {
  event.preventDefault();
  if (!currentUser) {
    setStatus(postStatus, "로그인 후 게시할 수 있습니다.", "error");
    return;
  }

  const title = document.getElementById("postTitle")?.value.trim();
  const content = document.getElementById("postContent")?.value.trim();

  if (!title || !content) {
    setStatus(postStatus, "제목과 내용을 모두 입력하세요.", "error");
    return;
  }

  setStatus(postStatus, "게시 중입니다...", "");
  try {
    const number = await getNextPostNumber();
    const imageUrl = ""; // 이미지 업로드 일시 중단

    const authorName = currentUser.displayName || currentUser.email || "사용자";

    await addDoc(postsRef, {
      number,
      title,
      content,
      imageUrl,
      authorId: currentUser.uid,
      authorName,
      createdAt: serverTimestamp(),
      likes: 0,
      dislikes: 0,
      commentsCount: 0,
    });

    setStatus(postStatus, "게시물이 등록되었습니다!", "success");
    postForm.reset();
    togglePostForm(false);
    currentPage = 1;
    loadPosts();
    window.history.replaceState({}, "", buildDetailUrl(number));
    window.location.href = buildDetailUrl(number);
  } catch (error) {
    console.error(error);
    setStatus(postStatus, "게시 중 오류가 발생했습니다. 다시 시도해주세요.", "error");
  }
};

const fetchPostByNumber = async (number) => {
  const postQuery = query(postsRef, where("number", "==", number), limit(1));
  const snapshot = await getDocs(postQuery);
  if (snapshot.empty) return null;
  return snapshot.docs[0];
};

const renderDetail = (snap) => {
  if (!snap) {
    detailTitle.textContent = "게시물을 찾을 수 없습니다.";
    postDetailSection?.classList.remove("hidden");
    postListSection?.classList.add("hidden");
    return;
  }
  const data = snap.data();
  currentDetail = { id: snap.id, ...data };
  detailTitle.textContent = data.title;
  detailContent.textContent = data.content;
  detailMeta.textContent = `${data.number} · ${data.authorName || "익명"} · ${formatDate(data.createdAt)}`;
  likeCount.textContent = data.likes || 0;
  dislikeCount.textContent = data.dislikes || 0;

  if (data.imageUrl) {
    detailImage.src = data.imageUrl;
    detailImage.classList.remove("hidden");
  } else {
    detailImage.classList.add("hidden");
  }

  postDetailSection?.classList.remove("hidden");
  postListSection?.classList.add("hidden");
};

const loadComments = async (postId) => {
  const commentsRef = collection(db, "posts", postId, "comments");
  const q = query(commentsRef, orderBy("createdAt", "asc"), limit(50));
  const snapshot = await getDocs(q);
  commentsContainer.innerHTML = "";
  if (snapshot.empty) {
    commentsContainer.innerHTML = '<div class="empty-state">첫 댓글을 남겨보세요!</div>';
    return;
  }
  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const item = document.createElement("div");
    item.className = "comment-item";
    const meta = document.createElement("p");
    meta.className = "comment-meta";
    meta.textContent = `${data.authorName || "익명"} · ${formatDate(data.createdAt)}`;
    const body = document.createElement("p");
    body.textContent = data.text;
    item.append(meta, body);
    commentsContainer.appendChild(item);
  });
};

const loadVoteState = async (postId) => {
  if (!currentUser) {
    currentVote = null;
    likeButton.classList.remove("active");
    dislikeButton.classList.remove("active");
    return;
  }
  const voteRef = doc(db, "posts", postId, "votes", currentUser.uid);
  const snap = await getDoc(voteRef);
  currentVote = snap.exists() ? snap.data().type : null;
  likeButton.classList.toggle("active", currentVote === "like");
  dislikeButton.classList.toggle("active", currentVote === "dislike");
};

const updateVote = async (type) => {
  if (!currentUser || !currentDetail) {
    alert("로그인 후 이용해주세요.");
    return;
  }
  const postRef = doc(db, "posts", currentDetail.id);
  const voteRef = doc(db, "posts", currentDetail.id, "votes", currentUser.uid);

  const result = await runTransaction(db, async (transaction) => {
    const postSnap = await transaction.get(postRef);
    if (!postSnap.exists()) throw new Error("게시물이 없습니다");
    const postData = postSnap.data();
    const voteSnap = await transaction.get(voteRef);
    let likes = postData.likes || 0;
    let dislikes = postData.dislikes || 0;
    const prev = voteSnap.exists() ? voteSnap.data().type : null;

    if (prev === type) {
      if (type === "like") likes -= 1; else dislikes -= 1;
      transaction.delete(voteRef);
      transaction.update(postRef, { likes, dislikes });
      return { likes, dislikes, vote: null };
    }

    if (prev === "like") likes -= 1;
    if (prev === "dislike") dislikes -= 1;
    if (type === "like") likes += 1; else dislikes += 1;

    transaction.set(voteRef, { type, updatedAt: serverTimestamp() });
    transaction.update(postRef, { likes, dislikes });
    return { likes, dislikes, vote: type };
  });

  likeCount.textContent = result.likes;
  dislikeCount.textContent = result.dislikes;
  currentVote = result.vote;
  likeButton.classList.toggle("active", currentVote === "like");
  dislikeButton.classList.toggle("active", currentVote === "dislike");
};

const handleCommentSubmit = async (event) => {
  event.preventDefault();
  if (!currentUser || !currentDetail) {
    setStatus(commentStatus, "로그인 후 댓글을 작성할 수 있습니다.", "error");
    return;
  }
  const text = document.getElementById("commentInput")?.value.trim();
  if (!text) {
    setStatus(commentStatus, "댓글 내용을 입력하세요.", "error");
    return;
  }
  setStatus(commentStatus, "등록 중...", "");
  try {
    const commentsRef = collection(db, "posts", currentDetail.id, "comments");
    const authorName = currentUser.displayName || currentUser.email || "사용자";
    await addDoc(commentsRef, {
      text,
      authorId: currentUser.uid,
      authorName,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "posts", currentDetail.id), { commentsCount: increment(1) });
    setStatus(commentStatus, "등록되었습니다!", "success");
    document.getElementById("commentInput").value = "";
    loadComments(currentDetail.id);
  } catch (error) {
    console.error(error);
    setStatus(commentStatus, "댓글 등록 중 오류가 발생했습니다.", "error");
  }
};

const loadDetail = async () => {
  const number = routeState.detail;
  if (!number) return;
  try {
    const snap = await fetchPostByNumber(number);
    if (!snap) {
      handleMissingPost();
      return;
    }
    renderDetail(snap);
    await loadVoteState(snap.id);
    await loadComments(snap.id);
  } catch (error) {
    console.error(error);
  }
};

const handleOpenCreate = () => {
  if (!currentUser) {
    alert("로그인하여 게시물을 올려보세요!");
    return;
  }
  window.location.href = "/community/Create";
};

if (openPostFormBtn && closePostFormBtn) {
  openPostFormBtn.addEventListener("click", handleOpenCreate);
  closePostFormBtn.addEventListener("click", () => togglePostForm(false));
}

postForm?.addEventListener("submit", handleCreatePost);
commentForm?.addEventListener("submit", handleCommentSubmit);
likeButton?.addEventListener("click", () => updateVote("like"));
dislikeButton?.addEventListener("click", () => updateVote("dislike"));
backToListBtn?.addEventListener("click", () => {
  postDetailSection?.classList.add("hidden");
  postListSection?.classList.remove("hidden");
  window.history.pushState({}, "", buildListUrl());
  loadPosts();
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  toggleCreateAccess(user);
  if (isDetailView && currentDetail) {
    loadVoteState(currentDetail.id);
  }
  if (!hasInitialized) {
    hasInitialized = true;
    if (routeState.invalidDetail) {
      handleMissingPost();
      return;
    }
    if (isDetailView) {
      loadDetail();
    } else if (isCreateView) {
      togglePostForm(true);
      postListSection?.classList.add("hidden");
      postDetailSection?.classList.add("hidden");
      if (!currentUser && !isPreviewCreate) {
        alert("로그인하여 게시물을 올려보세요!");
        window.location.href = "/login";
        return;
      }
      if (!currentUser && isPreviewCreate) {
        setStatus(postStatus, "로그인 후 게시할 수 있습니다. (미리보기)", "info");
      }
    } else {
      loadPosts();
    }
  }
});
