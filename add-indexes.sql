-- ============================================
-- 성능 최적화: 데이터베이스 인덱스 추가
-- ============================================
-- 
-- ⚠️ 주의사항:
-- 1. 상용 환경에서는 CONCURRENTLY 옵션 필수 (테이블 잠금 방지)
-- 2. 사용량 적은 시간대 실행 권장 (새벽 2-5시)
-- 3. 한 번에 하나씩 실행하고 완료 확인
-- 4. 디스크 공간 충분한지 확인 (최소 20% 여유)
--
-- 실행 방법:
-- psql $DATABASE_URL -f add-indexes.sql
--

-- ============================================
-- 1단계: 작은 테이블 (빠름, 1-2분)
-- ============================================

-- workout_types (운동 종류)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workout_types_name 
ON workout_types(name);

\echo '✓ idx_workout_types_name 생성 완료'

-- ============================================
-- 2단계: 중간 테이블 (5-10분)
-- ============================================

-- members (회원 - 트레이너별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_trainer 
ON members(trainer) 
WHERE status = 'active';

\echo '✓ idx_members_trainer 생성 완료'

-- members (회원 - 이름 검색)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_members_name 
ON members(name);

\echo '✓ idx_members_name 생성 완료'

-- expenses (지출 - 트레이너별 월별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_trainer_month 
ON expenses(trainer, month);

\echo '✓ idx_expenses_trainer_month 생성 완료'

-- expenses (지출 - 센터별 월별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_center_month 
ON expenses(center, month);

\echo '✓ idx_expenses_center_month 생성 완료'

-- trainer_ledger (트레이너 장부)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trainer_ledger_username_month 
ON trainer_ledger(trainer_username, month DESC);

\echo '✓ idx_trainer_ledger_username_month 생성 완료'

-- metrics (지표 - 센터별 월별 조회)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_center_month 
ON metrics(center, month DESC);

\echo '✓ idx_metrics_center_month 생성 완료'

-- ============================================
-- 3단계: 큰 테이블 (10-30분, 데이터 많으면 더 오래 걸릴 수 있음)
-- ============================================

-- workout_records (운동기록 - 이미 있는지 확인)
-- workout-records-db.js에서 이미 생성하고 있으므로 체크만
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND tablename = 'workout_records' 
        AND indexname = 'idx_workout_records_user_date'
    ) THEN
        CREATE INDEX CONCURRENTLY idx_workout_records_user_date 
        ON workout_records(app_user_id, workout_date DESC);
        RAISE NOTICE '✓ idx_workout_records_user_date 생성 완료';
    ELSE
        RAISE NOTICE '→ idx_workout_records_user_date 이미 존재';
    END IF;
END $$;

-- diet_records (식단기록)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_diet_records_user_date 
ON diet_records(app_user_id, meal_date DESC);

\echo '✓ idx_diet_records_user_date 생성 완료'

-- consultation_records (상담기록 - 회원별)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultation_records_member_date 
ON consultation_records(member_name, consultation_date DESC);

\echo '✓ idx_consultation_records_member_date 생성 완료'

-- consultation_records (상담기록 - 트레이너별)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_consultation_records_trainer_date 
ON consultation_records(trainer, consultation_date DESC);

\echo '✓ idx_consultation_records_trainer_date 생성 완료'

-- elmo_calendar_records (엘모 캘린더)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_elmo_calendar_user_date 
ON elmo_calendar_records(app_user_id, record_date DESC);

\echo '✓ idx_elmo_calendar_user_date 생성 완료'

-- app_user_activity_events (유저 활동 이벤트)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_events_user_date 
ON app_user_activity_events(app_user_id, event_date DESC);

\echo '✓ idx_activity_events_user_date 생성 완료'

-- ============================================
-- 완료 확인
-- ============================================

\echo ''
\echo '=========================================='
\echo '✅ 인덱스 생성 완료!'
\echo '=========================================='
\echo ''

-- 생성된 인덱스 목록 확인
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes 
WHERE indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

\echo ''
\echo '=========================================='
\echo '📊 다음 단계:'
\echo '1. 느린 쿼리 로그 확인 (24-48시간)'
\echo '2. 사용자 피드백 수집'
\echo '3. 성능 개선 효과 측정'
\echo '=========================================='
