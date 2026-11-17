# Cloudflare Pages 배포 및 KV/D1 데이터 동기화 가이드

이 프로젝트는 **Cloudflare Pages Functions (`functions/api/state.ts`)**를 통해 **Cloudflare KV** 또는 **Cloudflare D1**에 점수, 칭찬스티커, 부모님 비밀번호, 실시간 타이머 상태를 저장하도록 구성되어 있습니다.

연결이 완료되면 **엄마 폰, 아빠 폰, 거실 태블릿, PC** 등 어떤 기기에서 접속해도 동일한 데이터가 유지되고 동기화됩니다.

---

## 1. Cloudflare KV 네임스페이스 생성 (무료)
1. [Cloudflare 대시보드](https://dash.cloudflare.com) 로그인
2. 왼쪽 메뉴에서 **Storage & Databases → Workers KV** 선택
3. **Create** 클릭 후 이름 입력 (예: `kids-edu-kv`) → **Add**

---

## 2. Cloudflare Pages 프로젝트 생성 및 배포
1. 왼쪽 메뉴에서 **Workers & Pages → Create → Pages** 선택
2. GitHub 저장소 연결 (`peppsiman/kids-edu-schedule-management`) 또는 직접 업로드(`dist` + `functions`)
3. 빌드 설정:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Save and Deploy** 실행

---

## 3. KV 바인딩 연결 (가장 중요!)
1. 배포된 Pages 프로젝트에서 **Settings → Bindings** (또는 **Functions → KV namespace bindings**) 메뉴로 이동
2. **Add** → **KV namespace** 선택
3. 아래와 같이 입력 후 저장:
   - **Variable name**: `KIDS_EDU_KV` (반드시 정확히 입력)
   - **KV namespace**: 1단계에서 만든 `kids-edu-kv` 선택
4. **Production** 및 **Preview** 환경 모두에 동일하게 추가
5. **Deployments → Retry deployment** (설정을 적용하려면 재배포 1회 필요)

> **참고 (D1 데이터베이스를 쓰고 싶은 경우):**
> KV 대신 Cloudflare D1을 생성하여 **Variable name**을 `KIDS_EDU_DB`로 바인딩하면 `functions/api/state.ts`가 자동으로 `app_state` 테이블을 생성하고 D1에 저장합니다.

---

## 4. 연결 확인 방법
1. 배포된 웹 주소로 접속합니다.
2. 상단 우측(또는 **배점표 & 설정** 탭)에 **`클라우드 동기화`** / **`Cloudflare KV 연결됨`** 표시가 뜨면 성공입니다.
3. 다른 기기(예: 스마트폰)에서 접속했을 때 동일한 점수와 스티커가 보이며, 채점 후 약 0.3초 뒤 자동 저장됩니다.
4. 다른 기기에서는 창을 다시 열거나(포커스 복귀), 15초 자동 갱신 또는 상단의 **`클라우드 동기화`** 버튼을 눌러 최신 데이터를 반영할 수 있습니다.
