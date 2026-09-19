# Quiet Notes · 일코 모드

기존 UI 테마 위에 켜고 끄는 SillyTavern 확장입니다. 태번 헬퍼나 Javascript Runner가 필요하지 않습니다.

## URL로 설치

실리 → 확장 → 확장 설치에 다음 주소를 넣습니다.

```
https://github.com/zxvniqi/quiet-notes
```

설치 후 새로고침하고 오른쪽 아래 **일코 OFF** 버튼을 누릅니다. 원래 UI 테마를 선택한 상태에서 사용하세요. 이전 Quiet Notes 시험용 태번 헬퍼 스크립트는 꺼 두세요.

## 조작

- **일코 ON/OFF**: 메모 화면과 기존 테마 사이 전환. 첫 설치는 OFF.
- **도구**: 기본 상단바와 Chat Top Bar를 함께 클릭으로 접기/펼치기.
- **입력**: 상단의 버튼으로 하단 입력 바 전체를 접기/펼치기. 접은 동안 전송·중지 버튼도 숨겨지므로 필요하면 펼치세요.
- **QR**: 배치·분류·스크롤·접기 동작을 수정하지 않습니다. 선택한 기존 UI 테마와 QR 확장 설정을 그대로 따릅니다.
- **보기**: 프사, 본문 이미지·에셋, 임베드, 이름 표시 선택.
- **Ctrl+Shift+M**: 일코 모드 전환.

상단 아이콘은 기능과 툴팁을 유지하는 선 아이콘으로 바뀌고, 브라우저 탭은 문서 아이콘과 메모 제목을 사용합니다. OFF로 돌리면 원래 탭 아이콘과 제목을 복원합니다. 확장 목록에서 Quiet Notes 옆의 계정 ID 배지는 숨깁니다. GitHub 저장소 소유자 자체를 익명화하지는 않습니다.

설정은 현재 브라우저에만 저장됩니다. 대화 내용, QR 명령, API 설정, UI 테마 파일은 변경하지 않습니다. 외부 통신이나 분석 수집을 하지 않습니다. iframe 내부는 건드리지 않으며 기능 보존을 위해 임베드는 기본 표시입니다.

## 최초 로딩을 완전히 대체하기

브라우저 확장 코드는 기본 로딩 화면보다 늦게 실행됩니다. **확장 설치만으로는 기존 로딩 → 일코 로딩 순서가 남습니다.** 첫 화면부터 문서 로딩만 보이게 하려면 실리를 실행하는 서버에서 다음 일회성 설정이 필요합니다.

### 터묵스에서 한 줄로 적용

기본 설치 위치가 `~/SillyTavern`인 경우 다음을 그대로 복사합니다. 다른 위치에 설치했다면 마지막 경로만 실제 실리 폴더로 바꾸세요. 실리가 실행되는 터묵스에서 실행해야 합니다.

```sh
curl -fL https://raw.githubusercontent.com/zxvniqi/quiet-notes/main/startup-setup.cjs -o "$HOME/quiet-notes-startup.cjs" && node "$HOME/quiet-notes-startup.cjs" --root "$HOME/SillyTavern"
```

Node.js는 실리 실행에 사용하던 것을 사용합니다. curl 명령이 없다면 먼저 `pkg install curl`을 실행하세요. 파일 하나에 필요한 CSS가 포함되어 있어, Quiet Notes 확장이 설치되어 있지 않아도 로딩 화면 교체만 따로 쓸 수 있습니다.

되돌리기:

```sh
node "$HOME/quiet-notes-startup.cjs" --root "$HOME/SillyTavern" --remove
```

### Windows 등 다른 서버

이 저장소의 `startup-setup.cjs`를 내려받은 뒤 실행합니다. 경로는 실제 실리 설치 폴더로 바꿉니다.

```
node startup-setup.cjs --root "D:\SillyTavern"
```

서버의 `public/css/user.css`에 시작용 CSS를 직접 넣습니다. 별도 CSS 요청을 기다리지 않고 첫 로딩부터 적용됩니다. 기존 user.css 내용은 보존하며, 최초 변경 전 `.quiet-notes-backup` 백업을 남깁니다. 여러 번 실행해도 중복되지 않습니다. 테마 파일이나 실리 코어 코드는 수정하지 않습니다.

실리 화면을 새로고침해 확인하세요. 이 설정은 서버의 모든 사용자에게 중립 로딩 화면을 적용하며, 일코 OFF 상태에서도 동일합니다. 앱 설치 아이콘이나 HTML의 초기 탭 제목을 바꾸지는 않습니다.

되돌리기:

```
node startup-setup.cjs --root "D:\SillyTavern" --remove
```

서버에서 실행하기 어려우면 `startup.css` 내용을 `public/css/user.css` 끝에 직접 덧붙여도 됩니다. 기존 내용은 지우지 마세요.

## 호환 및 제거

SillyTavern 1.18.0의 기본 상단바, Chat Top Bar, Quick Replies DOM 구조를 기준으로 만들었습니다. 모든 제3자 확장 조합이나 생성 동작을 보증하지는 않습니다.

끄려면 일코 OFF. 제거하려면 확장 관리에서 제거한 뒤 새로고침하세요. 시작용 CSS도 적용했다면 위의 되돌리기를 먼저 실행하세요.

로딩 팝업과 아이콘 호환 구조는 [Blue Lemonade 3.7.9](https://github.com/kgangkgang/blue-lemonade)를 참고했습니다. 해당 확장의 코드를 복사하거나 설정을 변경하지 않습니다.
