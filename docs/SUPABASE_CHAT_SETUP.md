# Supabase 채팅 내역 연동 가이드

Ably 무료 티어는 메시지 보존이 짧아(기본 약 2분) 200개/48시간 유지가 어렵습니다.  
**실시간 전송은 Ably**, **영구 보관은 Supabase**인 하이브리드 구조로 채팅 히스토리를 안정적으로 유지합니다.

---

## 1. 아키텍처 요약

| 구분 | 담당 | 설명 |
|------|------|------|
| **초기 로드** | Supabase | 입장 시 최근 48시간, 최대 200건 조회 |
| **실시간 수신** | Ably | 새 메시지 구독으로 즉시 반영 |
| **메시지 발신** | Ably + Supabase | Ably publish 동시에 Supabase insert |

---

## 2. Supabase 테이블 생성

Supabase 대시보드 → **SQL Editor**에서 아래를 실행합니다.

```sql
-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tamer_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  firebase_uid TEXT
);

-- 인덱스: 48시간 히스토리 조회용
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages (created_at DESC);

-- RLS: 로비 채팅은 익명/회원 모두 읽기·쓰기 허용
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for everyone"
  ON public.chat_messages FOR SELECT
  USING (true);

CREATE POLICY "Allow insert for everyone"
  ON public.chat_messages FOR INSERT
  WITH CHECK (true);
```

> **`firebase_uid`**: Firebase Auth `currentUser.uid`를 저장합니다. 앱/Edge Function에서 `WHERE firebase_uid = :uid`로 본인 메시지 조회·삭제 시 매칭에 사용합니다.

---

## 3. 48시간 이전 메시지 자동 삭제 (선택)

Supabase 용량 관리를 위해 **48시간이 지난 메시지를 주기적으로 삭제**하려면, 아래 함수를 만든 뒤 **외부 Cron**으로 실행합니다.

### 3-1. 삭제 함수 (필수)

SQL Editor에서 실행:

```sql
CREATE OR REPLACE FUNCTION delete_old_chat_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.chat_messages
  WHERE created_at < (now() - interval '48 hours');
END;
$$;
```

### 3-2. pg_cron 사용 불가 시 (권장: 외부 Cron)

**Supabase 기본 플랜에는 `pg_cron` 확장이 없어** `cron.schedule()`을 쓰면 `schema "cron" does not exist` 오류가 납니다.

**대안: Supabase Edge Function + 외부 Cron**

1. **Edge Function** `delete-old-chat-messages` 생성 후, 내부에서 Supabase 클라이언트로 `rpc('delete_old_chat_messages')` 호출.
2. **Vercel Cron** / **cron-job.org** / **GitHub Actions** 등에서 매일 해당 Edge Function URL로 `POST` 요청.

또는 **수동**: 주기적으로 SQL Editor에서 `SELECT delete_old_chat_messages();` 실행.

---

## 4. 환경 변수

프로젝트 루트 또는 `digimon-tamagotchi-frontend/.env`에 추가:

```
REACT_APP_SUPABASE_URL=https://xxxxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

- **Supabase 대시보드** → Project Settings → API  
  - `Project URL` → `REACT_APP_SUPABASE_URL`  
  - `anon` `public` 키 → `REACT_APP_SUPABASE_ANON_KEY`

Vercel 등 호스팅에서도 동일 키를 환경 변수로 설정해야 합니다.

---

## 5. 구현 시 고려 사항

### ① 중복 메시지 (Deduplication)

- 전송 시 **클라이언트에서 UUID 생성** 후 Supabase `id`와 Ably `clientTempId`로 함께 사용.
- Ably 수신 시 `clientTempId` 또는 `message.id`로 **이미 있는 id면 무시**.

### ② 인증 (Firebase ↔ Supabase) — `firebase_uid` 매칭

- **저장**: `ChatRoom`에서 `useAuth()`로 `currentUser.uid`를 가져와, Supabase `insert` 시 `firebase_uid`에 `currentUser?.uid ?? null`을 넣습니다.
- **매칭 활용**: Supabase Postgres는 Firebase JWT를 검증할 수 없어 RLS의 `auth.uid()`로는 Firebase 사용자와 매칭할 수 없습니다.  
  - **앱/Edge Function**에서 `WHERE firebase_uid = :uid`로 “내 메시지만” 조회·삭제·수정하는 식으로 `firebase_uid`와 매칭합니다.
- **RLS**: 당장은 모두 SELECT/INSERT 허용. 추후 Edge Function에서 Firebase ID 토큰 검증 후 `firebase_uid`와 매칭해 본인 메시지만 DELETE/UPDATE 하도록 구현할 수 있습니다.

### ③ 성능 / 페이징

- 초기: `created_at DESC`로 200건만 조회.  
- 나중에 메시지가 많아지면, **위로 스크롤 시 이전 구간 추가 로드(Infinite Scroll)** 를 고려.

### ④ Supabase 쓰기 실패

- Ably publish는 유지 → 다른 사용자에는 실시간 전달.
- Supabase insert 실패 시: 재시도/로깅/토스트 등으로 처리.  
- 고도화: Ably Reactor Webhook으로 Ably → Supabase 직접 저장도 가능.

### ⑤ 비용·용량

- 48시간 초과分 삭제(위 cron/외부 스케줄)로 DB 용량을 일정 수준으로 유지.

---

## 6. 의존성

```bash
npm install @supabase/supabase-js
```

---

## 7. 참고 파일

- `src/supabase.js` : Supabase 클라이언트 생성
- `src/components/ChatRoom.jsx` :  
  - 초기: Supabase `chat_messages` 48h/200건  
  - 발신: Ably publish + Supabase insert (UUID 공유)  
  - 수신: Ably 구독 + `id`/`clientTempId` 기반 dedup
