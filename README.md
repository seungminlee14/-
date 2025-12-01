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
