# 다츠 게임즈
간단한 정적 사이트로 홈, 로그인, 회원가입 페이지를 포함합니다. Firebase 설정을 로딩하며, `python -m http.server 8000`으로 로컬에서 확인할 수 있습니다.

## Firebase Hosting
- Firebase CLI에 로그인하고 프로젝트를 선택하세요: `firebase login` 후 `firebase use dats-games`
- 저장소 루트(이 디렉터리)에서 배포: `firebase deploy --only hosting`
- `firebase.json`의 `public`을 `.`로 설정하여 현재 파일 구조 그대로 호스팅합니다.

### 커스텀 도메인에서 인증이 안 될 때
- Firebase 콘솔 > Authentication > Settings에서 `Authorized domains`에 커스텀 도메인을 추가하세요.
- 추가하지 않으면 `auth/unauthorized-domain` 오류로 로그인·회원가입이 차단됩니다. UI에서 안내 문구가 표시됩니다.

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
- Firestore 규칙 예시 (관리 콘솔 > Firestore Rules):
  ```
  match /databases/{database}/documents {
    match /bans/{email} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // 콘솔에서 관리자만 쓰도록 제어하세요.
    }

    match /banLogs/{logId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
  ```
