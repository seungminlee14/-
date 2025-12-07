# 다츠 게임즈
간단한 정적 사이트로 홈, 로그인, 회원가입 페이지를 포함합니다. Firebase 설정을 로딩하며, `python -m http.server 8000`으로 로컬에서 확인할 수 있습니다.

## Firebase Hosting
- Firebase CLI에 로그인하고 프로젝트를 선택하세요: `firebase login` 후 `firebase use dats-games`
- 저장소 루트(이 디렉터리)에서 배포: `firebase deploy --only hosting`
- `firebase.json`의 `public`을 `.`로 설정하여 현재 파일 구조 그대로 호스팅합니다.

### 커스텀 도메인에서 인증이 안 될 때
- Firebase 콘솔 > Authentication > Settings에서 `Authorized domains`에 커스텀 도메인을 추가하세요.
- 추가하지 않으면 `auth/unauthorized-domain` 오류로 로그인·회원가입이 차단됩니다. UI에서 안내 문구가 표시됩니다.
- 오류가 떴을 때 해결 절차
  1. **Firebase Console → Authentication → Settings → Authorized domains**에 접속합니다.
  2. **Add domain**을 눌러 서비스 중인 정확한 호스트명을 입력합니다. (예: `example.com`, `preview.example.com`, Firebase Hosting 기본 도메인)
  3. 저장 후 5~10초 정도 기다렸다가 페이지를 새로고침하고 다시 로그인/회원가입을 시도합니다.

### Google / Microsoft 소셜 로그인 활성화
- Firebase 콘솔 > Authentication > Sign-in method에서 **Google**과 **Microsoft** 공급자를 켜고 저장하세요.
- Microsoft는 콘솔에 안내된 리디렉션 URL(`/__/auth/handler`)을 애플리케이션에 등록해야 합니다.
- 저장소의 로그인 화면에는 두 공급자 버튼이 준비되어 있으며, 콘솔에서 활성화만 하면 바로 동작합니다.

## Firestore 규칙 설정 (데이터베이스)
- Firebase 콘솔 > Firestore Database > Rules에서 아래 규칙을 붙여넣고 **게시**하세요.
- 동일한 내용을 저장소의 `firestore.rules`에도 포함시켜 `firebase deploy --only firestore:rules`로 배포할 수 있습니다.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 커뮤니티 글
    match /posts/{postId} {
      allow read: if true; // 모두 조회 가능
      allow create: if request.auth != null; // 로그인 후 작성
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.authorId; // 작성자만 수정/삭제

      // 댓글
      match /comments/{commentId} {
        allow read: if true;
        allow create: if request.auth != null;
      }

      // 좋아요/싫어요(사용자별 1개 문서)
      match /votes/{userId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }

    // 글 번호 카운터 등 메타데이터
    match /meta/{docId} {
      allow read, write: if request.auth != null;
    }

    // 계정 정지 목록
    match /bans/{email} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // 콘솔에서 관리자만 쓰도록 제어하세요.
    }

    // 정지/해제 기록
    match /banLogs/{logId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // 콘솔에서 관리자만 쓰도록 제어하세요.
    }

  }
}
```

## Cloud Storage 규칙 설정
- Firebase 콘솔 > Storage > Rules에서 아래 규칙을 붙여넣고 **게시**하세요.
- 게시물 이미지는 `posts/<게시물번호>_파일명` 경로로 업로드되며, 로그인한 사용자만 업로드/삭제할 수 있고 모두가 읽을 수 있습니다.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /posts/{allPaths=**} {
      allow read: if true;            // 이미지 공개
      allow write: if request.auth != null; // 로그인 사용자만 업로드/삭제
    }
  }
}
```

## 관리자 / 차단 안내
- `/admin` 페이지는 `seungminlee14@naver.com` 등 관리자 계정만 접근합니다.
- 관리자 페이지에서 게시물 번호로 글을 삭제하거나, 이메일 기준으로 계정을 정지/해제할 수 있습니다. 정지/해제 내역은 관리자가 확인할 수 있도록 로그가 남습니다.
- 정지된 계정은 로그인 시 `/banned`로 이동하며, 사유와 해제 예정일(설정한 경우)이 표시됩니다.
- 소유자 계정(`seungminlee14@naver.com`)은 삭제/정지할 수 없습니다.
- 위 Firestore 규칙 예시에 `bans`, `banLogs`가 포함되어 있으니 콘솔이나 `firebase deploy --only firestore:rules`로 배포하세요.
