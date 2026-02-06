const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const sharp = require('sharp');
const ExcelJS = require('exceljs');
const { getKoreanDate, getKoreanToday, parseKoreanDate, getKoreanYearMonth } = require('./utils');

require('dotenv').config();

// PostgreSQL 세션 데이터베이스 모듈
const sessionsDB = require('./sessions-db');
const membersDB = require('./members-db');
const monthlyStatsDB = require('./monthly-stats-db');
const registrationLogsDB = require('./registration-logs-db');
const expensesDB = require('./expenses-db');
const trialsDB = require('./trials-db');
const renewalsDB = require('./renewals-db');
const parsedMemberSnapshotsDB = require('./parsed-member-snapshots-db');
const parsedSalesSnapshotsDB = require('./parsed-sales-snapshots-db');
const salesDB = require('./sales-db');
const metricsDB = require('./metrics-db');
const marketingDB = require('./marketing-db');
const ledgerDB = require('./ledger-db');
const trainerLedgerDB = require('./trainer-ledger-db');
const trainerRevenueDB = require('./trainer-revenue-db');
const appUsersDB = require('./app-users-db');
const workoutRecordsDB = require('./workout-records-db');
const workoutTypesDB = require('./workout-types-db');
const favoriteWorkoutsDB = require('./app-user-favorite-workouts-db');
const userSettingsDB = require('./app-user-settings-db');
const dietRecordsDB = require('./diet-records-db');
const activityLogsDB = require('./trainer-activity-logs-db');
const memberActivityLogsDB = require('./member-activity-logs-db');
const appUserActivityEventsDB = require('./app-user-activity-events-db');
const achievementsDB = require('./achievements-db');
const workoutCommentsDB = require('./workout-comments-db');
const dietDailyCommentsDB = require('./diet-daily-comments-db');
const consultationRecordsDB = require('./consultation-records-db');
const consultationSharesDB = require('./consultation-shares-db');
const elmoUsersDB = require('./elmo-users-db');
const elmoCalendarRecordsDB = require('./elmo-calendar-records-db');
const elmoApiRouter = require('./elmo-api-router');
const { ELMO_IMAGES_DIR } = require('./elmo-utils');
const { initializeMigrationSystem, runMigration } = require('./migrations-manager');
const { createPerformanceIndexes } = require('./index-migration');

// 무기명/체험 세션 판별 함수
function isTrialSession(memberName) {
  return memberName && (
    memberName.startsWith('무기명') || 
    memberName.startsWith('체험')
  );
}

// 트레이너 활동 로그 생성 유틸리티 함수
async function createActivityLogForTrainer(appUserId, activityType, message, recordId = null, recordDate = null) {
  try {
    // app_user_id로 회원 정보 조회
    const appUser = await appUsersDB.getAppUserById(appUserId);
    if (!appUser || !appUser.member_name) {
      // 회원과 연결되지 않은 앱 유저는 로그 생성 안함
      return;
    }
    
    // 회원 정보로 트레이너 확인
    const member = await membersDB.getMemberByName(appUser.member_name);
    if (!member || !member.trainer) {
      // 트레이너가 없는 회원은 로그 생성 안함
      return;
    }
    
    // 날짜 포맷팅 (월/일 형식) - 실제 기록 날짜 사용, 없으면 오늘 날짜
    let dateStr = '';
    if (recordDate) {
      // 문자열 날짜(YYYY-MM-DD)를 로컬 타임존 기준으로 파싱
      let date;
      if (typeof recordDate === 'string' && recordDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD 형식인 경우 로컬 타임존 기준으로 파싱
        const [year, month, day] = recordDate.split('-').map(Number);
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(recordDate);
      }
      const month = date.getMonth() + 1;
      const day = date.getDate();
      dateStr = `${month}/${day}`;
    } else {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      dateStr = `${month}/${day}`;
    }
    
    // 로그 메시지 생성: "앱유저명님의 날짜 기록타입이 등록되었습니다."
    const activityMessage = `${appUser.name}님의 ${dateStr} ${message}`;
    
    // 활동 로그 생성 (비동기로 처리, 실패해도 에러를 throw하지 않음)
    await activityLogsDB.addActivityLog({
      trainer_username: member.trainer,
      member_name: appUser.name,  // 앱 유저 이름으로 저장
      app_user_id: appUserId,  // app_user_id 추가
      activity_type: activityType,
      activity_message: activityMessage,
      related_record_id: recordId,
      record_date: recordDate
    });
  } catch (error) {
    // 로그 생성 실패해도 주요 기능에는 영향 없도록 에러만 기록
    console.error('[Activity Log] 활동 로그 생성 실패:', error);
  }
}

// 회원 활동 로그 생성 유틸리티 함수 (트레이너 정보 자동 확인 버전)
async function createActivityLogForMemberAuto(appUserId, activityType, message, recordId, recordDate) {
  try {
    // app_user_id로 회원 정보 조회
    const appUser = await appUsersDB.getAppUserById(appUserId);
    if (!appUser || !appUser.member_name) {
      return;
    }
    
    // 회원 정보로 트레이너 확인
    const member = await membersDB.getMemberByName(appUser.member_name);
    if (!member || !member.trainer) {
      return;
    }
    
    // 트레이너의 app_user 정보 조회하여 이름 확인
    let trainerName = member.trainer;
    try {
      const trainerAppUsers = await appUsersDB.getAppUsers({ username: member.trainer });
      const trainerAppUser = Array.isArray(trainerAppUsers) ? trainerAppUsers[0] : trainerAppUsers;
      if (trainerAppUser && trainerAppUser.name) {
        trainerName = trainerAppUser.name;
      }
    } catch (e) {
      // 트레이너 app_user 조회 실패해도 username 사용
    }
    
    // 트레이너 정보로 회원 로그 생성
    await createActivityLogForMember(appUserId, activityType, message, recordId, recordDate, member.trainer, trainerName);
  } catch (error) {
    console.error('[Activity Log] 회원 활동 로그 자동 생성 실패:', error);
  }
}

// 회원 활동 로그 생성 유틸리티 함수
async function createActivityLogForMember(appUserId, activityType, message, recordId, recordDate, trainerUsername, trainerName) {
  try {
    // app_user_id로 회원 정보 조회
    const appUser = await appUsersDB.getAppUserById(appUserId);
    
    if (!appUser) {
      // 앱 유저가 없으면 로그 생성 안함
      return;
    }
    
    // 트레이너 이름이 없으면 조회
    let finalTrainerName = trainerName;
    if (!finalTrainerName) {
      const trainerAppUser = await appUsersDB.getAppUserByUsername(trainerUsername);
      finalTrainerName = trainerAppUser ? trainerAppUser.name : trainerUsername;
    }
    
    // 날짜 포맷팅 (월/일 형식) - 실제 기록 날짜 사용, 없으면 오늘 날짜
    let dateStr = '';
    if (recordDate) {
      // 문자열 날짜(YYYY-MM-DD)를 로컬 타임존 기준으로 파싱
      let date;
      if (typeof recordDate === 'string' && recordDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // YYYY-MM-DD 형식인 경우 로컬 타임존 기준으로 파싱
        const [year, month, day] = recordDate.split('-').map(Number);
        date = new Date(year, month - 1, day);
      } else {
        date = new Date(recordDate);
      }
      const month = date.getMonth() + 1;
      const day = date.getDate();
      dateStr = `${month}/${day}`;
    } else {
      const today = new Date();
      const month = today.getMonth() + 1;
      const day = today.getDate();
      dateStr = `${month}/${day}`;
    }
    
    // 로그 메시지 생성: "{트레이너명} 트레이너가 {월}/{일} {메시지}"
    const activityMessage = `${finalTrainerName} 트레이너가 ${dateStr} ${message}`;
    
    // 활동 로그 생성 (비동기로 처리, 실패해도 에러를 throw하지 않음)
    await memberActivityLogsDB.addActivityLog({
      app_user_id: appUserId,
      trainer_username: trainerUsername,
      trainer_name: finalTrainerName,
      activity_type: activityType,
      activity_message: activityMessage,
      related_record_id: recordId,
      record_date: recordDate
    });
  } catch (error) {
    // 로그 생성 실패해도 주요 기능에는 영향 없도록 에러만 기록
    console.error('[Activity Log] 회원 활동 로그 생성 실패:', error);
  }
}

// 앱 유저 활동 이벤트 기록
async function logAppUserActivityEvent({ eventType, actorAppUserId, subjectAppUserId = null, source = null, meta = null }) {
  try {
    if (!actorAppUserId || !eventType) return;
    
    const actor = await appUsersDB.getAppUserById(actorAppUserId);
    if (!actor) return;
    
    const actorRole = actor.is_trainer ? 'trainer' : 'member';
    let finalSource = source;
    if (!finalSource) {
      if (subjectAppUserId && actorAppUserId !== subjectAppUserId) {
        finalSource = actorRole === 'trainer' ? 'trainer_proxy' : 'proxy';
      } else {
        finalSource = 'self';
      }
    }
    
    await appUserActivityEventsDB.addActivityEvent({
      actor_app_user_id: actorAppUserId,
      subject_app_user_id: subjectAppUserId,
      actor_role: actorRole,
      event_type: eventType,
      source: finalSource,
      meta
    });
  } catch (error) {
    console.error('[Activity Event] 이벤트 기록 실패:', error);
  }
}

function normalizeDateString(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.split('T')[0];
  }
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value).split('T')[0];
}

// 트레이너별 시간대별 센터 매핑 함수
async function getCenterByTrainerAndTime(trainer, time, memberCenter) {
  try {
    // 센터 목록 조회 (순서대로 1,2,3 호점)
    let centers = [];
    if (fs.existsSync(CENTERS_PATH)) {
      const raw = fs.readFileSync(CENTERS_PATH, 'utf-8');
      if (raw) centers = JSON.parse(raw);
    }
    
    // 트레이너 이름을 username으로 매핑
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    
    const trainerAccount = accounts.find(acc => acc.username === trainer || acc.name === trainer);
    if (!trainerAccount) {
      return memberCenter || '미지정';
    }
    
    const trainerName = trainerAccount.name;
    const timeHour = parseInt(time.split(':')[0]);
    
    // 센터 인덱스 매핑 (0-based)
    const centerIndex1 = centers.length > 0 ? centers[0].name : null; // 1호점
    const centerIndex2 = centers.length > 1 ? centers[1].name : null; // 2호점
    const centerIndex3 = centers.length > 2 ? centers[2].name : null; // 3호점
    
    // 트레이너별 시간대별 센터 매핑
    if (trainerName === '김성현') {
      // 기본은 회원 DB, 15시 이후(15시 포함) 세션은 3호점
      if (timeHour >= 15) {
        return centerIndex3 || memberCenter || '미지정';
      }
      return memberCenter || '미지정';
    } else if (trainerName === '천성식') {
      // 기본은 회원 DB, 17시 전(17시 포함 안함) 세션은 3호점
      if (timeHour < 17) {
        return centerIndex3 || memberCenter || '미지정';
      }
      return memberCenter || '미지정';
    } else if (trainerName === '윤승환') {
      // 기본은 회원 DB, 17시 이후(17시 포함) 세션은 1호점
      if (timeHour >= 17) {
        return centerIndex1 || memberCenter || '미지정';
      }
      return memberCenter || '미지정';
    } else if (trainerName === '이주영') {
      // 기본은 회원 DB, 15시 이후(15시 포함) 세션은 2호점
      if (timeHour >= 15) {
        return centerIndex2 || memberCenter || '미지정';
      }
      return memberCenter || '미지정';
    }
    
    // 매핑되지 않은 트레이너는 회원 DB의 center 사용
    return memberCenter || '미지정';
  } catch (error) {
    console.error('[API] 센터 매핑 오류:', error);
    return memberCenter || '미지정';
  }
}

// 세션에서 trial 생성/업데이트 동기화
async function syncTrialWithSession(session, action = 'create') {
  try {
    if (!isTrialSession(session.member)) {
      return; // 무기명/체험이 아니면 처리하지 않음
    }

    // 회원 정보에서 center 조회
    const member = await membersDB.getMemberByName(session.member);
    const memberCenter = member ? member.center : null;
    
    // 트레이너별 시간대별 센터 매핑
    const center = await getCenterByTrainerAndTime(session.trainer, session.time, memberCenter);

    if (action === 'create') {
      // trial 생성
      const trial = {
        session_id: session.id,
        center: center,
        date: session.date,
        time: session.time,
        trainer: session.trainer,
        member_name: session.member
      };
      await trialsDB.addTrial(trial);
    } else if (action === 'update') {
      // trial 업데이트
      const existingTrial = await trialsDB.getTrialBySessionId(session.id);
      if (existingTrial) {
        const updates = {
          date: session.date,
          time: session.time,
          center: center,
          member_name: session.member
        };
        await trialsDB.updateTrialBySessionId(session.id, updates);
      } else {
        // trial이 없으면 생성 (수정 전에는 일반 세션이었을 수 있음)
        const trial = {
          session_id: session.id,
          center: center,
          date: session.date,
          time: session.time,
          trainer: session.trainer,
          member_name: session.member
        };
        await trialsDB.addTrial(trial);
      }
    } else if (action === 'delete') {
      // trial 삭제
      await trialsDB.deleteTrialBySessionId(session.id);
    }
  } catch (error) {
    // trial 동기화 실패해도 세션 작업은 계속 진행
    console.error('[API] Trial 동기화 오류:', error);
  }
}

// 이메일 서비스 모듈
const emailService = require('./email-service');

const app = express();
const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DATA_PATH = path.join(DATA_DIR, 'accounts.json');
const CENTERS_PATH = path.join(DATA_DIR, 'centers.json');

// 이미지 업로드 디렉토리 설정 (로컬/Render 구분)
const getUploadsDir = () => {
  // 기존 패턴: DATA_DIR 환경변수 사용 (기본값: ../data)
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
  
  // Local과 Render 모두 data 폴더 안에 uploads 생성
  return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
};

const UPLOADS_DIR = getUploadsDir();
const DIET_IMAGES_DIR = path.join(UPLOADS_DIR, 'diet-images');
const CONSULTATION_VIDEOS_DIR = path.join(UPLOADS_DIR, 'consultation-videos');
const CONSULTATION_IMAGES_DIR = path.join(UPLOADS_DIR, 'consultation-images');
const TRAINER_PROFILES_DIR = path.join(UPLOADS_DIR, 'trainer-profiles');

// 디렉토리 자동 생성
const ensureDirectories = () => {
  try {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      console.log(`[Diet Records] 업로드 디렉토리 생성: ${UPLOADS_DIR}`);
    }
    if (!fs.existsSync(DIET_IMAGES_DIR)) {
      fs.mkdirSync(DIET_IMAGES_DIR, { recursive: true });
      console.log(`[Diet Records] 식단 이미지 디렉토리 생성: ${DIET_IMAGES_DIR}`);
    }
    if (!fs.existsSync(CONSULTATION_VIDEOS_DIR)) {
      fs.mkdirSync(CONSULTATION_VIDEOS_DIR, { recursive: true });
      console.log(`[Consultation] 상담기록 동영상 디렉토리 생성: ${CONSULTATION_VIDEOS_DIR}`);
    }
    if (!fs.existsSync(CONSULTATION_IMAGES_DIR)) {
      fs.mkdirSync(CONSULTATION_IMAGES_DIR, { recursive: true });
      console.log(`[Consultation] 상담기록 사진 디렉토리 생성: ${CONSULTATION_IMAGES_DIR}`);
    }
    if (!fs.existsSync(TRAINER_PROFILES_DIR)) {
      fs.mkdirSync(TRAINER_PROFILES_DIR, { recursive: true });
      console.log(`[Trainer Profiles] 프로필 사진 디렉토리 생성: ${TRAINER_PROFILES_DIR}`);
    }
    if (!fs.existsSync(ELMO_IMAGES_DIR)) {
      fs.mkdirSync(ELMO_IMAGES_DIR, { recursive: true });
      console.log(`[Elmo Calendar] 이미지 디렉토리 생성: ${ELMO_IMAGES_DIR}`);
    }
  } catch (error) {
    console.error(`[Diet Records] 디렉토리 생성 오류: ${error.message}`);
    throw error;
  }
};

// 서버 시작 시 디렉토리 생성
ensureDirectories();


// 데이터 파일 자동 생성 기능 수정: 디렉토리가 없으면 에러만 출력
const DATA_FILES = [
  { path: DATA_PATH, name: 'accounts.json' },
  { path: CENTERS_PATH, name: 'centers.json' }
];
if (!fs.existsSync(DATA_DIR)) {
  console.error(`[GoodLift] 데이터 디렉토리가 존재하지 않습니다: ${DATA_DIR}`);
} else {
  DATA_FILES.forEach(f => {
    if (!fs.existsSync(f.path)) {
      fs.writeFileSync(f.path, '[]');
      console.log(`[GoodLift] 데이터 파일 생성: ${f.path}`);
    }
  });
}



// 마이그레이션 추적 시스템 초기화 (가장 먼저 실행)
(async () => {
  await initializeMigrationSystem();
  console.log('[System] 마이그레이션 추적 시스템 초기화 완료');
  
  // 성능 최적화 인덱스 마이그레이션 (한 번만 실행됨)
  await runMigration(
    'create_performance_indexes_2026_01_31_v2',
    '성능 최적화를 위한 데이터베이스 인덱스 생성 (수정본)',
    createPerformanceIndexes
  );
})();

// PostgreSQL 데이터베이스 초기화
sessionsDB.initializeDatabase();
membersDB.initializeDatabase();

// Trial 마이그레이션 자동 실행 (서버 시작 시 한 번만)
async function runTrialMigration() {
  const MIGRATION_FLAG_FILE = path.join(DATA_DIR, '.trial-migration-done');
  
  // 마이그레이션이 이미 완료되었는지 확인
  if (fs.existsSync(MIGRATION_FLAG_FILE)) {
    console.log('[Migration] Trial 마이그레이션이 이미 완료되었습니다. 건너뜀.');
    return;
  }
  
  try {
    console.log('[Migration] Trial 마이그레이션 자동 실행 시작');
    
    // 모든 세션 조회
    const allSessions = await sessionsDB.getSessions({});
    
    // 무기명/체험 세션 필터링
    const trialSessions = allSessions.filter(session => 
      isTrialSession(session.member)
    );
    
    console.log(`[Migration] 무기명/체험 세션 ${trialSessions.length}개 발견`);
    
    // 트레이너 정보 및 센터 정보 조회
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    
    // 회원 정보 조회
    const members = await membersDB.getMembers();
    const memberCenterMap = {};
    members.forEach(member => {
      memberCenterMap[member.name] = member.center;
    });
    
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    // 각 세션을 trial DB에 생성
    for (const session of trialSessions) {
      try {
        // 이미 trial이 존재하는지 확인 (session_id로)
        const existingTrial = await trialsDB.getTrialBySessionId(session.id);
        if (existingTrial) {
          skippedCount++;
          continue;
        }
        
        // 회원 정보에서 center 조회
        const member = await membersDB.getMemberByName(session.member);
        const memberCenter = member ? member.center : null;
        
        // 트레이너별 시간대별 센터 매핑
        const center = await getCenterByTrainerAndTime(session.trainer, session.time, memberCenter);
        
        // trial 생성
        const trial = {
          session_id: session.id,
          center: center,
          date: session.date,
          time: session.time,
          trainer: session.trainer,
          member_name: session.member
        };
        
        await trialsDB.addTrial(trial);
        createdCount++;
      } catch (error) {
        console.error(`[Migration] 세션 ${session.id} 마이그레이션 오류:`, error);
        errorCount++;
      }
    }
    
    console.log(`[Migration] Trial 마이그레이션 완료: 생성 ${createdCount}개, 건너뜀 ${skippedCount}개, 오류 ${errorCount}개`);
    
    // 마이그레이션 완료 플래그 파일 생성
    fs.writeFileSync(MIGRATION_FLAG_FILE, JSON.stringify({
      completedAt: new Date().toISOString(),
      total: trialSessions.length,
      created: createdCount,
      skipped: skippedCount,
      errors: errorCount
    }, null, 2));
    console.log('[Migration] 마이그레이션 완료 플래그 파일 생성됨');
  } catch (error) {
    console.error('[Migration] Trial 마이그레이션 오류:', error);
    // 마이그레이션 실패 시에도 플래그 파일을 생성하지 않음 (재시도 가능)
  }
}

// 서버 시작 시 마이그레이션 실행 (마이그레이션 완료 - 주석 처리)
// runTrialMigration();
monthlyStatsDB.initializeDatabase();
registrationLogsDB.initializeDatabase();
expensesDB.initializeDatabase();
trialsDB.initializeDatabase();
renewalsDB.initializeDatabase();
parsedMemberSnapshotsDB.initializeDatabase();
parsedSalesSnapshotsDB.initializeDatabase();
salesDB.initializeDatabase();
metricsDB.initializeDatabase();
marketingDB.initializeDatabase();
ledgerDB.initializeDatabase();
trainerLedgerDB.initializeDatabase();
trainerRevenueDB.initializeDatabase();
// app_users 테이블 초기화 후 트레이너 동기화 실행
(async () => {
    await appUsersDB.initializeDatabase();
    await syncTrainersToAppUsers();
    await appUserActivityEventsDB.initializeDatabase();
})();
workoutTypesDB.initializeDatabase(); // workout_types 테이블을 먼저 생성해야 함
workoutRecordsDB.initializeDatabase(); // workout_records는 workout_types를 참조하므로 나중에 생성
favoriteWorkoutsDB.initializeDatabase(); // app_user_favorite_workouts는 app_users와 workout_types를 참조하므로 마지막에 생성
dietRecordsDB.initializeDatabase(); // 식단기록 테이블 초기화
achievementsDB.initializeDatabase(); // 업적 집계 테이블 초기화/백필
userSettingsDB.initializeDatabase(); // app_user_settings는 app_users를 참조하므로 나중에 생성
activityLogsDB.initializeDatabase(); // 트레이너 활동 로그 테이블 초기화
memberActivityLogsDB.initializeDatabase(); // 회원 활동 로그 테이블 초기화
workoutCommentsDB.initializeDatabase(); // 운동 코멘트 테이블 초기화
dietDailyCommentsDB.initializeDatabase(); // 식단 하루 코멘트 테이블 초기화
consultationRecordsDB.initializeDatabase(); // 상담기록 테이블 초기화
consultationSharesDB.initializeDatabase(); // 상담기록 공유 토큰 테이블 초기화
elmoUsersDB.initializeDatabase(); // Elmo 사용자 테이블 초기화
elmoCalendarRecordsDB.initializeDatabase(); // Elmo 캘린더 기록 테이블 초기화

// 트레이너를 app_users 테이블에 자동 등록
async function syncTrainersToAppUsers() {
    try {
        // 마이그레이션이 완료될 때까지 대기 (trainer 컬럼 존재 확인)
        let retryCount = 0;
        const maxRetries = 10;
        let trainerColumnExists = false;
        
        while (!trainerColumnExists && retryCount < maxRetries) {
            try {
                // trainer 컬럼 존재 여부 확인
                const checkColumnQuery = `
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'trainer'
                `;
                const result = await appUsersDB.pool.query(checkColumnQuery);
                trainerColumnExists = result.rows.length > 0;
                
                if (!trainerColumnExists) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
                    }
                }
            } catch (error) {
                // 테이블이 아직 생성되지 않았을 수 있음
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 대기
                }
            }
        }
        
        if (!trainerColumnExists) {
            console.log('[GoodLift] trainer 컬럼 마이그레이션 대기 시간 초과. 트레이너 동기화를 건너뜁니다.');
            return;
        }
        
        if (!fs.existsSync(DATA_PATH)) {
            console.log('[GoodLift] accounts.json 파일이 없어 트레이너 동기화를 건너뜁니다.');
            return;
        }
        
        const accounts = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
        const trainers = accounts.filter(acc => acc.role === 'trainer');
        
        if (trainers.length === 0) {
            console.log('[GoodLift] 등록된 트레이너가 없습니다.');
            return;
        }
        
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        
        let syncedCount = 0;
        let skippedCount = 0;
        
        for (const trainer of trainers) {
            try {
                // 이미 존재하는지 확인
                const existingUser = await appUsersDB.getAppUserByUsername(trainer.username);
                
                if (existingUser) {
                    // 이미 존재하면 스킵
                    skippedCount++;
                    continue;
                }
                
                // 비밀번호 해싱 (accounts.json의 비밀번호 사용)
                const password_hash = await bcrypt.hash(trainer.password || '123', saltRounds);
                
                // app_user 추가
                await appUsersDB.addAppUser({
                    username: trainer.username,
                    password_hash: password_hash,
                    name: trainer.name,
                    phone: '', // 전화번호는 빈 문자열로 설정 (나중에 수정 가능)
                    member_name: null,
                    is_active: true
                });
                
                syncedCount++;
                console.log(`[GoodLift] 트레이너 "${trainer.name}" (${trainer.username})가 app_users에 등록되었습니다.`);
            } catch (error) {
                console.error(`[GoodLift] 트레이너 "${trainer.name}" (${trainer.username}) 등록 오류:`, error.message);
            }
        }
        
        console.log(`[GoodLift] 트레이너 동기화 완료: ${syncedCount}명 등록, ${skippedCount}명 스킵`);
    } catch (error) {
        console.error('[GoodLift] 트레이너 동기화 오류:', error);
    }
}

// 서버 시작 시 트레이너 동기화 실행 (위의 async IIFE에서 실행됨)

// 트레이너 VIP 기능 필드 마이그레이션
function migrateTrainerVipField() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            return;
        }

        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (!raw) {
            return;
        }

        let accounts = JSON.parse(raw);
        let hasChanges = false;

        accounts.forEach(account => {
            if (account.role === 'trainer' && account.vip_member === undefined) {
                account.vip_member = false; // 기본값: VIP 기능 사용 안함
                hasChanges = true;
            }
        });

        if (hasChanges) {
            fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        }
    } catch (error) {
        console.error('[Migration] 트레이너 VIP 기능 필드 마이그레이션 오류:', error);
    }
}

// 트레이너 30분 세션 기능 필드 마이그레이션
function migrateTrainer30minSessionField() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            return;
        }

        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (!raw) {
            return;
        }

        let accounts = JSON.parse(raw);
        let hasChanges = false;

        accounts.forEach(account => {
            if (account.role === 'trainer' && account['30min_session'] === undefined) {
                account['30min_session'] = 'off'; // 기본값: 30분 세션 기능 사용 안함
                hasChanges = true;
            }
        });

        if (hasChanges) {
            fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        }
    } catch (error) {
        console.error('[Migration] 트레이너 30분 세션 기능 필드 마이그레이션 오류:', error);
    }
}

// 트레이너 기본 뷰 모드 필드 마이그레이션
function migrateTrainerDefaultViewMode() {
    try {
        if (!fs.existsSync(DATA_PATH)) {
            return;
        }

        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (!raw) {
            return;
        }

        let accounts = JSON.parse(raw);
        let hasChanges = false;

        accounts.forEach(account => {
            if (account.role === 'trainer' && account.default_view_mode === undefined) {
                account.default_view_mode = 'week'; // 기본값: 주간보기
                hasChanges = true;
            }
            if (account.role === 'trainer' && account.probation === undefined) {
                account.probation = 'off'; // 기본값: 수습 아님
                hasChanges = true;
            }
            if (account.role === 'trainer' && account.ledger === undefined) {
                account.ledger = 'off'; // 기본값: 장부 기능 사용 안함
                hasChanges = true;
            }
        });

        if (hasChanges) {
            fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        }
    } catch (error) {
        console.error('[Migration] 트레이너 기본 뷰 모드 필드 마이그레이션 오류:', error);
    }
}

// migrateTrainerVipField();
// migrateTrainer30minSessionField();
// migrateTrainerDefaultViewMode();

// 식단 이미지 저장 함수
const saveDietImage = async (dietRecordId, imageBuffer, mealDate) => {
  try {
    // 날짜별 디렉토리 구조: 2025/01/{diet_record_id}/
    const date = new Date(mealDate);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const recordDir = path.join(DIET_IMAGES_DIR, String(year), month, dietRecordId);
    
    // 디렉토리 생성 (recursive: true로 하위 디렉토리까지 자동 생성)
    if (!fs.existsSync(recordDir)) {
      fs.mkdirSync(recordDir, { recursive: true });
    }
    
    // 원본과 썸네일을 병렬로 처리하여 성능 개선
    const originalPath = path.join(recordDir, 'original.jpg');
    const thumbnailPath = path.join(recordDir, 'thumbnail_300x300.jpg');
    
    // 두 작업을 병렬로 실행
    await Promise.all([
      // 원본 저장 (최대 800x800, JPEG 품질 65%로 최적화)
      // rotate()는 EXIF orientation 정보를 자동으로 적용하여 이미지를 올바른 방향으로 회전시킵니다
      sharp(imageBuffer)
        .rotate() // EXIF orientation 자동 적용
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ 
          quality: 65, // 70% → 65%로 조정하여 파일 크기 감소
          progressive: true // Progressive JPEG 사용 (더 나은 압축)
        })
        .toFile(originalPath),
      
      // 썸네일 저장 (300x300, JPEG 품질 60%로 최적화)
      sharp(imageBuffer)
        .rotate() // EXIF orientation 자동 적용
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ 
          quality: 60, // 65% → 60%로 조정하여 파일 크기 감소
          progressive: true // Progressive JPEG 사용 (더 나은 압축)
        })
        .toFile(thumbnailPath)
    ]);
    
    // 상대 경로 반환 (DB 저장용)
    // Local: /uploads/diet-images/2025/01/{uuid}/original.jpg
    // Render: /uploads/diet-images/2025/01/{uuid}/original.jpg (동일)
    const relativeDir = path.join('uploads', 'diet-images', String(year), month, dietRecordId);
    return {
      image_url: path.join(relativeDir, 'original.jpg').replace(/\\/g, '/'),
      image_thumbnail_url: path.join(relativeDir, 'thumbnail_300x300.jpg').replace(/\\/g, '/')
    };
  } catch (error) {
    console.error('[Diet Records] 이미지 저장 오류:', error);
    throw error;
  }
};


// 파일 업로드 설정
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
            file.mimetype === 'application/vnd.ms-excel' ||
            file.originalname.endsWith('.xlsx') ||
            file.originalname.endsWith('.xls')) {
            cb(null, true);
        } else {
            cb(new Error('엑셀 파일만 업로드 가능합니다.'), false);
        }
    }
});

// 식단 이미지 업로드 설정
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB 제한
    },
    fileFilter: (req, file, cb) => {
        // 이미지 파일만 허용
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다.'), false);
        }
    }
});

// 동영상 업로드 설정
const videoUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.CONSULTATION_VIDEO_MAX_SIZE || '104857600', 10) // 기본 100MB
    },
    fileFilter: (req, file, cb) => {
        // 동영상 파일만 허용
        const allowedMimes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
        if (allowedMimes.includes(file.mimetype) || 
            file.originalname.match(/\.(mp4|mov|avi|webm)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('동영상 파일만 업로드 가능합니다. (mp4, mov, avi, webm)'), false);
        }
    }
});

// 상담기록 사진 업로드 설정
const consultationImageUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.CONSULTATION_IMAGE_MAX_SIZE || '10485760', 10) // 기본 10MB
    },
    fileFilter: (req, file, cb) => {
        // 이미지 파일만 허용
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype) || 
            file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('이미지 파일만 업로드 가능합니다. (jpg, jpeg, png, gif, webp)'), false);
        }
    }
});

// 트레이너 프로필 사진 업로드 설정
const trainerProfileUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const uuid = require('crypto').randomUUID();
            const dir = path.join(TRAINER_PROFILES_DIR, String(year), month, uuid);
            fs.mkdirSync(dir, { recursive: true });
            // req에 저장 경로 정보 저장 (나중에 상대 경로 생성용)
            req.trainerProfileDir = { year, month, uuid };
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            if (!allowedExts.includes(ext)) {
                return cb(new Error('지원하지 않는 이미지 형식입니다.'));
            }
            cb(null, `profile${ext}`);
        }
    }),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedExts.includes(ext) || allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('지원하지 않는 이미지 형식입니다.'));
        }
    }
});

app.use(cors());
app.use(express.json());

// API 요청 로깅 미들웨어 (디버깅용)

// 권한 체크 헬퍼 함수 (SU 역할 추가)
function isAdminOrSu(userAccount) {
    return userAccount && (userAccount.role === 'admin' || userAccount.role === 'su');
}

// manifest.json을 올바른 Content-Type으로 제공
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, '../public/manifest.json'));
});

// 공개 상담기록 조회 페이지 라우트 (정적 파일 서빙 전에 추가)
app.get('/consultation/view/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/consultation-view.html'));
});

// ========== Elmo 서비스 (완전 분리) ==========
// Elmo 정적 파일 서빙 (경로 우선순위: /elmo가 먼저 매칭)
// Elmo 정적 파일 서빙 (HTML은 캐시 방지)
app.use('/elmo', (req, res, next) => {
    if (req.path === '/' || req.path === '/index.html') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
}, express.static(path.join(__dirname, '../public-elmo'), {
    index: 'index.html',
    fallthrough: false // /elmo 경로는 여기서만 처리
}));

// Elmo 전용 PWA manifest
app.get('/elmo/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, '../public-elmo/manifest.json'));
});

// Elmo 전용 Service Worker
app.get('/elmo/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(__dirname, '../public-elmo/sw.js'));
});

// Elmo API 라우터 연결
app.use('/api/elmo', elmoApiRouter);

// ========== 기존 서비스 (변경 없음) ==========
app.use(express.static(path.join(__dirname, '../public')));

// uploads 폴더를 정적 파일로 서빙 (이미지 및 동영상 접근)
app.use('/uploads', express.static(UPLOADS_DIR, {
    setHeaders: (res, filePath) => {
        // 동영상 파일의 경우 적절한 MIME type 설정
        if (filePath.match(/\.(mp4|mov|avi|webm)$/i)) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.mp4': 'video/mp4',
                '.mov': 'video/quicktime',
                '.avi': 'video/x-msvideo',
                '.webm': 'video/webm'
            };
            if (mimeTypes[ext]) {
                res.setHeader('Content-Type', mimeTypes[ext]);
            }
        }
    }
}));

// 아이디 중복 체크 API
app.get('/api/check-username', async (req, res) => {
    const { username } = req.query;
    
    if (!username || !username.trim()) {
        return res.status(400).json({ available: false, message: '아이디를 입력해주세요.' });
    }
    
    const trimmedUsername = username.trim();
    
    try {
        // 1. 운영자 계정 확인 (accounts.json)
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        if (accounts.find(acc => acc.username === trimmedUsername)) {
            return res.json({ available: false, message: '이미 사용 중인 아이디입니다.' });
        }
        
        // 2. 앱 유저 계정 확인 (app_users 테이블)
        try {
            const existingAppUser = await appUsersDB.getAppUserByUsername(trimmedUsername);
            if (existingAppUser) {
                return res.json({ available: false, message: '이미 사용 중인 아이디입니다.' });
            }
        } catch (dbError) {
            console.error('[API] 앱 유저 조회 오류:', dbError);
            // 데이터베이스 오류가 발생해도 운영자 계정은 확인했으므로 계속 진행
            // 단, 사용 가능 여부를 확실히 알 수 없으므로 오류 반환
            return res.status(500).json({ available: false, message: '아이디 확인 중 오류가 발생했습니다.' });
        }
        
        // 사용 가능한 아이디
        res.json({ available: true, message: '사용 가능한 아이디입니다.' });
    } catch (error) {
        console.error('[API] 아이디 중복 체크 오류:', error);
        console.error('[API] 오류 상세:', error.message, error.stack);
        res.status(500).json({ available: false, message: '아이디 확인 중 오류가 발생했습니다.' });
    }
});

// 회원가입 API (앱 유저 전용)
app.post('/api/signup', async (req, res) => {
    const { username, password, name, phone } = req.body;
    
    // 필수 항목 검증
    if (!username || !password || !name || !phone) {
        return res.status(400).json({ message: '모든 필수 항목을 입력해주세요.' });
    }
    
    // 아이디 중복 체크 (운영자 계정과 앱 유저 계정 모두 확인)
    // 1. 운영자 계정 확인
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    if (accounts.find(acc => acc.username === username)) {
        return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
    }

    // 2. 앱 유저 계정 확인
    try {
        const existingAppUser = await appUsersDB.getAppUserByUsername(username);
        if (existingAppUser) {
            return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
        }
        
        // 비밀번호 해싱 (bcrypt)
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        // 앱 유저 추가
        const newAppUser = {
            username: username.trim(),
            password_hash: password_hash,
            name: name.trim(),
            phone: phone.trim(),
            is_active: true
        };
        
        await appUsersDB.addAppUser(newAppUser);
        
    res.json({ message: '회원가입이 완료되었습니다.' });
    } catch (error) {
        console.error('[API] 앱 유저 회원가입 오류:', error);
        if (error.message && error.message.includes('UNIQUE')) {
            return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
        }
        res.status(500).json({ message: '회원가입 처리 중 오류가 발생했습니다.' });
    }
});

// 로그인 API
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요.' });
    }
    
    // 1단계: 운영자 계정 확인 (accounts.json)
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    const operator = accounts.find(acc => acc.username === username && acc.password === password);
    
    if (operator) {
        // 운영자 로그인 성공
        const response = {
            message: '로그인 성공!',
            userType: 'operator',
            role: operator.role,
            name: operator.name
        };
        if (operator.role === 'center' && operator.center) {
            response.center = operator.center;
        }
        return res.json(response);
    }
    
    // 2단계: 앱 유저 계정 확인 (app_users 테이블)
    try {
        const appUser = await appUsersDB.getAppUserByUsername(username);
        
        if (!appUser) {
            return res.status(401).json({ 
                message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
            });
        }
        
        // 계정 비활성화 체크
        if (!appUser.is_active) {
            return res.status(403).json({ 
                message: '비활성화된 계정입니다.' 
            });
        }
        
        // 비밀번호 검증 (bcrypt)
        const bcrypt = require('bcrypt');
        const isValidPassword = await bcrypt.compare(password, appUser.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ 
                message: '아이디 또는 비밀번호가 올바르지 않습니다.' 
            });
        }
        
        // 마지막 로그인 시각 업데이트
        await appUsersDB.updateLastLogin(username);
        await logAppUserActivityEvent({
            eventType: 'login',
            actorAppUserId: appUser.id,
            subjectAppUserId: appUser.id,
            source: 'self'
        });
        
        // 트레이너 여부 확인 (accounts.json에서 확인)
        let isTrainer = false;
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) {
                const accounts = JSON.parse(raw);
                const account = accounts.find(acc => acc.username === appUser.username && acc.role === 'trainer');
                isTrainer = !!account;
            }
        }
        
        // DB에 is_trainer 필드 업데이트 (accounts.json과 동기화)
        if (appUser.is_trainer !== isTrainer) {
            await appUsersDB.updateAppUser(appUser.id, { is_trainer: isTrainer });
            appUser.is_trainer = isTrainer;
        }
        
        // 앱 유저 로그인 성공
        res.json({
            message: '로그인 성공!',
            userType: 'app_user',
            id: appUser.id,
            username: appUser.username,
            name: appUser.name,
            phone: appUser.phone,
            member_name: appUser.member_name,
            isTrainer: appUser.is_trainer || isTrainer
        });
    } catch (error) {
        console.error('[API] 앱 유저 로그인 오류:', error);
        res.status(500).json({ message: '로그인 처리 중 오류가 발생했습니다.' });
    }
});

// ========== 앱 유저 관리 API ==========

// 앱 유저 목록 조회
app.get('/api/app-users', async (req, res) => {
    try {
        const filters = {};
        if (req.query.member_name) filters.member_name = req.query.member_name;
        if (req.query.trainer) filters.trainer = req.query.trainer;
        if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === 'true';
        if (req.query.username) filters.username = req.query.username;
        
        const appUsers = await appUsersDB.getAppUsers(filters);
        
        // 특정 username으로 조회하는 경우 트레이너 필터링 제외 (트레이너의 app_user 조회 허용)
        if (req.query.username) {
            res.json(appUsers);
            return;
        }
        
        // accounts.json에서 트레이너 username 목록 가져오기
        const trainerUsernames = new Set();
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) {
                const accounts = JSON.parse(raw);
                accounts.forEach(account => {
                    if (account.role === 'trainer' && account.username) {
                        trainerUsernames.add(account.username);
                    }
                });
            }
        }
        
        // 트레이너 제외 (트레이너 username에 해당하는 app_user 제외)
        // 단, 특정 username으로 조회하는 경우는 위에서 이미 반환됨
        const filteredAppUsers = appUsers.filter(appUser => {
            return !trainerUsernames.has(appUser.username);
        });
        
        res.json(filteredAppUsers);
    } catch (error) {
        console.error('[API] 앱 유저 목록 조회 오류:', error);
        res.status(500).json({ message: '앱 유저 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 트레이너별 연결된 회원 목록 조회 (최적화된 API)
app.get('/api/trainer-members', async (req, res) => {
    try {
        const { trainer_username } = req.query;
        
        if (!trainer_username) {
            return res.status(400).json({ message: '트레이너 username이 필요합니다.' });
        }
        
        const members = await appUsersDB.getTrainerMembers(trainer_username);
        res.json(members);
    } catch (error) {
        console.error('[API] 트레이너 회원 목록 조회 오류:', error);
        res.status(500).json({ message: '트레이너 회원 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 앱 유저 메달 현황 조회 (트레이너용)
app.get('/api/app-users/medal-status', async (req, res) => {
    try {
        const { app_user_ids, start_date, end_date } = req.query;
        if (!app_user_ids) {
            return res.status(400).json({ message: '앱 유저 ID 목록이 필요합니다.' });
        }
        
        const appUserIds = app_user_ids
            .split(',')
            .map(id => id.trim())
            .filter(Boolean);
        
        if (appUserIds.length === 0) {
            return res.json({ results: [] });
        }
        
        const uuidRegex = /^[0-9a-fA-F-]{36}$/;
        const validAppUserIds = appUserIds.filter(id => uuidRegex.test(id));
        
        // 조회 기간 설정 (없으면 이번달)
        let startDate = start_date;
        let endDate = end_date;
        if (!startDate || !endDate) {
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            monthStart.setHours(0, 0, 0, 0);
            monthEnd.setHours(23, 59, 59, 999);
            startDate = monthStart.toISOString().split('T')[0];
            endDate = monthEnd.toISOString().split('T')[0];
        }
        
        if (validAppUserIds.length === 0) {
            return res.json({ results: [] });
        }
        const results = await achievementsDB.getMedalStatus(validAppUserIds, startDate, endDate);
        res.json({ results });
    } catch (error) {
        console.error('[API] 앱 유저 메달 현황 조회 오류:', error);
        res.status(500).json({ message: '앱 유저 메달 현황 조회 중 오류가 발생했습니다.' });
    }
});

// 앱 유저 업적 요약 조회 (회원용)
app.get('/api/app-users/:appUserId/achievement-summary', async (req, res) => {
    try {
        const { appUserId } = req.params;
        const { start_date, end_date } = req.query;
        
        if (!appUserId || !start_date || !end_date) {
            return res.status(400).json({ message: 'appUserId, start_date, end_date는 필수입니다.' });
        }
        
        const summary = await achievementsDB.getAchievementSummary(appUserId, start_date, end_date);
        res.json(summary);
    } catch (error) {
        console.error('[API] 업적 요약 조회 오류:', error);
        res.status(500).json({ message: '업적 요약 조회 중 오류가 발생했습니다.' });
    }
});

// 앱 유저 업적 요약 목록 조회 (관리자용)
app.get('/api/app-users/achievement-summaries', async (req, res) => {
    try {
        const { app_user_ids, start_date, end_date } = req.query;
        if (!app_user_ids || !start_date || !end_date) {
            return res.status(400).json({ message: 'app_user_ids, start_date, end_date는 필수입니다.' });
        }
        
        const ids = app_user_ids.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length === 0) {
            return res.json({ results: [] });
        }
        
        const results = await achievementsDB.getAchievementSummaries(ids, start_date, end_date);
        res.json({ results });
    } catch (error) {
        console.error('[API] 업적 요약 목록 조회 오류:', error);
        res.status(500).json({ message: '업적 요약 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 앱 유저 단일 조회
app.get('/api/app-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const appUser = await appUsersDB.getAppUserById(id);
        
        if (!appUser) {
            return res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
        }
        
        // isTrainer 필드 추가 (is_trainer를 isTrainer로도 반환)
        const responseData = {
            ...appUser,
            isTrainer: appUser.is_trainer === true
        };
        
        res.json(responseData);
    } catch (error) {
        console.error('[API] 앱 유저 조회 오류:', error);
        res.status(500).json({ message: '앱 유저 조회 중 오류가 발생했습니다.' });
    }
});

// 앱 유저 접속 핑 (MAU/활성 통계용)
app.post('/api/app-user/ping', async (req, res) => {
    try {
        const { app_user_id } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        await appUsersDB.updateLastSeen(app_user_id);
        await logAppUserActivityEvent({
            eventType: 'app_open',
            actorAppUserId: app_user_id,
            subjectAppUserId: app_user_id,
            source: 'self'
        });
        
        res.json({ success: true });
    } catch (error) {
        console.error('[API] 앱 유저 핑 오류:', error);
        res.status(500).json({ message: '앱 유저 핑 처리 중 오류가 발생했습니다.' });
    }
});

// 앱 유저 활동 통계 조회
app.get('/api/app-user-activity-stats', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate와 endDate가 필요합니다.' });
        }
        
        const rows = await appUserActivityEventsDB.getActivityStatsByDateRange(startDate, endDate);
        const workoutDistinctCounts = await appUserActivityEventsDB.getWorkoutDistinctDateCountsByDateRange(startDate, endDate);
        
        const findRow = (eventType, actorRole, source) => rows.find(row =>
            row.event_type === eventType &&
            row.actor_role === actorRole &&
            row.source === source
        );
        
        const memberAppOpen = findRow('app_open', 'member', 'self');
        const memberLogin = findRow('login', 'member', 'self');
        const trainerAppOpen = findRow('app_open', 'trainer', 'self');
        const trainerLogin = findRow('login', 'trainer', 'self');
        const memberWorkoutSelf = findRow('workout_create', 'member', 'self');
        const trainerWorkoutProxy = findRow('workout_create', 'trainer', 'trainer_proxy');
        const workoutDistinctFind = (actorRole, source) => workoutDistinctCounts.find(row =>
            row.actor_role === actorRole && row.source === source
        );
        const workoutSelfDistinct = workoutDistinctFind('member', 'self');
        const workoutProxyDistinct = workoutDistinctFind('trainer', 'trainer_proxy');
        const memberDietSelf = findRow('diet_create', 'member', 'self');
        const trainerDietProxy = findRow('diet_create', 'trainer', 'trainer_proxy');
        const trainerWorkoutComments = findRow('workout_comment_create', 'trainer', 'trainer_proxy');
        const memberWorkoutComments = findRow('workout_comment_create', 'member', 'self');
        const memberDietComments = findRow('diet_comment_create', 'member', 'self');
        const trainerDietComments = findRow('diet_comment_create', 'trainer', 'trainer_proxy');
        
        res.json({
            range: { startDate, endDate },
            summary: {
                members: {
                    appOpenUsers: Number(memberAppOpen?.actor_count || 0),
                    loginUsers: Number(memberLogin?.actor_count || 0),
                    workoutSelfUsers: Number(memberWorkoutSelf?.subject_count || 0),
                    workoutProxyUsers: Number(trainerWorkoutProxy?.subject_count || 0),
                    dietSelfUsers: Number(memberDietSelf?.subject_count || 0),
                    dietProxyUsers: Number(trainerDietProxy?.subject_count || 0),
                    workoutCommentUsers: Number(memberWorkoutComments?.actor_count || 0),
                    dietCommentUsers: Number(memberDietComments?.actor_count || 0)
                },
                trainers: {
                    appOpenUsers: Number(trainerAppOpen?.actor_count || 0),
                    loginUsers: Number(trainerLogin?.actor_count || 0),
                    workoutProxyActors: Number(trainerWorkoutProxy?.actor_count || 0),
                    dietProxyActors: Number(trainerDietProxy?.actor_count || 0)
                },
                counts: {
                    workoutSelf: Number(workoutSelfDistinct?.event_count || 0),
                    workoutProxy: Number(workoutProxyDistinct?.event_count || 0),
                    dietSelf: Number(memberDietSelf?.event_count || 0),
                    dietProxy: Number(trainerDietProxy?.event_count || 0),
                    workoutCommentsTrainer: Number(trainerWorkoutComments?.event_count || 0),
                    workoutCommentsMember: Number(memberWorkoutComments?.event_count || 0),
                    dietCommentsMember: Number(memberDietComments?.event_count || 0),
                    dietCommentsTrainer: Number(trainerDietComments?.event_count || 0)
                }
            },
            rows
        });
    } catch (error) {
        console.error('[API] 앱 유저 활동 통계 조회 오류:', error);
        res.status(500).json({ message: '앱 유저 활동 통계를 불러오지 못했습니다.' });
    }
});

// 앱 유저 활동 이벤트 상세 조회
app.get('/api/app-user-activity-events', async (req, res) => {
    try {
        const { startDate, endDate, eventType, actorRole, source, limit, offset } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate와 endDate가 필요합니다.' });
        }
        
        const events = await appUserActivityEventsDB.getActivityEventsByDateRange(startDate, endDate, {
            eventType,
            actorRole,
            source,
            limit: limit ? parseInt(limit, 10) : 200,
            offset: offset ? parseInt(offset, 10) : 0
        });
        
        res.json({ events });
    } catch (error) {
        console.error('[API] 앱 유저 활동 이벤트 조회 오류:', error);
        res.status(500).json({ message: '앱 유저 활동 이벤트를 불러오지 못했습니다.' });
    }
});

// 앱 유저 추가 (관리자용)
app.post('/api/app-users', async (req, res) => {
    try {
        const { username, password, name, phone, member_name, is_active } = req.body;
        
        if (!username || !password || !name || !phone) {
            return res.status(400).json({ message: '아이디, 비밀번호, 이름, 전화번호는 필수입니다.' });
        }
        
        // 아이디 중복 체크
        const existingAppUser = await appUsersDB.getAppUserByUsername(username);
        if (existingAppUser) {
            return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
        }
        
        // 비밀번호 해싱
        const bcrypt = require('bcrypt');
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);
        
        const newAppUser = await appUsersDB.addAppUser({
            username: username.trim(),
            password_hash: password_hash,
            name: name.trim(),
            phone: phone.trim(),
            member_name: member_name || null,
            is_active: is_active !== undefined ? is_active : true
        });
        
        res.status(201).json(newAppUser);
    } catch (error) {
        console.error('[API] 앱 유저 추가 오류:', error);
        if (error.code === '23505') { // UNIQUE constraint violation
            res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
        } else {
            res.status(500).json({ message: '앱 유저 추가 중 오류가 발생했습니다.' });
        }
    }
});

// 앱 유저 수정
app.patch('/api/app-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, member_name, trainer, is_active, password, currentPassword } = req.body;
        
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (phone !== undefined) updates.phone = phone.trim();
        if (member_name !== undefined) updates.member_name = member_name || null;
        if (trainer !== undefined) updates.trainer = trainer || null;
        if (is_active !== undefined) updates.is_active = is_active;
        
        // 비밀번호 변경
        if (password) {
            const bcrypt = require('bcrypt');
            
            // 기존 비밀번호가 제공된 경우 검증
            if (currentPassword) {
                const appUser = await appUsersDB.getAppUserById(id, true);
                if (!appUser) {
                    return res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
                }
                
                const isPasswordValid = await bcrypt.compare(currentPassword, appUser.password_hash);
                if (!isPasswordValid) {
                    return res.status(400).json({ message: '기존 비밀번호가 일치하지 않습니다.' });
                }
            }
            
            const saltRounds = 10;
            updates.password_hash = await bcrypt.hash(password, saltRounds);
        }
        
        const appUser = await appUsersDB.updateAppUser(id, updates);
        res.json(appUser);
    } catch (error) {
        console.error('[API] 앱 유저 수정 오류:', error);
        if (error.message === '앱 유저를 찾을 수 없습니다.') {
            res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '앱 유저 수정 중 오류가 발생했습니다.' });
        }
    }
});

// 앱 유저 삭제
app.delete('/api/app-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await appUsersDB.deleteAppUser(id);
        res.json({ message: '앱 유저가 삭제되었습니다.', user: deleted });
    } catch (error) {
        console.error('[API] 앱 유저 삭제 오류:', error);
        if (error.message === '앱 유저를 찾을 수 없습니다.') {
            res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '앱 유저 삭제 중 오류가 발생했습니다.' });
        }
    }
});

// ========== 운동기록 API ==========

// 트레이너의 app_user 조회 또는 생성
app.post('/api/trainer-app-user', async (req, res) => {
    try {
        const { username, name } = req.body;
        
        if (!username) {
            return res.status(400).json({ message: '사용자명이 필요합니다.' });
        }
        
        // 이미 존재하는 app_user 조회
        let appUser = await appUsersDB.getAppUserByUsername(username);
        
        if (!appUser) {
            // 존재하지 않으면 생성 (서버 초기화 시 등록되어야 하지만, 혹시 모를 경우를 대비)
            const bcrypt = require('bcrypt');
            const saltRounds = 10;
            const password_hash = await bcrypt.hash('123', saltRounds); // 기본 비밀번호
            
            const newUser = await appUsersDB.addAppUser({
                username: username,
                password_hash: password_hash,
                name: name || username,
                phone: '',
                member_name: null,
                is_active: true
            });
            
            appUser = {
                id: newUser.id,
                username: newUser.username,
                name: newUser.name,
                phone: newUser.phone || '',
                member_name: newUser.member_name || null
            };
        } else {
            // password_hash 제외하고 반환
            appUser = {
                id: appUser.id,
                username: appUser.username,
                name: appUser.name,
                phone: appUser.phone || '',
                member_name: appUser.member_name || null
            };
        }
        
        // 트레이너 여부 확인 (accounts.json에서 확인)
        let isTrainer = false;
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) {
                const accounts = JSON.parse(raw);
                const account = accounts.find(acc => acc.username === username && acc.role === 'trainer');
                isTrainer = !!account;
            }
        }
        
        // DB에 is_trainer 필드 업데이트 (accounts.json과 동기화)
        if (appUser.is_trainer !== isTrainer) {
            await appUsersDB.updateAppUser(appUser.id, { is_trainer: isTrainer });
            appUser.is_trainer = isTrainer;
        }
        
        appUser.isTrainer = appUser.is_trainer || isTrainer;
        res.json(appUser);
    } catch (error) {
        console.error('[API] 트레이너 app_user 조회/생성 오류:', error);
        res.status(500).json({ message: '트레이너 app_user 조회/생성 중 오류가 발생했습니다.' });
    }
});

// 디버깅 로그 전송 API
app.post('/api/debug-log', async (req, res) => {
    try {
        const { level, message, data } = req.body;
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { hour12: false });
        
        // 터미널에 로그 출력
        const logPrefix = level === 'PWA' || level === 'ELMO-PWA' ? '📱' : '🔧';
        const logMessage = `${logPrefix} [${timeStr}] [${level}] ${message}`;
        if (data && Object.keys(data).length > 0) {
            console.log(logMessage, JSON.stringify(data));
        } else {
            console.log(logMessage);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ [API] 디버깅 로그 처리 오류:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PWA 버전 체크 API (30초 폴링 방식)
// 환경 변수로 버전 관리: .env 파일에 PWA_VERSION=2026-01-31-v1 형식으로 설정
const PWA_VERSION = process.env.PWA_VERSION || new Date().toISOString();
app.get('/api/pwa/version', (req, res) => {
    res.json({ 
        version: PWA_VERSION,
        timestamp: Date.now() 
    });
});

// 운동기록 목록 조회
app.get('/api/workout-records', async (req, res) => {
    try {
        const { app_user_id, start_date, end_date } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 빈 배열 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.json([]);
        }
        
        const filters = {};
        if (start_date) filters.startDate = start_date;
        if (end_date) filters.endDate = end_date;
        
        const records = await workoutRecordsDB.getWorkoutRecords(app_user_id, filters);
        
        res.json(records);
    } catch (error) {
        console.error('[API] 운동기록 조회 오류:', error);
        res.status(500).json({ message: '운동기록 조회 중 오류가 발생했습니다.' });
    }
});

// 운동기록 통계 조회 (동적 라우트보다 먼저 정의)
app.get('/api/workout-records/stats', async (req, res) => {
    try {
        const { app_user_id, start_date, end_date } = req.query;
        
        if (!app_user_id || !start_date || !end_date) {
            return res.status(400).json({ message: '앱 유저 ID, 시작 날짜, 종료 날짜가 필요합니다.' });
        }
        
        const stats = await workoutRecordsDB.getWorkoutStats(app_user_id, start_date, end_date);
        res.json(stats);
    } catch (error) {
        console.error('[API] 운동기록 통계 조회 오류:', error);
        res.status(500).json({ message: '운동기록 통계 조회 중 오류가 발생했습니다.' });
    }
});

// 캘린더용 운동기록 조회 (경량 - 날짜별 완료 여부만, 동적 라우트보다 먼저 정의)
app.get('/api/workout-records/calendar', async (req, res) => {
    try {
        const { app_user_id, start_date, end_date } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 빈 객체 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.json({});
        }
        
        const summary = await achievementsDB.getWorkoutCalendarSummary(
            app_user_id,
            start_date || null,
            end_date || null
        );
        res.json(summary);
    } catch (error) {
        console.error('[API] 캘린더용 운동기록 조회 오류:', error);
        res.status(500).json({ message: '캘린더용 운동기록 조회 중 오류가 발생했습니다.' });
    }
});

// 운동기록 단일 조회 (동적 라우트는 구체적인 라우트 이후에 정의)
app.get('/api/workout-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 빈 응답 반환 (이제는 실제 UUID를 사용하므로 이 체크는 불필요하지만 안전을 위해 유지)
        if (app_user_id.startsWith('trainer-')) {
            return res.status(404).json({ message: '운동기록을 찾을 수 없습니다.' });
        }
        
        const record = await workoutRecordsDB.getWorkoutRecordById(id, app_user_id);
        
        if (!record) {
            return res.status(404).json({ message: '운동기록을 찾을 수 없습니다.' });
        }
        
        // JSON 직렬화 테스트
        try {
            JSON.stringify(record);
        } catch (jsonError) {
            console.error('[API] JSON 직렬화 실패:', jsonError);
            console.error('[API] 문제가 있는 레코드:', record);
            return res.status(500).json({ message: '데이터 직렬화 중 오류가 발생했습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 운동기록 단일 조회 오류:', error);
        console.error('[API] 운동기록 단일 조회 오류 상세:', {
            id: req.params.id,
            app_user_id: req.query.app_user_id,
            errorMessage: error.message,
            errorStack: error.stack
        });
        res.status(500).json({ message: error.message || '운동기록 조회 중 오류가 발생했습니다.' });
    }
});

// 운동기록 일괄 추가
app.post('/api/workout-records/batch', async (req, res) => {
    try {
        const { app_user_id, workout_records, trainer_username, trainer_name, actor_app_user_id } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        if (!Array.isArray(workout_records) || workout_records.length === 0) {
            return res.status(400).json({ message: '운동기록 배열이 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 운동기록을 추가할 수 없습니다.' });
        }
        
        // 입력 데이터 검증 및 변환
        const workoutDataArray = workout_records.map(record => ({
            app_user_id,
            workout_date: record.workout_date,
            is_text_record: record.is_text_record || false,
            text_content: record.text_content || null,
            workout_type_id: record.workout_type_id || null,
            duration_minutes: record.duration_minutes ? parseInt(record.duration_minutes) : null,
            condition_level: record.condition_level || null,
            intensity_level: record.intensity_level || null,
            fatigue_level: record.fatigue_level || null,
            sets: record.sets || [],
            notes: record.notes || null
        }));
        
        // 모든 기록의 workout_date 검증
        for (const data of workoutDataArray) {
            if (!data.workout_date) {
                return res.status(400).json({ message: '모든 운동기록에 운동 날짜가 필요합니다.' });
            }
        }
        
        const actorAppUserId = actor_app_user_id || app_user_id;
        let isTrainerActor = Boolean(trainer_username);
        if (!isTrainerActor && actorAppUserId && actorAppUserId !== app_user_id) {
            try {
                const actorUser = await appUsersDB.getAppUserById(actorAppUserId);
                if (actorUser?.is_trainer) {
                    isTrainerActor = true;
                }
            } catch (e) {
                // noop
            }
        }
        
        // 일괄 추가
        const records = await workoutRecordsDB.addWorkoutRecordsBatch(workoutDataArray);
        
        // 활동 이벤트 기록 (운동기록 생성)
        records.forEach(record => {
            logAppUserActivityEvent({
                eventType: 'workout_create',
                actorAppUserId: actorAppUserId,
                subjectAppUserId: app_user_id,
                meta: {
                    record_id: record.id,
                    workout_date: normalizeDateString(record.workout_date)
                }
            });
        });
        
        // 같은 날짜의 기록들을 그룹화하여 로그 생성 (각 날짜별로 1개만)
        const dateToRecordMap = new Map();
        for (const record of records) {
            // workout_date를 로컬 타임존 기준으로 YYYY-MM-DD 형식으로 변환
            let dateStr = '';
            if (record.workout_date instanceof Date) {
                // Date 객체를 로컬 타임존(KST) 기준으로 YYYY-MM-DD 형식으로 변환
                const year = record.workout_date.getFullYear();
                const month = String(record.workout_date.getMonth() + 1).padStart(2, '0');
                const day = String(record.workout_date.getDate()).padStart(2, '0');
                dateStr = `${year}-${month}-${day}`;
            } else if (typeof record.workout_date === 'string') {
                // 문자열인 경우 'T' 이전 부분만 추출 (YYYY-MM-DD 형식)
                dateStr = record.workout_date.split('T')[0];
            } else {
                // 기타 경우는 문자열로 변환 후 처리
                dateStr = String(record.workout_date).split('T')[0];
            }
            
            if (!dateToRecordMap.has(dateStr)) {
                dateToRecordMap.set(dateStr, record);
            }
        }
        
        // 각 날짜별로 로그 생성 (비동기, 실패해도 영향 없음)
        for (const [dateStr, record] of dateToRecordMap.entries()) {
            // 회원이 직접 등록한 경우에만 트레이너 활동 로그 생성
            if (!isTrainerActor) {
                createActivityLogForTrainer(
                    app_user_id, 
                    'workout_recorded', 
                    '운동기록이 등록되었습니다.', 
                    record.id,
                    dateStr
                ).catch(err => console.error('[Activity Log] 트레이너 로그 생성 실패:', err));
            }
            
            // 트레이너가 생성한 경우에만 회원 활동 로그 생성
            // trainer_username이 있을 때만 생성 (회원이 직접 등록한 경우는 생성하지 않음)
            if (trainer_username) {
                createActivityLogForMember(
                    app_user_id,
                    'workout_recorded',
                    '운동기록을 등록했습니다.',
                    record.id,
                    dateStr,
                    trainer_username,
                    trainer_name
                ).catch(err => console.error('[Activity Log] 회원 로그 생성 실패:', err));
            }
        }
        
        res.status(201).json(records);
    } catch (error) {
        console.error('[API] 운동기록 일괄 추가 오류:', error);
        res.status(500).json({ message: '운동기록 일괄 추가 중 오류가 발생했습니다.' });
    }
});

// 운동기록 단일 추가 (하위 호환성 유지)
app.post('/api/workout-records', async (req, res) => {
    try {
        const { app_user_id, workout_date, workout_type_id, duration_minutes, sets, notes, is_text_record, text_content, condition_level, intensity_level, fatigue_level, trainer_username, trainer_name, actor_app_user_id } = req.body;
        
        if (!app_user_id || !workout_date) {
            return res.status(400).json({ message: '앱 유저 ID와 운동 날짜는 필수입니다.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 운동기록을 추가할 수 없습니다.' });
        }
        
        const workoutData = {
            app_user_id,
            workout_date,
            is_text_record: is_text_record || false,
            text_content: text_content || null,
            workout_type_id: workout_type_id || null,
            duration_minutes: duration_minutes ? parseInt(duration_minutes) : null,
            condition_level: condition_level || null,
            intensity_level: intensity_level || null,
            fatigue_level: fatigue_level || null,
            sets: sets || [],
            notes: notes || null
        };
        
        const record = await workoutRecordsDB.addWorkoutRecord(workoutData);
        const actorAppUserId = actor_app_user_id || app_user_id;
        let isTrainerActor = Boolean(trainer_username);
        if (!isTrainerActor && actorAppUserId && actorAppUserId !== app_user_id) {
            try {
                const actorUser = await appUsersDB.getAppUserById(actorAppUserId);
                if (actorUser?.is_trainer) {
                    isTrainerActor = true;
                }
            } catch (e) {
                // noop
            }
        }
        
        logAppUserActivityEvent({
            eventType: 'workout_create',
            actorAppUserId: actorAppUserId,
            subjectAppUserId: app_user_id,
            meta: {
                record_id: record.id,
                workout_date: normalizeDateString(workout_date)
            }
        });
        
        // 회원이 직접 등록한 경우에만 트레이너 활동 로그 생성
        if (!isTrainerActor) {
            createActivityLogForTrainer(
                app_user_id, 
                'workout_recorded', 
                '운동기록이 등록되었습니다.', 
                record.id,
                workout_date
            ).catch(err => console.error('[Activity Log]', err));
        }
        
        // 트레이너가 생성한 경우 회원 활동 로그 생성
        if (trainer_username) {
            createActivityLogForMember(
                app_user_id,
                'workout_recorded',
                '운동기록을 등록했습니다.',
                record.id,
                workout_date,
                trainer_username,
                trainer_name
            ).catch(err => console.error('[Activity Log] 회원 로그 생성 실패:', err));
        }
        
        res.status(201).json(record);
    } catch (error) {
        console.error('[API] 운동기록 추가 오류:', error);
        res.status(500).json({ message: error.message || '운동기록 추가 중 오류가 발생했습니다.' });
    }
});

// 운동기록 순서 변경 (더 구체적인 라우트를 먼저 등록해야 함)
app.patch('/api/workout-records/reorder', async (req, res) => {
  try {
    const { app_user_id, workout_date, order } = req.body;
    
    if (!app_user_id || !workout_date || !Array.isArray(order) || order.length === 0) {
      console.error('[API] 운동기록 순서 변경: 필수 파라미터 누락', { app_user_id, workout_date, order });
      return res.status(400).json({ 
        error: 'app_user_id, workout_date, order 배열이 필요합니다.' 
      });
    }
    
    // 세션 확인 (다른 운동기록 API와 동일하게 app_user_id만 확인)
    // 세션 쿠키가 없어도 app_user_id로 권한 확인
    // 트레이너 전환 모드인 경우 에러 반환
    if (app_user_id.startsWith('trainer-')) {
      console.error('[API] 운동기록 순서 변경: 트레이너 모드 불가');
      return res.status(403).json({ error: '트레이너 모드에서는 순서를 변경할 수 없습니다.' });
    }
    
    // 순서 변경 실행
    const result = await workoutRecordsDB.reorderWorkoutRecords(
      app_user_id,
      workout_date,
      order
    );
    
    res.json(result);
  } catch (error) {
    console.error('[API] 운동기록 순서 변경 오류:', error);
    console.error('[API] 운동기록 순서 변경 오류 상세:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    res.status(500).json({ error: '운동기록 순서 변경 중 오류가 발생했습니다.' });
  }
});

// 운동기록 수정
app.patch('/api/workout-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id, workout_date, workout_type_id, duration_minutes, sets, notes, is_text_record, text_content, condition_level, intensity_level, fatigue_level } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 운동기록을 수정할 수 없습니다.' });
        }
        
        const updates = {};
        if (workout_date !== undefined) updates.workout_date = workout_date;
        if (is_text_record !== undefined) updates.is_text_record = is_text_record || false;
        if (text_content !== undefined) updates.text_content = text_content || null;
        if (workout_type_id !== undefined) updates.workout_type_id = workout_type_id || null;
        if (duration_minutes !== undefined) updates.duration_minutes = duration_minutes ? parseInt(duration_minutes) : null;
        if (sets !== undefined) updates.sets = sets;
        if (notes !== undefined) updates.notes = notes;
        if (condition_level !== undefined) updates.condition_level = condition_level || null;
        if (intensity_level !== undefined) updates.intensity_level = intensity_level || null;
        if (fatigue_level !== undefined) updates.fatigue_level = fatigue_level || null;
        
        const record = await workoutRecordsDB.updateWorkoutRecord(id, app_user_id, updates);
        
        if (!record) {
            return res.status(404).json({ message: '운동기록을 찾을 수 없습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 운동기록 수정 오류:', error);
        res.status(500).json({ message: error.message || '운동기록 수정 중 오류가 발생했습니다.' });
    }
});

// 운동기록 완료 상태 업데이트 (시간 운동용)
app.patch('/api/workout-records/:id/completed', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id, is_completed } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        if (typeof is_completed !== 'boolean') {
            return res.status(400).json({ message: 'is_completed는 boolean 값이어야 합니다.' });
        }
        
        const record = await workoutRecordsDB.updateWorkoutRecordCompleted(id, app_user_id, is_completed);
        
        if (!record) {
            return res.status(404).json({ message: '운동기록을 찾을 수 없습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 운동기록 완료 상태 업데이트 오류:', error);
        res.status(500).json({ message: '완료 상태 업데이트 중 오류가 발생했습니다.' });
    }
});

// 세트 완료 상태 업데이트
app.patch('/api/workout-records/:id/sets/:setId/completed', async (req, res) => {
    try {
        const { id, setId } = req.params;
        const { app_user_id, is_completed } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        if (typeof is_completed !== 'boolean') {
            return res.status(400).json({ message: 'is_completed는 boolean 값이어야 합니다.' });
        }
        
        const set = await workoutRecordsDB.updateWorkoutSetCompleted(setId, id, app_user_id, is_completed);
        
        if (!set) {
            return res.status(404).json({ message: '세트를 찾을 수 없습니다.' });
        }
        
        res.json(set);
    } catch (error) {
        console.error('[API] 세트 완료 상태 업데이트 오류:', error);
        res.status(500).json({ message: '세트 완료 상태 업데이트 중 오류가 발생했습니다.' });
    }
});

// 운동기록 삭제
app.delete('/api/workout-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 운동기록을 삭제할 수 없습니다.' });
        }
        
        const deleted = await workoutRecordsDB.deleteWorkoutRecord(id, app_user_id);
        
        if (!deleted) {
            return res.status(404).json({ message: '운동기록을 찾을 수 없습니다.' });
        }
        
        res.json({ message: '운동기록이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 운동기록 삭제 오류:', error);
        res.status(500).json({ message: '운동기록 삭제 중 오류가 발생했습니다.' });
    }
});

// ============================================
// 식단기록 API
// ============================================

// 식단기록 목록 조회
app.get('/api/diet-records', async (req, res) => {
    try {
        const { app_user_id, start_date, end_date, page, limit } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 빈 배열 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.json([]);
        }
        
        const filters = {};
        if (start_date) filters.startDate = start_date;
        if (end_date) filters.endDate = end_date;
        if (page) filters.offset = (parseInt(page) - 1) * (parseInt(limit) || 20);
        if (limit) filters.limit = parseInt(limit);
        
        const records = await dietRecordsDB.getDietRecords(app_user_id, filters);
        res.json(records);
    } catch (error) {
        console.error('[API] 식단기록 조회 오류:', error);
        res.status(500).json({ message: '식단기록 조회 중 오류가 발생했습니다.' });
    }
});

// 캘린더용 식단기록 조회 (경량 - 날짜별 존재 여부만)
app.get('/api/diet-records/calendar', async (req, res) => {
    try {
        const { app_user_id, start_date, end_date } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 빈 객체 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.json({});
        }
        
        const summary = await achievementsDB.getDietCalendarSummary(
            app_user_id,
            start_date || null,
            end_date || null
        );
        res.json(summary);
    } catch (error) {
        console.error('[API] 캘린더용 식단기록 조회 오류:', error);
        res.status(500).json({ message: '캘린더용 식단기록 조회 중 오류가 발생했습니다.' });
    }
});

// 식단기록 단일 조회
app.get('/api/diet-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 404 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
        }
        
        const record = await dietRecordsDB.getDietRecordById(id, app_user_id);
        
        if (!record) {
            return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 식단기록 단일 조회 오류:', error);
        res.status(500).json({ message: '식단기록 조회 중 오류가 발생했습니다.' });
    }
});

// 식단기록 추가 (이미지 업로드 지원)
app.post('/api/diet-records', imageUpload.single('image'), async (req, res) => {
    try {
        const { app_user_id, meal_date, meal_time, meal_type, notes, actor_app_user_id, actor_username } = req.body;
        
        if (!app_user_id || !meal_date) {
            return res.status(400).json({ message: '앱 유저 ID와 식사 날짜가 필요합니다.' });
        }
        
        if (!meal_type) {
            return res.status(400).json({ message: '식사 구분을 선택해주세요.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 식단기록을 추가할 수 없습니다.' });
        }
        
        // notes 처리: null, undefined, "null" 문자열을 빈 문자열로 변환
        const processedNotes = (notes === null || notes === undefined || notes === 'null') ? '' : (notes || '');
        
        // 이미지 처리 (있는 경우)
        let imageUrls = { image_url: null, image_thumbnail_url: null };
        if (req.file) {
            // 파일 타입 검증
            if (!req.file.mimetype.startsWith('image/')) {
                return res.status(400).json({ message: '이미지 파일만 업로드 가능합니다.' });
            }
            
            // 파일 크기 제한 (10MB)
            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(400).json({ message: '이미지 파일 크기는 10MB 이하여야 합니다.' });
            }
            
            // 식단기록을 먼저 생성하여 ID 획득
            const tempDietData = {
                app_user_id,
                meal_date,
                meal_time: meal_time || null,
                meal_type: meal_type || null,
                notes: processedNotes
            };
            const tempRecord = await dietRecordsDB.addDietRecord(tempDietData);
            
            // 이미지 저장
            imageUrls = await saveDietImage(tempRecord.id, req.file.buffer, meal_date);
            
            // 이미지 URL 업데이트
            await dietRecordsDB.updateDietRecord(tempRecord.id, app_user_id, imageUrls);
            
            // 업데이트된 레코드 조회
            const record = await dietRecordsDB.getDietRecordById(tempRecord.id, app_user_id);
            
            let actorAppUserId = actor_app_user_id || app_user_id;
            if (actor_username && (!actor_app_user_id || actor_app_user_id === app_user_id)) {
                const actorUser = await appUsersDB.getAppUserByUsername(actor_username);
                if (actorUser && actorUser.is_trainer) {
                    actorAppUserId = actorUser.id;
                }
            }
            
            logAppUserActivityEvent({
                eventType: 'diet_create',
                actorAppUserId: actorAppUserId,
                subjectAppUserId: app_user_id,
                meta: {
                    record_id: record.id,
                    meal_date: meal_date
                }
            });
            
            const isTrainerActor = actorAppUserId && actorAppUserId !== app_user_id;
            if (!isTrainerActor) {
                createActivityLogForTrainer(
                    app_user_id, 
                    'diet_recorded', 
                    '식단기록이 등록되었습니다.', 
                    record.id,
                    meal_date
                ).catch(err => console.error('[Activity Log]', err));
            }
            
            res.status(201).json(record);
        } else {
            // 이미지 없이 추가
            const dietData = {
                app_user_id,
                meal_date,
                meal_time: meal_time || null,
                meal_type: meal_type || null,
                notes: processedNotes
            };
            
            const record = await dietRecordsDB.addDietRecord(dietData);
            let actorAppUserId = actor_app_user_id || app_user_id;
            if (actor_username && (!actor_app_user_id || actor_app_user_id === app_user_id)) {
                const actorUser = await appUsersDB.getAppUserByUsername(actor_username);
                if (actorUser && actorUser.is_trainer) {
                    actorAppUserId = actorUser.id;
                }
            }
            
            logAppUserActivityEvent({
                eventType: 'diet_create',
                actorAppUserId: actorAppUserId,
                subjectAppUserId: app_user_id,
                meta: {
                    record_id: record.id,
                    meal_date: meal_date
                }
            });
            
            const isTrainerActor = actorAppUserId && actorAppUserId !== app_user_id;
            if (!isTrainerActor) {
                createActivityLogForTrainer(
                    app_user_id, 
                    'diet_recorded', 
                    '식단기록이 등록되었습니다.', 
                    record.id,
                    meal_date
                ).catch(err => console.error('[Activity Log]', err));
            }
            
            res.status(201).json(record);
        }
    } catch (error) {
        console.error('[API] 식단기록 추가 오류:', error);
        res.status(500).json({ message: '식단기록 추가 중 오류가 발생했습니다.' });
    }
});

// 식단기록 수정 (이미지 업로드 지원)
app.patch('/api/diet-records/:id', imageUpload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id, meal_date, meal_time, meal_type, notes, remove_image } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // meal_type이 업데이트되는 경우 필수 검증
        if (meal_type !== undefined && !meal_type) {
            return res.status(400).json({ message: '식사 구분을 선택해주세요.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 식단기록을 수정할 수 없습니다.' });
        }
        
        // 기존 레코드 조회 (meal_date 확인 필요)
        const existingRecord = await dietRecordsDB.getDietRecordById(id, app_user_id);
        if (!existingRecord) {
            return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
        }
        
        const updates = {};
        if (meal_date !== undefined) updates.meal_date = meal_date;
        if (meal_time !== undefined) updates.meal_time = meal_time;
        if (meal_type !== undefined) updates.meal_type = meal_type;
        if (notes !== undefined) {
            // notes 처리: null, undefined, "null" 문자열을 빈 문자열로 변환
            updates.notes = (notes === null || notes === undefined || notes === 'null') ? '' : (notes || '');
        }
        
        // 이미지 제거 요청
        if (remove_image === 'true') {
            // 기존 이미지 파일 삭제 (선택사항, 나중에 추가 가능)
            updates.image_url = null;
            updates.image_thumbnail_url = null;
        }
        
        // 새 이미지 업로드
        if (req.file) {
            // 파일 타입 검증
            if (!req.file.mimetype.startsWith('image/')) {
                return res.status(400).json({ message: '이미지 파일만 업로드 가능합니다.' });
            }
            
            // 파일 크기 제한 (10MB)
            if (req.file.size > 10 * 1024 * 1024) {
                return res.status(400).json({ message: '이미지 파일 크기는 10MB 이하여야 합니다.' });
            }
            
            // 이미지 저장 (meal_date는 업데이트된 값 또는 기존 값 사용)
            const dateForImage = updates.meal_date || existingRecord.meal_date;
            const imageUrls = await saveDietImage(id, req.file.buffer, dateForImage);
            updates.image_url = imageUrls.image_url;
            updates.image_thumbnail_url = imageUrls.image_thumbnail_url;
        }
        
        const record = await dietRecordsDB.updateDietRecord(id, app_user_id, updates);
        
        if (!record) {
            return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 식단기록 수정 오류:', error);
        res.status(500).json({ message: '식단기록 수정 중 오류가 발생했습니다.' });
    }
});

// 식단기록 평가 설정 (트레이너 전용)
app.patch('/api/diet-records/:id/evaluation', async (req, res) => {
    try {
        const { id } = req.params;
        const { evaluation, trainer_username, trainer_name, trainer_app_user_id } = req.body;
        
        const allowedEvaluations = ['verygood', 'good', 'ok', 'bad', 'verybad'];
        if (evaluation && !allowedEvaluations.includes(evaluation)) {
            return res.status(400).json({ message: '평가 값이 올바르지 않습니다.' });
        }
        
        let finalTrainerUsername = trainer_username || null;
        let finalTrainerName = trainer_name || null;
        
        if (!finalTrainerUsername && trainer_app_user_id) {
            const trainerUser = await appUsersDB.getAppUserById(trainer_app_user_id);
            if (trainerUser) {
                finalTrainerUsername = trainerUser.username;
                finalTrainerName = finalTrainerName || trainerUser.name;
            }
        }
        
        if (!finalTrainerUsername) {
            return res.status(400).json({ message: '트레이너 정보가 필요합니다.' });
        }
        
        const record = await dietRecordsDB.getDietRecordById(id);
        if (!record) {
            return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
        }
        
        const appUser = await appUsersDB.getAppUserById(record.app_user_id);
        if (!appUser || !appUser.member_name) {
            return res.status(403).json({ message: '회원과 연결되지 않은 앱 유저입니다.' });
        }
        
        const member = await membersDB.getMemberByName(appUser.member_name);
        if (!member || member.trainer !== finalTrainerUsername) {
            return res.status(403).json({ message: '해당 회원의 담당 트레이너만 평가할 수 있습니다.' });
        }
        
        if (!finalTrainerName) {
            try {
                const trainerAppUsers = await appUsersDB.getAppUsers({ username: finalTrainerUsername });
                const trainerAppUser = Array.isArray(trainerAppUsers) ? trainerAppUsers[0] : trainerAppUsers;
                if (trainerAppUser && trainerAppUser.name) {
                    finalTrainerName = trainerAppUser.name;
                } else {
                    let accounts = [];
                    if (fs.existsSync(DATA_PATH)) {
                        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                        if (raw) accounts = JSON.parse(raw);
                    }
                    const trainerAccount = accounts.find(acc => acc.username === finalTrainerUsername && acc.role === 'trainer');
                    finalTrainerName = trainerAccount?.name || finalTrainerUsername;
                }
            } catch (e) {
                finalTrainerName = finalTrainerUsername;
            }
        }
        
        const updated = await dietRecordsDB.updateDietRecordEvaluation(id, {
            trainer_evaluation: evaluation || null,
            trainer_evaluator_username: evaluation ? finalTrainerUsername : null,
            trainer_evaluator_name: evaluation ? finalTrainerName : null
        });

        if (evaluation) {
            await logAppUserActivityEvent({
                eventType: 'diet_badge_added',
                actorAppUserId: trainer_app_user_id || null,
                subjectAppUserId: record.app_user_id,
                source: 'trainer_proxy',
                meta: {
                    diet_record_id: record.id,
                    evaluation
                }
            });

            createActivityLogForMember(
                record.app_user_id,
                'diet_badge_added',
                '식단 배지를 추가했습니다.',
                record.id,
                record.meal_date,
                finalTrainerUsername,
                finalTrainerName
            ).catch(err => console.error('[Activity Log] 회원 로그 생성 실패:', err));
        }
        
        res.json(updated);
    } catch (error) {
        console.error('[API] 식단기록 평가 설정 오류:', error);
        res.status(500).json({ message: '식단기록 평가 설정 중 오류가 발생했습니다.' });
    }
});

// 식단기록 삭제
app.delete('/api/diet-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 전환 모드인 경우 에러 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 식단기록을 삭제할 수 없습니다.' });
        }
        
        const deleted = await dietRecordsDB.deleteDietRecord(id, app_user_id);
        
        if (!deleted) {
            return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
        }
        
        // 이미지 파일 삭제
        if (deleted.image_url) {
            try {
                // image_url에서 상대 경로 추출
                // 예: uploads/diet-images/2025/01/{uuid}/original.jpg 또는 /uploads/diet-images/2025/01/{uuid}/original.jpg
                let relativePath = deleted.image_url;
                if (relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1); // 앞의 / 제거
                }
                if (relativePath.startsWith('uploads/')) {
                    relativePath = relativePath.substring('uploads/'.length); // 'uploads/' 제거
                }
                
                // UPLOADS_DIR 기준으로 실제 파일 경로 구성
                // 예: diet-images/2025/01/{uuid}/original.jpg -> UPLOADS_DIR/diet-images/2025/01/{uuid}
                const imagePath = path.join(UPLOADS_DIR, relativePath);
                const imageDir = path.dirname(imagePath);
                
                // 디렉토리가 존재하면 전체 디렉토리 삭제 (original.jpg, thumbnail_300x300.jpg 모두 포함)
                if (fs.existsSync(imageDir)) {
                    fs.rmSync(imageDir, { recursive: true, force: true });
                }
            } catch (fileError) {
                // 파일 삭제 실패해도 DB 삭제는 성공했으므로 경고만 로그
                console.warn('[API] 식단 이미지 파일 삭제 실패 (DB 삭제는 완료):', fileError);
            }
        }
        
        res.json({ message: '식단기록이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 식단기록 삭제 오류:', error);
        res.status(500).json({ message: '식단기록 삭제 중 오류가 발생했습니다.' });
    }
});

// ========== 회원 활동 로그 API ==========

// 회원 활동 로그 조회
app.get('/api/member-activity-logs', async (req, res) => {
    try {
        const { app_user_id, unread_only, limit, offset } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        // 트레이너 임시 ID인 경우 빈 데이터 반환
        if (app_user_id.startsWith('trainer-')) {
            return res.json({ logs: [], unreadCount: 0 });
        }
        
        const filters = {};
        if (unread_only === 'true') {
            filters.unread_only = true;
        }
        if (limit) {
            filters.limit = parseInt(limit);
        }
        if (offset) {
            filters.offset = parseInt(offset);
        }
        
        const logs = await memberActivityLogsDB.getActivityLogs(app_user_id, filters);
        const unreadCount = await memberActivityLogsDB.getUnreadCount(app_user_id);
        
        res.json({
            logs,
            unreadCount
        });
    } catch (error) {
        console.error('[API] 회원 활동 로그 조회 오류:', error);
        res.status(500).json({ message: '회원 활동 로그 조회 중 오류가 발생했습니다.' });
    }
});

// 회원 활동 로그 개별 읽음 처리
app.patch('/api/member-activity-logs/:id/read', async (req, res) => {
    try {
        const { id } = req.params;
        const { app_user_id } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 회원 로그를 처리할 수 없습니다.' });
        }
        
        const result = await memberActivityLogsDB.markAsRead(id, app_user_id);
        
        if (!result) {
            return res.status(404).json({ message: '로그를 찾을 수 없습니다.' });
        }
        
        res.json({ message: '로그가 읽음 처리되었습니다.', log: result });
    } catch (error) {
        console.error('[API] 회원 활동 로그 읽음 처리 오류:', error);
        res.status(500).json({ message: '로그 읽음 처리 중 오류가 발생했습니다.' });
    }
});

// 회원 활동 로그 전체 읽음 처리
app.patch('/api/member-activity-logs/read-all', async (req, res) => {
    try {
        const { app_user_id } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        if (app_user_id.startsWith('trainer-')) {
            return res.status(403).json({ message: '트레이너 모드에서는 회원 로그를 처리할 수 없습니다.' });
        }
        
        const result = await memberActivityLogsDB.markAllAsRead(app_user_id);
        
        res.json({ 
            message: '모든 로그가 읽음 처리되었습니다.', 
            readCount: result.count 
        });
    } catch (error) {
        console.error('[API] 회원 활동 로그 전체 읽음 처리 오류:', error);
        res.status(500).json({ message: '전체 로그 읽음 처리 중 오류가 발생했습니다.' });
    }
});

// ========== 트레이너 활동 로그 API ==========

// 트레이너 활동 로그 조회
app.get('/api/trainer-activity-logs', async (req, res) => {
    try {
        const { trainer_username, unread_only, limit, offset } = req.query;
        
        if (!trainer_username) {
            return res.status(400).json({ message: '트레이너 username이 필요합니다.' });
        }
        
        const filters = {};
        if (unread_only === 'true') {
            filters.unread_only = true;
        }
        if (limit) {
            filters.limit = parseInt(limit);
        }
        if (offset) {
            filters.offset = parseInt(offset);
        }
        
        const logs = await activityLogsDB.getActivityLogs(trainer_username, filters);
        const unreadCount = await activityLogsDB.getUnreadCount(trainer_username);
        
        res.json({
            logs,
            unreadCount
        });
    } catch (error) {
        console.error('[API] 트레이너 활동 로그 조회 오류:', error);
        res.status(500).json({ message: '활동 로그 조회 중 오류가 발생했습니다.' });
    }
});

// 전체 로그 읽음 처리 (더 구체적인 라우트를 먼저 등록)
// 개별 로그 읽음 처리 (더 구체적인 라우트를 먼저 등록)
app.patch('/api/trainer-activity-logs/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const { trainer_username } = req.body;
    
    if (!trainer_username) {
      return res.status(400).json({ message: '트레이너 username이 필요합니다.' });
    }
    
    const result = await activityLogsDB.markAsRead(id, trainer_username);
    
    if (!result) {
      return res.status(404).json({ message: '로그를 찾을 수 없습니다.' });
    }
    
    res.json({ 
      message: '로그가 읽음 처리되었습니다.',
      log: result
    });
  } catch (error) {
    console.error('[API] 로그 읽음 처리 오류:', error);
    res.status(500).json({ message: '로그 읽음 처리 중 오류가 발생했습니다.' });
  }
});

// 전체 로그 읽음 처리
app.patch('/api/trainer-activity-logs/read-all', async (req, res) => {
  try {
    const { trainer_username } = req.body;
    
    if (!trainer_username) {
      return res.status(400).json({ message: '트레이너 username이 필요합니다.' });
    }
    
    const result = await activityLogsDB.markAllAsRead(trainer_username);
    
    res.json({ 
      message: '모든 로그가 읽음 처리되었습니다.', 
      readCount: result.count 
    });
  } catch (error) {
    console.error('[API] 전체 로그 읽음 처리 오류:', error);
    res.status(500).json({ message: '전체 로그 읽음 처리 중 오류가 발생했습니다.' });
  }
});

// 식단 코멘트 추가
app.post('/api/diet-records/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { commenter_type, commenter_id, commenter_name, comment_text } = req.body;
        
        if (!commenter_type || !commenter_id || !comment_text) {
            return res.status(400).json({ message: '코멘트 작성자 타입, ID, 코멘트 내용이 필요합니다.' });
        }
        
        if (!['user', 'trainer'].includes(commenter_type)) {
            return res.status(400).json({ message: 'commenter_type은 "user" 또는 "trainer"여야 합니다.' });
        }
        
        // 식단기록 존재 여부 확인 (권한 체크를 위해 app_user_id도 필요)
        const { app_user_id } = req.query;
        if (app_user_id) {
            const record = await dietRecordsDB.getDietRecordById(id, app_user_id);
            if (!record) {
                return res.status(404).json({ message: '식단기록을 찾을 수 없습니다.' });
            }
        }
        
        const commentData = {
            commenter_type,
            commenter_id,
            commenter_name: commenter_name || null,
            comment_text
        };
        
        const comment = await dietRecordsDB.addDietComment(id, commentData);
        
        // 식단 기록 조회 (app_user_id 없이도 조회 가능)
        const record = await dietRecordsDB.getDietRecordById(id);
        
        if (record && record.app_user_id) {
            let actorAppUserId = null;
            if (commenter_type === 'user') {
                actorAppUserId = commenter_id;
            } else if (commenter_type === 'trainer') {
                const trainerUser = await appUsersDB.getAppUserByUsername(commenter_id);
                actorAppUserId = trainerUser?.id || null;
            }
            
            if (actorAppUserId) {
                await logAppUserActivityEvent({
                    eventType: 'diet_comment_create',
                    actorAppUserId,
                    subjectAppUserId: record.app_user_id,
                    source: commenter_type === 'trainer' ? 'trainer_proxy' : 'self',
                    meta: {
                        diet_record_id: id,
                        meal_date: record.meal_date
                    }
                });
            }
            
            // 회원이 코멘트를 남긴 경우 트레이너에게 로그 생성
            if (commenter_type === 'user') {
                await createActivityLogForTrainer(
                    record.app_user_id,
                    'diet_comment_added',
                    '식단에 코멘트가 등록되었습니다.',
                    id, // related_record_id: 식단 기록 ID
                    record.meal_date // record_date: 식단 날짜
                ).catch(err => console.error('[Activity Log] 코멘트 로그 생성 실패:', err));
            }
            
            // 트레이너가 코멘트를 남긴 경우 회원에게 로그 생성
            if (commenter_type === 'trainer') {
                await createActivityLogForMember(
                    record.app_user_id,
                    'diet_comment_added',
                    '식단기록에 코멘트를 남겼습니다.',
                    id,
                    record.meal_date,
                    commenter_id, // trainer username
                    commenter_name // trainer name
                ).catch(err => console.error('[Activity Log] 회원 로그 생성 실패:', err));
            }

            achievementsDB.refreshDailyStats(record.app_user_id, record.meal_date)
                .catch(err => console.error('[Daily Stats] 식단 코멘트 집계 갱신 실패:', err));
        }
        
        res.status(201).json(comment);
    } catch (error) {
        console.error('[API] 식단 코멘트 추가 오류:', error);
        res.status(500).json({ message: '식단 코멘트 추가 중 오류가 발생했습니다.' });
    }
});

// 식단 하루 코멘트 조회
app.get('/api/diet-records/:appUserId/daily-comments', async (req, res) => {
    try {
        const { appUserId } = req.params;
        const { date, startDate, endDate } = req.query;
        
        if (!appUserId) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        const filters = {};
        if (date) {
            filters.date = date;
        } else if (startDate && endDate) {
            filters.startDate = startDate;
            filters.endDate = endDate;
        }
        
        const comments = await dietDailyCommentsDB.getComments(appUserId, filters);
        res.json({ comments });
    } catch (error) {
        console.error('[API] 식단 하루 코멘트 조회 오류:', error);
        res.status(500).json({ message: '식단 하루 코멘트 조회 중 오류가 발생했습니다.' });
    }
});

// 식단 하루 코멘트 생성
app.post('/api/diet-records/:appUserId/daily-comments', async (req, res) => {
    try {
        const { appUserId } = req.params;
        const {
            diet_date,
            comment,
            commenter_type,
            commenter_app_user_id,
            commenter_username,
            commenter_name,
            trainer_username,
            trainer_name
        } = req.body;
        
        if (!appUserId || !diet_date || !comment) {
            return res.status(400).json({ message: '앱 유저 ID, 식단 날짜, 코멘트 내용이 필요합니다.' });
        }
        
        const appUser = await appUsersDB.getAppUserById(appUserId);
        if (!appUser) {
            return res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
        }
        
        const normalizedCommenterType = commenter_type || (trainer_username ? 'trainer' : 'member');
        let finalCommenterType = normalizedCommenterType;
        let finalCommenterAppUserId = commenter_app_user_id;
        let finalCommenterUsername = commenter_username || trainer_username || null;
        let finalCommenterName = commenter_name || trainer_name || null;

        if (finalCommenterType === 'trainer') {
            if (!finalCommenterAppUserId && !finalCommenterUsername) {
                return res.status(400).json({ message: '트레이너 정보가 필요합니다.' });
            }

            if (!finalCommenterUsername && finalCommenterAppUserId) {
                const trainerUser = await appUsersDB.getAppUserById(finalCommenterAppUserId);
                if (trainerUser) {
                    finalCommenterUsername = trainerUser.username;
                    finalCommenterName = finalCommenterName || trainerUser.name;
                }
            }

            if (!finalCommenterAppUserId && finalCommenterUsername) {
                const trainerUser = await appUsersDB.getAppUserByUsername(finalCommenterUsername);
                if (trainerUser?.id) {
                    finalCommenterAppUserId = trainerUser.id;
                    finalCommenterName = finalCommenterName || trainerUser.name;
                }
            }

            if (!finalCommenterUsername) {
                return res.status(400).json({ message: '트레이너 정보가 필요합니다.' });
            }

            if (appUser.member_name) {
                const member = await membersDB.getMemberByName(appUser.member_name);
                if (!member || member.trainer !== finalCommenterUsername) {
                    return res.status(403).json({ message: '해당 회원의 담당 트레이너만 코멘트를 작성할 수 있습니다.' });
                }
            } else {
                return res.status(403).json({ message: '회원과 연결되지 않은 앱 유저입니다.' });
            }

            if (!finalCommenterName) {
                try {
                    const trainerAppUsers = await appUsersDB.getAppUsers({ username: finalCommenterUsername });
                    const trainerAppUser = Array.isArray(trainerAppUsers) ? trainerAppUsers[0] : trainerAppUsers;
                    if (trainerAppUser && trainerAppUser.name) {
                        finalCommenterName = trainerAppUser.name;
                    } else {
                        let accounts = [];
                        if (fs.existsSync(DATA_PATH)) {
                            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                            if (raw) accounts = JSON.parse(raw);
                        }
                        const trainerAccount = accounts.find(acc => acc.username === finalCommenterUsername && acc.role === 'trainer');
                        if (trainerAccount && trainerAccount.name) {
                            finalCommenterName = trainerAccount.name;
                        } else {
                            finalCommenterName = finalCommenterUsername;
                        }
                    }
                } catch (e) {
                    finalCommenterName = finalCommenterUsername;
                }
            }
        } else {
            finalCommenterType = 'member';
            if (!finalCommenterAppUserId || finalCommenterAppUserId !== appUserId) {
                return res.status(403).json({ message: '본인만 코멘트를 작성할 수 있습니다.' });
            }
            const memberUser = await appUsersDB.getAppUserById(finalCommenterAppUserId);
            if (!memberUser) {
                return res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
            }
            finalCommenterUsername = finalCommenterUsername || memberUser.username;
            finalCommenterName = finalCommenterName || memberUser.name || memberUser.username;
        }

        const commentData = {
            app_user_id: appUserId,
            diet_date,
            commenter_type: finalCommenterType,
            commenter_app_user_id: finalCommenterAppUserId,
            commenter_username: finalCommenterUsername,
            commenter_name: finalCommenterName,
            comment
        };
        const savedComment = await dietDailyCommentsDB.addComment(commentData);

        if (finalCommenterAppUserId) {
            const activityPayload = {
                actorAppUserId: finalCommenterAppUserId,
                subjectAppUserId: appUserId,
                source: finalCommenterType === 'trainer' ? 'trainer_proxy' : 'self',
                meta: {
                    diet_daily_comment_id: savedComment.id,
                    diet_date
                }
            };
            
            // 식단 기록 코멘트와 동일한 이벤트로도 기록 (관리자 활동 로그에 포함)
            await logAppUserActivityEvent({
                eventType: 'diet_comment_create',
                ...activityPayload
            }).catch(err => console.error('[Activity Log] app_user_activity_events 생성 실패:', err));
            
            // 일별 코멘트 전용 이벤트도 유지
            await logAppUserActivityEvent({
                eventType: 'diet_daily_comment_create',
                ...activityPayload
            }).catch(err => console.error('[Activity Log] app_user_activity_events 생성 실패:', err));
        }

        if (finalCommenterType === 'trainer') {
            createActivityLogForMember(
                appUserId,
                'diet_daily_comment_added',
                '식단 코멘트를 남겼습니다.',
                savedComment.id,
                diet_date,
                finalCommenterUsername,
                finalCommenterName
            ).catch(err => console.error('[Activity Log] 회원 로그 생성 실패:', err));
        } else {
            createActivityLogForTrainer(
                appUserId,
                'diet_daily_comment_added',
                '식단에 코멘트가 등록되었습니다.',
                savedComment.id,
                diet_date
            ).catch(err => console.error('[Activity Log] 트레이너 로그 생성 실패:', err));
        }

        achievementsDB.refreshDailyStats(appUserId, diet_date)
            .catch(err => console.error('[Daily Stats] 식단 하루 코멘트 집계 갱신 실패:', err));
        
        res.status(201).json(savedComment);
    } catch (error) {
        console.error('[API] 식단 하루 코멘트 생성 오류:', error);
        res.status(500).json({ message: error.message || '식단 하루 코멘트 생성 중 오류가 발생했습니다.' });
    }
});

// 식단 하루 코멘트 수정
app.put('/api/diet-records/:appUserId/daily-comments/:commentId', async (req, res) => {
    try {
        const { appUserId, commentId } = req.params;
        const { comment, commenter_type, commenter_app_user_id, trainer_username } = req.body;
        
        if (!comment) {
            return res.status(400).json({ message: '코멘트 내용이 필요합니다.' });
        }
        
        const existingComment = await dietDailyCommentsDB.getCommentById(commentId);
        if (!existingComment) {
            return res.status(404).json({ message: '코멘트를 찾을 수 없습니다.' });
        }
        
        if (existingComment.app_user_id !== appUserId) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        const requesterType = commenter_type || (trainer_username ? 'trainer' : null);
        if (existingComment.commenter_type === 'trainer') {
            if (requesterType !== 'trainer') {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
            if (commenter_app_user_id && existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
            if (!commenter_app_user_id && trainer_username && existingComment.commenter_username !== trainer_username) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
        } else {
            if (!commenter_app_user_id || existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
        }
        
        const updatedComment = await dietDailyCommentsDB.updateComment(commentId, { comment });
        
        if (!updatedComment) {
            return res.status(404).json({ message: '코멘트 수정에 실패했습니다.' });
        }
        
        res.json(updatedComment);
    } catch (error) {
        console.error('[API] 식단 하루 코멘트 수정 오류:', error);
        res.status(500).json({ message: error.message || '식단 하루 코멘트 수정 중 오류가 발생했습니다.' });
    }
});

// 식단 하루 코멘트 삭제
app.delete('/api/diet-records/:appUserId/daily-comments/:commentId', async (req, res) => {
    try {
        const { appUserId, commentId } = req.params;
        const { commenter_type, commenter_app_user_id, trainer_username } = req.body;
        
        const existingComment = await dietDailyCommentsDB.getCommentById(commentId);
        if (!existingComment) {
            return res.status(404).json({ message: '코멘트를 찾을 수 없습니다.' });
        }
        
        if (existingComment.app_user_id !== appUserId) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        const requesterType = commenter_type || (trainer_username ? 'trainer' : null);
        if (existingComment.commenter_type === 'trainer') {
            if (requesterType !== 'trainer') {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
            if (commenter_app_user_id && existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
            if (!commenter_app_user_id && trainer_username && existingComment.commenter_username !== trainer_username) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
        } else {
            if (!commenter_app_user_id || existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
        }
        
        const deletedComment = await dietDailyCommentsDB.deleteComment(commentId);
        
        if (!deletedComment) {
            return res.status(404).json({ message: '코멘트 삭제에 실패했습니다.' });
        }
        
        res.json(deletedComment);
    } catch (error) {
        console.error('[API] 식단 하루 코멘트 삭제 오류:', error);
        res.status(500).json({ message: error.message || '식단 하루 코멘트 삭제 중 오류가 발생했습니다.' });
    }
});

// 운동 코멘트 조회
app.get('/api/workout-records/:appUserId/comments', async (req, res) => {
    try {
        const { appUserId } = req.params;
        const { date, startDate, endDate } = req.query;
        
        if (!appUserId) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        const filters = {};
        if (date) {
            filters.date = date;
        } else if (startDate && endDate) {
            filters.startDate = startDate;
            filters.endDate = endDate;
        }
        
        const comments = await workoutCommentsDB.getComments(appUserId, filters);
        res.json({ comments });
    } catch (error) {
        console.error('[API] 운동 코멘트 조회 오류:', error);
        res.status(500).json({ message: '운동 코멘트 조회 중 오류가 발생했습니다.' });
    }
});

// 운동 코멘트 생성
app.post('/api/workout-records/:appUserId/comments', async (req, res) => {
    try {
        const { appUserId } = req.params;
        const {
            workout_date,
            comment,
            commenter_type,
            commenter_app_user_id,
            commenter_username,
            commenter_name,
            trainer_username,
            trainer_name
        } = req.body;
        
        if (!appUserId || !workout_date || !comment) {
            return res.status(400).json({ message: '앱 유저 ID, 운동 날짜, 코멘트 내용이 필요합니다.' });
        }
        
        // 앱 유저 존재 확인
        const appUser = await appUsersDB.getAppUserById(appUserId);
        if (!appUser) {
            return res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
        }
        
        const normalizedCommenterType = commenter_type || (trainer_username ? 'trainer' : 'member');
        let finalCommenterType = normalizedCommenterType;
        let finalCommenterAppUserId = commenter_app_user_id;
        let finalCommenterUsername = commenter_username || trainer_username || null;
        let finalCommenterName = commenter_name || trainer_name || null;

        if (finalCommenterType === 'trainer') {
            if (!finalCommenterAppUserId && !finalCommenterUsername) {
                return res.status(400).json({ message: '트레이너 정보가 필요합니다.' });
            }

            if (!finalCommenterUsername && finalCommenterAppUserId) {
                const trainerUser = await appUsersDB.getAppUserById(finalCommenterAppUserId);
                if (trainerUser) {
                    finalCommenterUsername = trainerUser.username;
                    finalCommenterName = finalCommenterName || trainerUser.name;
                }
            }

            if (!finalCommenterAppUserId && finalCommenterUsername) {
                const trainerUser = await appUsersDB.getAppUserByUsername(finalCommenterUsername);
                if (trainerUser?.id) {
                    finalCommenterAppUserId = trainerUser.id;
                    finalCommenterName = finalCommenterName || trainerUser.name;
                }
            }

            if (!finalCommenterUsername) {
                return res.status(400).json({ message: '트레이너 정보가 필요합니다.' });
            }

            // 권한 확인: 트레이너가 해당 회원의 담당 트레이너인지 확인
            if (appUser.member_name) {
                const member = await membersDB.getMemberByName(appUser.member_name);
                if (!member || member.trainer !== finalCommenterUsername) {
                    return res.status(403).json({ message: '해당 회원의 담당 트레이너만 코멘트를 작성할 수 있습니다.' });
                }
            } else {
                return res.status(403).json({ message: '회원과 연결되지 않은 앱 유저입니다.' });
            }

            if (!finalCommenterName) {
                try {
                    const trainerAppUsers = await appUsersDB.getAppUsers({ username: finalCommenterUsername });
                    const trainerAppUser = Array.isArray(trainerAppUsers) ? trainerAppUsers[0] : trainerAppUsers;
                    if (trainerAppUser && trainerAppUser.name) {
                        finalCommenterName = trainerAppUser.name;
                    } else {
                        let accounts = [];
                        if (fs.existsSync(DATA_PATH)) {
                            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                            if (raw) accounts = JSON.parse(raw);
                        }
                        const trainerAccount = accounts.find(acc => acc.username === finalCommenterUsername && acc.role === 'trainer');
                        if (trainerAccount && trainerAccount.name) {
                            finalCommenterName = trainerAccount.name;
                        } else {
                            finalCommenterName = finalCommenterUsername;
                        }
                    }
                } catch (e) {
                    finalCommenterName = finalCommenterUsername;
                }
            }
        } else {
            finalCommenterType = 'member';
            if (!finalCommenterAppUserId || finalCommenterAppUserId !== appUserId) {
                return res.status(403).json({ message: '본인만 코멘트를 작성할 수 있습니다.' });
            }
            const memberUser = await appUsersDB.getAppUserById(finalCommenterAppUserId);
            if (!memberUser) {
                return res.status(404).json({ message: '앱 유저를 찾을 수 없습니다.' });
            }
            finalCommenterUsername = finalCommenterUsername || memberUser.username;
            finalCommenterName = finalCommenterName || memberUser.name || memberUser.username;
        }

        const commentData = {
            app_user_id: appUserId,
            workout_date,
            commenter_type: finalCommenterType,
            commenter_app_user_id: finalCommenterAppUserId,
            commenter_username: finalCommenterUsername,
            commenter_name: finalCommenterName,
            comment
        };
        const savedComment = await workoutCommentsDB.addComment(commentData);

        if (finalCommenterAppUserId) {
            await logAppUserActivityEvent({
                eventType: 'workout_comment_create',
                actorAppUserId: finalCommenterAppUserId,
                subjectAppUserId: appUserId,
                source: finalCommenterType === 'trainer' ? 'trainer_proxy' : 'self',
                meta: {
                    workout_comment_id: savedComment.id,
                    workout_date
                }
            });
        }

        if (finalCommenterType === 'trainer') {
            createActivityLogForMember(
                appUserId,
                'workout_comment_added',
                '운동 코멘트를 남겼습니다.',
                savedComment.id,
                workout_date,
                finalCommenterUsername,
                finalCommenterName
            ).catch(err => console.error('[Activity Log] 회원 로그 생성 실패:', err));
        } else {
            createActivityLogForTrainer(
                appUserId,
                'workout_comment_added',
                '운동에 코멘트가 등록되었습니다.',
                savedComment.id,
                workout_date
            ).catch(err => console.error('[Activity Log] 트레이너 로그 생성 실패:', err));
        }

        achievementsDB.refreshDailyStats(appUserId, workout_date)
            .catch(err => console.error('[Daily Stats] 운동 코멘트 집계 갱신 실패:', err));
        
        res.status(201).json(savedComment);
    } catch (error) {
        console.error('[API] 운동 코멘트 생성 오류:', error);
        res.status(500).json({ message: error.message || '운동 코멘트 생성 중 오류가 발생했습니다.' });
    }
});

// 운동 코멘트 수정
app.put('/api/workout-records/:appUserId/comments/:commentId', async (req, res) => {
    try {
        const { appUserId, commentId } = req.params;
        const { comment, commenter_type, commenter_app_user_id, trainer_username } = req.body;
        
        if (!comment) {
            return res.status(400).json({ message: '코멘트 내용이 필요합니다.' });
        }
        
        // 코멘트 존재 확인 및 권한 확인
        const existingComment = await workoutCommentsDB.getCommentById(commentId);
        if (!existingComment) {
            return res.status(404).json({ message: '코멘트를 찾을 수 없습니다.' });
        }
        
        if (existingComment.app_user_id !== appUserId) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        const requesterType = commenter_type || (trainer_username ? 'trainer' : null);
        if (existingComment.commenter_type === 'trainer') {
            if (requesterType !== 'trainer') {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
            if (commenter_app_user_id && existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
            if (!commenter_app_user_id && trainer_username && existingComment.commenter_username !== trainer_username) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
        } else {
            if (!commenter_app_user_id || existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 수정할 수 있습니다.' });
            }
        }
        
        // 코멘트 수정
        const updatedComment = await workoutCommentsDB.updateComment(commentId, { comment });
        
        if (!updatedComment) {
            return res.status(404).json({ message: '코멘트 수정에 실패했습니다.' });
        }
        
        res.json(updatedComment);
    } catch (error) {
        console.error('[API] 운동 코멘트 수정 오류:', error);
        res.status(500).json({ message: error.message || '운동 코멘트 수정 중 오류가 발생했습니다.' });
    }
});

// 운동 코멘트 삭제
app.delete('/api/workout-records/:appUserId/comments/:commentId', async (req, res) => {
    try {
        const { appUserId, commentId } = req.params;
        const { commenter_type, commenter_app_user_id, trainer_username } = req.body;
        
        // 코멘트 존재 확인 및 권한 확인
        const existingComment = await workoutCommentsDB.getCommentById(commentId);
        if (!existingComment) {
            return res.status(404).json({ message: '코멘트를 찾을 수 없습니다.' });
        }
        
        if (existingComment.app_user_id !== appUserId) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        const requesterType = commenter_type || (trainer_username ? 'trainer' : null);
        if (existingComment.commenter_type === 'trainer') {
            if (requesterType !== 'trainer') {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
            if (commenter_app_user_id && existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
            if (!commenter_app_user_id && trainer_username && existingComment.commenter_username !== trainer_username) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
        } else {
            if (!commenter_app_user_id || existingComment.commenter_app_user_id !== commenter_app_user_id) {
                return res.status(403).json({ message: '본인이 작성한 코멘트만 삭제할 수 있습니다.' });
            }
        }
        
        // 코멘트 삭제
        const deletedComment = await workoutCommentsDB.deleteComment(commentId);
        
        if (!deletedComment) {
            return res.status(404).json({ message: '코멘트 삭제에 실패했습니다.' });
        }
        
        res.json({ message: '코멘트가 삭제되었습니다.', id: deletedComment.id });
    } catch (error) {
        console.error('[API] 운동 코멘트 삭제 오류:', error);
        res.status(500).json({ message: error.message || '운동 코멘트 삭제 중 오류가 발생했습니다.' });
    }
});

// 식단 코멘트 수정
app.patch('/api/diet-records/:id/comments/:comment_id', async (req, res) => {
    try {
        const { id, comment_id } = req.params;
        const { commenter_type, commenter_id, comment_text } = req.body;
        
        if (!commenter_type || !commenter_id || !comment_text) {
            return res.status(400).json({ message: '코멘트 작성자 타입, ID, 코멘트 내용이 필요합니다.' });
        }
        
        const updates = { comment_text };
        const comment = await dietRecordsDB.updateDietComment(comment_id, commenter_id, commenter_type, updates);
        
        if (!comment) {
            return res.status(404).json({ message: '코멘트를 찾을 수 없습니다.' });
        }
        
        res.json(comment);
    } catch (error) {
        console.error('[API] 식단 코멘트 수정 오류:', error);
        res.status(500).json({ message: '식단 코멘트 수정 중 오류가 발생했습니다.' });
    }
});

// 식단 코멘트 삭제
app.delete('/api/diet-records/:id/comments/:comment_id', async (req, res) => {
    try {
        const { comment_id } = req.params;
        const { commenter_type, commenter_id } = req.query;
        
        if (!commenter_type || !commenter_id) {
            return res.status(400).json({ message: '코멘트 작성자 타입과 ID가 필요합니다.' });
        }
        
        const deleted = await dietRecordsDB.deleteDietComment(comment_id, commenter_id, commenter_type);
        
        if (!deleted) {
            return res.status(404).json({ message: '코멘트를 찾을 수 없습니다.' });
        }
        
        res.json({ message: '코멘트가 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 식단 코멘트 삭제 오류:', error);
        res.status(500).json({ message: '식단 코멘트 삭제 중 오류가 발생했습니다.' });
    }
});


// ========== 운동종류 API ==========

// 분류 목록 조회
app.get('/api/workout-categories/:categoryNumber', async (req, res) => {
    try {
        const { categoryNumber } = req.params;
        const num = parseInt(categoryNumber);
        
        if (num < 1 || num > 4) {
            return res.status(400).json({ message: '분류 번호는 1~4 사이여야 합니다.' });
        }
        
        const categories = await workoutTypesDB.getCategories(num);
        res.json(categories);
    } catch (error) {
        console.error('[API] 분류 조회 오류:', error);
        res.status(500).json({ message: '분류 조회 중 오류가 발생했습니다.' });
    }
});

// 분류 추가
app.post('/api/workout-categories/:categoryNumber', async (req, res) => {
    try {
        const { categoryNumber } = req.params;
        const { name } = req.body;
        const num = parseInt(categoryNumber);
        
        if (num < 1 || num > 4) {
            return res.status(400).json({ message: '분류 번호는 1~4 사이여야 합니다.' });
        }
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: '분류 이름이 필요합니다.' });
        }
        
        const category = await workoutTypesDB.addCategory(num, name.trim());
        res.status(201).json(category);
    } catch (error) {
        console.error('[API] 분류 추가 오류:', error);
        if (error.code === '23505') { // UNIQUE constraint violation
            res.status(400).json({ message: '이미 존재하는 분류 이름입니다.' });
        } else {
            res.status(500).json({ message: '분류 추가 중 오류가 발생했습니다.' });
        }
    }
});

// 분류 수정
app.patch('/api/workout-categories/:categoryNumber/:id', async (req, res) => {
    try {
        const { categoryNumber, id } = req.params;
        const { name } = req.body;
        const num = parseInt(categoryNumber);
        
        if (num < 1 || num > 4) {
            return res.status(400).json({ message: '분류 번호는 1~4 사이여야 합니다.' });
        }
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: '분류 이름이 필요합니다.' });
        }
        
        const category = await workoutTypesDB.updateCategory(num, id, name.trim());
        res.json(category);
    } catch (error) {
        console.error('[API] 분류 수정 오류:', error);
        if (error.code === '23505') { // UNIQUE constraint violation
            res.status(400).json({ message: '이미 존재하는 분류 이름입니다.' });
        } else if (error.message === '분류를 찾을 수 없습니다.') {
            res.status(404).json({ message: '분류를 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '분류 수정 중 오류가 발생했습니다.' });
        }
    }
});

// 분류 삭제
app.delete('/api/workout-categories/:categoryNumber/:id', async (req, res) => {
    try {
        const { categoryNumber, id } = req.params;
        const num = parseInt(categoryNumber);
        
        if (num < 1 || num > 4) {
            return res.status(400).json({ message: '분류 번호는 1~4 사이여야 합니다.' });
        }
        
        const category = await workoutTypesDB.deleteCategory(num, id);
        res.json({ message: '분류가 삭제되었습니다.', category });
    } catch (error) {
        console.error('[API] 분류 삭제 오류:', error);
        if (error.message === '분류를 찾을 수 없습니다.') {
            res.status(404).json({ message: '분류를 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '분류 삭제 중 오류가 발생했습니다.' });
        }
    }
});

// 운동종류 목록 조회
app.get('/api/workout-types', async (req, res) => {
    try {
        const filters = {};
        if (req.query.category_1_id) filters.category_1_id = req.query.category_1_id;
        if (req.query.category_2_id) filters.category_2_id = req.query.category_2_id;
        if (req.query.category_3_id) filters.category_3_id = req.query.category_3_id;
        if (req.query.category_4_id) filters.category_4_id = req.query.category_4_id;
        if (req.query.name) filters.name = req.query.name;
        
        const workoutTypes = await workoutTypesDB.getWorkoutTypes(filters);
        res.json(workoutTypes);
    } catch (error) {
        console.error('[API] 운동종류 조회 오류:', error);
        res.status(500).json({ message: '운동종류 조회 중 오류가 발생했습니다.' });
    }
});

// 운동종류 단일 조회
app.get('/api/workout-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workoutType = await workoutTypesDB.getWorkoutTypeById(id);
        
        if (!workoutType) {
            return res.status(404).json({ message: '운동종류를 찾을 수 없습니다.' });
        }
        
        res.json(workoutType);
    } catch (error) {
        console.error('[API] 운동종류 단일 조회 오류:', error);
        res.status(500).json({ message: '운동종류 조회 중 오류가 발생했습니다.' });
    }
});

// 운동종류 추가
app.post('/api/workout-types', async (req, res) => {
    try {
        const { name, type, category_1_id, category_2_id, category_3_id, category_4_id } = req.body;
        
        if (!name || !name.trim()) {
            return res.status(400).json({ message: '운동 이름이 필요합니다.' });
        }
        
        if (type && !['세트', '시간'].includes(type)) {
            return res.status(400).json({ message: '타입은 "세트" 또는 "시간"이어야 합니다.' });
        }
        
        const workoutType = await workoutTypesDB.addWorkoutType({
            name: name.trim(),
            type: type || '세트',
            category_1_id: category_1_id || null,
            category_2_id: category_2_id || null,
            category_3_id: category_3_id || null,
            category_4_id: category_4_id || null
        });
        
        res.status(201).json(workoutType);
    } catch (error) {
        console.error('[API] 운동종류 추가 오류:', error);
        if (error.code === '23505') { // UNIQUE constraint violation
            res.status(400).json({ message: '이미 존재하는 운동 이름입니다.' });
        } else {
            res.status(500).json({ message: '운동종류 추가 중 오류가 발생했습니다.' });
        }
    }
});

// 운동종류 수정
app.patch('/api/workout-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, type, category_1_id, category_2_id, category_3_id, category_4_id } = req.body;
        
        if (type && !['세트', '시간'].includes(type)) {
            return res.status(400).json({ message: '타입은 "세트" 또는 "시간"이어야 합니다.' });
        }
        
        const updates = {};
        if (name !== undefined) updates.name = name.trim();
        if (type !== undefined) updates.type = type;
        if (category_1_id !== undefined) updates.category_1_id = category_1_id || null;
        if (category_2_id !== undefined) updates.category_2_id = category_2_id || null;
        if (category_3_id !== undefined) updates.category_3_id = category_3_id || null;
        if (category_4_id !== undefined) updates.category_4_id = category_4_id || null;
        
        const workoutType = await workoutTypesDB.updateWorkoutType(id, updates);
        res.json(workoutType);
    } catch (error) {
        console.error('[API] 운동종류 수정 오류:', error);
        if (error.code === '23505') { // UNIQUE constraint violation
            res.status(400).json({ message: '이미 존재하는 운동 이름입니다.' });
        } else if (error.message === '운동종류를 찾을 수 없습니다.') {
            res.status(404).json({ message: '운동종류를 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '운동종류 수정 중 오류가 발생했습니다.' });
        }
    }
});

// ========== 즐겨찾기 운동 API ==========

// 즐겨찾기 운동 목록 조회
app.get('/api/favorite-workouts', async (req, res) => {
    try {
        const { app_user_id } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        const favorites = await favoriteWorkoutsDB.getFavoriteWorkouts(app_user_id);
        res.json(favorites);
    } catch (error) {
        console.error('[API] 즐겨찾기 운동 목록 조회 오류:', error);
        res.status(500).json({ message: '즐겨찾기 운동 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 즐겨찾기 운동 여부 확인
app.get('/api/favorite-workouts/check', async (req, res) => {
    try {
        const { app_user_id, workout_type_id } = req.query;
        
        if (!app_user_id || !workout_type_id) {
            return res.status(400).json({ message: '앱 유저 ID와 운동 종류 ID가 필요합니다.' });
        }
        
        const isFavorite = await favoriteWorkoutsDB.isFavoriteWorkout(app_user_id, workout_type_id);
        res.json({ isFavorite });
    } catch (error) {
        console.error('[API] 즐겨찾기 여부 확인 오류:', error);
        res.status(500).json({ message: '즐겨찾기 여부 확인 중 오류가 발생했습니다.' });
    }
});

// 즐겨찾기 운동 추가
app.post('/api/favorite-workouts', async (req, res) => {
    try {
        const { app_user_id, workout_type_id } = req.body;
        
        if (!app_user_id || !workout_type_id) {
            return res.status(400).json({ message: '앱 유저 ID와 운동 종류 ID가 필요합니다.' });
        }
        
        const favorite = await favoriteWorkoutsDB.addFavoriteWorkout(app_user_id, workout_type_id);
        res.status(201).json(favorite);
    } catch (error) {
        console.error('[API] 즐겨찾기 운동 추가 오류:', error);
        if (error.message === '이미 즐겨찾기에 추가된 운동입니다.') {
            res.status(400).json({ message: error.message });
        } else {
            res.status(500).json({ message: '즐겨찾기 운동 추가 중 오류가 발생했습니다.' });
        }
    }
});

// 즐겨찾기 운동 삭제
app.delete('/api/favorite-workouts', async (req, res) => {
    try {
        const { app_user_id, workout_type_id } = req.query;
        
        if (!app_user_id || !workout_type_id) {
            return res.status(400).json({ message: '앱 유저 ID와 운동 종류 ID가 필요합니다.' });
        }
        
        await favoriteWorkoutsDB.removeFavoriteWorkout(app_user_id, workout_type_id);
        res.json({ message: '즐겨찾기가 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 즐겨찾기 운동 삭제 오류:', error);
        if (error.message === '즐겨찾기를 찾을 수 없습니다.') {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: '즐겨찾기 운동 삭제 중 오류가 발생했습니다.' });
        }
    }
});

// ========== 사용자 설정 API ==========

// 사용자 설정 조회
app.get('/api/user-settings', async (req, res) => {
    try {
        const { app_user_id } = req.query;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        const settings = await userSettingsDB.getUserSettings(app_user_id);
        res.json(settings);
    } catch (error) {
        console.error('[API] 사용자 설정 조회 오류:', error);
        res.status(500).json({ message: '사용자 설정 조회 중 오류가 발생했습니다.' });
    }
});

// 사용자 설정 업데이트
app.patch('/api/user-settings', async (req, res) => {
    try {
        const { app_user_id, ...updates } = req.body;
        
        if (!app_user_id) {
            return res.status(400).json({ message: '앱 유저 ID가 필요합니다.' });
        }
        
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({ message: '수정할 설정이 없습니다.' });
        }
        
        const result = await userSettingsDB.updateUserSettings(app_user_id, updates);
        res.json({ message: '사용자 설정이 업데이트되었습니다.', settings: result });
    } catch (error) {
        console.error('[API] 사용자 설정 업데이트 오류:', error);
        res.status(500).json({ message: '사용자 설정 업데이트 중 오류가 발생했습니다.' });
    }
});

// 운동종류 삭제
app.delete('/api/workout-types/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const workoutType = await workoutTypesDB.deleteWorkoutType(id);
        res.json({ message: '운동종류가 삭제되었습니다.', workoutType });
    } catch (error) {
        console.error('[API] 운동종류 삭제 오류:', error);
        if (error.message === '운동종류를 찾을 수 없습니다.') {
            res.status(404).json({ message: '운동종류를 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '운동종류 삭제 중 오류가 발생했습니다.' });
        }
    }
});

// 트레이너 리스트 API
app.get('/api/trainers', (req, res) => {
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    
    // 특정 트레이너 username으로 조회 (성능 최적화)
    if (req.query.username) {
        const trainer = accounts.find(acc => acc.role === 'trainer' && acc.username === req.query.username);
        if (trainer) {
            return res.json([{
                username: trainer.username,
                name: trainer.name || trainer.username,
                role: trainer.role,
                vip_member: trainer.vip_member || false,
                '30min_session': trainer['30min_session'] || 'off',
                default_view_mode: trainer.default_view_mode || 'week',
                probation: trainer.probation || 'off',
                ledger: trainer.ledger || 'off',
                profile_image_url: trainer.profile_image_url || null
            }]);
        } else {
            return res.json([]);
        }
    }
    
    const trainers = accounts.filter(acc => acc.role === 'trainer')
        .map(({ username, name, role, vip_member, '30min_session': thirtyMinSession, default_view_mode, probation, ledger, profile_image_url }) => ({ 
            username, 
            name, 
            role, 
            vip_member: vip_member || false,  // 기본값: VIP 기능 사용 안함
            '30min_session': thirtyMinSession || 'off',  // 기본값: 30분 세션 기능 사용 안함
            default_view_mode: default_view_mode || 'week',  // 기본값: 주간보기
            probation: probation || 'off',  // 기본값: 수습 아님
            ledger: ledger || 'off',  // 기본값: 장부 기능 사용 안함
            profile_image_url: profile_image_url || null
        }));
    res.json(trainers);
});

// 트레이너 삭제 API
app.delete('/api/trainers/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const { currentUser } = req.body; // 현재 로그인한 사용자 정보
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자만 트레이너를 삭제할 수 있습니다.' });
        }
        
        // 트레이너가 담당 회원이 있는지 확인
        const members = await membersDB.getMembers();
        const hasMembers = members.some(member => member.trainer === username);
        
        if (hasMembers) {
            return res.status(400).json({ message: '담당 회원이 있는 트레이너는 삭제할 수 없습니다.' });
        }
        
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        if (trainerIndex === -1) {
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        accounts.splice(trainerIndex, 1);
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({ message: '트레이너가 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 트레이너 삭제 오류:', error);
        res.status(500).json({ message: '트레이너 삭제에 실패했습니다.' });
    }
});

// 트레이너 VIP 기능 설정 수정 API
app.patch('/api/trainers/:username', async (req, res) => {
    try {
        const username = req.params.username;
        const { vip_member, '30min_session': thirtyMinSession, default_view_mode, probation, ledger, currentUser } = req.body;
        
        // 권한 확인: 관리자이거나 본인인 경우만 허용
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        const isAdmin = isAdminOrSu(currentUserAccount);
        const isSelf = currentUser === username;
        
        // 관리자가 아니고 본인도 아닌 경우 거부
        if (!isAdmin && !isSelf) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 본인이 변경하는 경우, 본인이 트레이너인지 확인
        if (isSelf && currentUserAccount && currentUserAccount.role !== 'trainer') {
            return res.status(403).json({ message: '트레이너만 자신의 옵션을 변경할 수 있습니다.' });
        }
        
        // 트레이너 찾기
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        if (trainerIndex === -1) {
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        // VIP 기능 설정 업데이트
        if (vip_member !== undefined) {
            accounts[trainerIndex].vip_member = Boolean(vip_member);
        }
        
        // 30분 세션 기능 설정 업데이트
        if (thirtyMinSession !== undefined) {
            if (!['on', 'off'].includes(thirtyMinSession)) {
                return res.status(400).json({ message: '30분 세션 설정은 "on" 또는 "off"만 가능합니다.' });
            }
            accounts[trainerIndex]['30min_session'] = thirtyMinSession;
        }
        
        // 기본 뷰 모드 설정 업데이트
        if (default_view_mode !== undefined) {
            if (!['week', 'month'].includes(default_view_mode)) {
                return res.status(400).json({ message: '기본 뷰 모드는 "week" 또는 "month"만 가능합니다.' });
            }
            accounts[trainerIndex].default_view_mode = default_view_mode;
        }
        
        // 수습 여부 설정 업데이트 (SU만 가능)
        if (probation !== undefined) {
            // SU 권한 확인
            if (currentUserAccount && currentUserAccount.role !== 'su') {
                return res.status(403).json({ message: '수습 여부 설정은 SU 권한이 필요합니다.' });
            }
            if (!['on', 'off'].includes(probation)) {
                return res.status(400).json({ message: '수습 여부는 "on" 또는 "off"만 가능합니다.' });
            }
            accounts[trainerIndex].probation = probation;
        }
        
        // 장부 기능 설정 업데이트 (SU만 가능)
        if (ledger !== undefined) {
            // SU 권한 확인
            if (currentUserAccount && currentUserAccount.role !== 'su') {
                return res.status(403).json({ message: '장부 기능 설정은 SU 권한이 필요합니다.' });
            }
            if (!['on', 'off'].includes(ledger)) {
                return res.status(400).json({ message: '장부 기능은 "on" 또는 "off"만 가능합니다.' });
            }
            accounts[trainerIndex].ledger = ledger;
        }
        
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({ 
            message: '트레이너 설정이 업데이트되었습니다.',
            trainer: {
                username: accounts[trainerIndex].username,
                name: accounts[trainerIndex].name,
                vip_member: accounts[trainerIndex].vip_member,
                '30min_session': accounts[trainerIndex]['30min_session'],
                default_view_mode: accounts[trainerIndex].default_view_mode || 'week',
                probation: accounts[trainerIndex].probation || 'off',
                ledger: accounts[trainerIndex].ledger || 'off'
            }
        });
    } catch (error) {
        console.error('[API] 트레이너 설정 수정 오류:', error);
        res.status(500).json({ message: '트레이너 설정 수정에 실패했습니다.' });
    }
});

// 트레이너 프로필 사진 업로드 API
app.post('/api/trainers/:username/profile-image', trainerProfileUpload.single('image'), async (req, res) => {
    try {
        const username = req.params.username;
        const currentUser = req.body.currentUser || req.session?.username;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        const trainerAccount = accounts.find(acc => acc.username === username && acc.role === 'trainer');
        
        if (!trainerAccount) {
            // 업로드된 파일이 있으면 삭제
            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                    const dir = path.dirname(req.file.path);
                    if (fs.existsSync(dir)) {
                        fs.rmSync(dir, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error('[API] 파일 삭제 오류:', e);
                }
            }
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        // 권한 확인: 관리자/SU 또는 본인
        if (!isAdminOrSu(currentUserAccount) && currentUser !== username) {
            // 업로드된 파일이 있으면 삭제
            if (req.file) {
                try {
                    fs.unlinkSync(req.file.path);
                    const dir = path.dirname(req.file.path);
                    if (fs.existsSync(dir)) {
                        fs.rmSync(dir, { recursive: true, force: true });
                    }
                } catch (e) {
                    console.error('[API] 파일 삭제 오류:', e);
                }
            }
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 파일 확인
        if (!req.file) {
            return res.status(400).json({ message: '이미지 파일을 선택해주세요.' });
        }
        
        // 기존 프로필 사진 삭제
        if (trainerAccount.profile_image_url) {
            try {
                // 상대 경로에서 앞의 '/' 제거
                const relativePath = trainerAccount.profile_image_url.startsWith('/') 
                    ? trainerAccount.profile_image_url.substring(1) 
                    : trainerAccount.profile_image_url;
                
                // UPLOADS_DIR 기준으로 경로 구성 (업로드 시와 동일한 방식)
                const oldImagePath = path.join(UPLOADS_DIR, relativePath.replace('uploads/', ''));
                
                if (fs.existsSync(oldImagePath)) {
                    // 디렉토리 전체 삭제
                    const oldDir = path.dirname(oldImagePath);
                    if (fs.existsSync(oldDir)) {
                        fs.rmSync(oldDir, { recursive: true, force: true });
                    }
                } else {
                    // 프로젝트 루트 기준으로도 시도 (이전 방식 호환성)
                    const fallbackPath = path.join(__dirname, '..', relativePath);
                    if (fs.existsSync(fallbackPath)) {
                        const oldDir = path.dirname(fallbackPath);
                        if (fs.existsSync(oldDir)) {
                            fs.rmSync(oldDir, { recursive: true, force: true });
                        }
                    }
                }
            } catch (error) {
                console.error('[API] 기존 프로필 사진 삭제 오류:', error);
                // 삭제 실패해도 계속 진행
            }
        }
        
        // 상대 경로 생성 (consultation-images와 동일한 방식)
        const { year, month, uuid } = req.trainerProfileDir;
        const fileName = req.file.filename;
        const relativePath = path.join('uploads', 'trainer-profiles', String(year), month, uuid, fileName).replace(/\\/g, '/');
        const relativePathWithSlash = `/${relativePath}`;
        
        // accounts.json 업데이트
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        accounts[trainerIndex].profile_image_url = relativePathWithSlash;
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({
            message: '프로필 사진이 업로드되었습니다.',
            profile_image_url: relativePathWithSlash
        });
    } catch (error) {
        console.error('[API] 프로필 사진 업로드 오류:', error);
        // 업로드된 파일이 있으면 삭제
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
                const dir = path.dirname(req.file.path);
                if (fs.existsSync(dir)) {
                    fs.rmSync(dir, { recursive: true, force: true });
                }
            } catch (e) {
                console.error('[API] 파일 삭제 오류:', e);
            }
        }
        res.status(500).json({ message: '프로필 사진 업로드에 실패했습니다.' });
    }
});

// 트레이너 프로필 사진 삭제 API
app.delete('/api/trainers/:username/profile-image', async (req, res) => {
    try {
        const username = req.params.username;
        const { currentUser } = req.body;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        const trainerAccount = accounts.find(acc => acc.username === username && acc.role === 'trainer');
        
        if (!trainerAccount) {
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        // 권한 확인: 관리자/SU 또는 본인
        if (!isAdminOrSu(currentUserAccount) && currentUser !== username) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 기존 프로필 사진 삭제
        if (trainerAccount.profile_image_url) {
            try {
                // 상대 경로에서 앞의 '/' 제거
                const relativePath = trainerAccount.profile_image_url.startsWith('/') 
                    ? trainerAccount.profile_image_url.substring(1) 
                    : trainerAccount.profile_image_url;
                
                // UPLOADS_DIR 기준으로 경로 구성 (업로드 시와 동일한 방식)
                const oldImagePath = path.join(UPLOADS_DIR, relativePath.replace('uploads/', ''));
                
                if (fs.existsSync(oldImagePath)) {
                    // 디렉토리 전체 삭제
                    const oldDir = path.dirname(oldImagePath);
                    if (fs.existsSync(oldDir)) {
                        fs.rmSync(oldDir, { recursive: true, force: true });
                    }
                } else {
                    // 프로젝트 루트 기준으로도 시도 (이전 방식 호환성)
                    const fallbackPath = path.join(__dirname, '..', relativePath);
                    if (fs.existsSync(fallbackPath)) {
                        const oldDir = path.dirname(fallbackPath);
                        if (fs.existsSync(oldDir)) {
                            fs.rmSync(oldDir, { recursive: true, force: true });
                        }
                    }
                }
            } catch (error) {
                console.error('[API] 프로필 사진 삭제 오류:', error);
                // 삭제 실패해도 계속 진행
            }
        }
        
        // accounts.json에서 profile_image_url 제거
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        delete accounts[trainerIndex].profile_image_url;
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({ message: '프로필 사진이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 프로필 사진 삭제 오류:', error);
        res.status(500).json({ message: '프로필 사진 삭제에 실패했습니다.' });
    }
});

// 관리자 계정 존재 여부 확인 API
app.get('/api/admin-exists', (req, res) => {
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    const exists = accounts.some(acc => acc.role === 'admin' || acc.role === 'su');
    res.json({ exists });
});

// 센터 목록 조회
app.get('/api/centers', (req, res) => {
    let centers = [];
    if (fs.existsSync(CENTERS_PATH)) {
        const raw = fs.readFileSync(CENTERS_PATH, 'utf-8');
        if (raw) centers = JSON.parse(raw);
    }
    res.json(centers);
});
// 센터 추가
app.post('/api/centers', (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: '센터 이름을 입력해주세요.' });
    }
    let centers = [];
    if (fs.existsSync(CENTERS_PATH)) {
        const raw = fs.readFileSync(CENTERS_PATH, 'utf-8');
        if (raw) centers = JSON.parse(raw);
    }
    if (centers.find(c => c.name === name.trim())) {
        return res.status(409).json({ message: '이미 존재하는 센터 이름입니다.' });
    }
    const newCenter = { name: name.trim() };
    centers.push(newCenter);
    fs.writeFileSync(CENTERS_PATH, JSON.stringify(centers, null, 2));
    res.json({ message: '센터가 추가되었습니다.', center: newCenter });
});

// 센터 이름 변경 (이름 기반 참조 전역 갱신)
app.put('/api/centers/:name', async (req, res) => {
    try {
        const oldName = decodeURIComponent(req.params.name);
        const { newName } = req.body || {};
        if (!oldName) {
            return res.status(400).json({ message: '기존 센터 이름이 필요합니다.' });
        }
        if (!newName || typeof newName !== 'string' || !newName.trim()) {
            return res.status(400).json({ message: '새 센터 이름을 입력해주세요.' });
        }

        // 1) centers.json 검증 및 중복 확인
        let centers = [];
        if (fs.existsSync(CENTERS_PATH)) {
            const raw = fs.readFileSync(CENTERS_PATH, 'utf-8');
            if (raw) centers = JSON.parse(raw);
        }
        const idx = centers.findIndex(c => c.name === oldName);
        if (idx === -1) {
            return res.status(404).json({ message: '센터를 찾을 수 없습니다.' });
        }
        if (centers.some(c => c.name === newName.trim())) {
            return res.status(409).json({ message: '이미 존재하는 센터 이름입니다.' });
        }

        // 2) DB 업데이트 (members, registration_logs)
        await membersDB.renameCenter(oldName, newName.trim());
        await registrationLogsDB.renameCenterInLogs(oldName, newName.trim());

        // 3) accounts.json 업데이트 (role=center 의 center 필드)
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        let accountsChanged = false;
        accounts.forEach(acc => {
            if (acc.role === 'center' && acc.center === oldName) {
                acc.center = newName.trim();
                accountsChanged = true;
            }
        });
        if (accountsChanged) {
            fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        }

        // 4) centers.json 이름 변경
        centers[idx].name = newName.trim();
        fs.writeFileSync(CENTERS_PATH, JSON.stringify(centers, null, 2));

        res.json({ message: '센터 이름이 변경되었습니다.', center: { name: newName.trim() } });
    } catch (error) {
        console.error('[API] 센터 이름 변경 오류:', error);
        res.status(500).json({ message: '센터 이름 변경에 실패했습니다.' });
    }
});

// 센터 삭제
app.delete('/api/centers/:name', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        if (!name) {
            return res.status(400).json({ message: '센터 이름이 필요합니다.' });
        }
        
        // 센터에 회원이 있는지 확인
        const members = await membersDB.getMembers();
        const hasMembers = members.some(member => member.center === name);
        
        if (hasMembers) {
            return res.status(400).json({ message: '해당 센터에 등록된 회원이 있어 삭제할 수 없습니다.' });
        }
        
        let centers = [];
        if (fs.existsSync(CENTERS_PATH)) {
            const raw = fs.readFileSync(CENTERS_PATH, 'utf-8');
            if (raw) centers = JSON.parse(raw);
        }
        const idx = centers.findIndex(c => c.name === name);
        if (idx === -1) {
            return res.status(404).json({ message: '센터를 찾을 수 없습니다.' });
        }
        centers.splice(idx, 1);
        fs.writeFileSync(CENTERS_PATH, JSON.stringify(centers, null, 2));
        res.json({ message: '센터가 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 센터 삭제 오류:', error);
        res.status(500).json({ message: '센터 삭제에 실패했습니다.' });
    }
});

// 회원 목록 조회
app.get('/api/members', async (req, res) => {
    try {
        const filters = {};
        if (req.query.trainer) filters.trainer = req.query.trainer;
        if (req.query.status) filters.status = req.query.status;
        if (req.query.name) {
            // 특정 회원 이름으로 조회 (성능 최적화)
            const member = await membersDB.getMemberByName(req.query.name);
            return res.json(member ? [member] : []);
        }
        
        const members = await membersDB.getMembers(filters);
        res.json(members);
    } catch (error) {
        console.error('[API] 회원 조회 오류:', error);
        res.status(500).json({ message: '회원 목록을 불러오지 못했습니다.' });
    }
});
// 회원 추가
app.post('/api/members', async (req, res) => {
    try {
        const { name, gender, phone, trainer, center, regdate, sessions } = req.body;
        if (!name || !gender || !phone || !trainer || !center || !regdate || sessions === undefined) {
            return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
        }
        
        const numSessions = Number(sessions);
        const newMember = {
            name,
            gender,
            phone,
            trainer,
            center,
            regdate,
            sessions: numSessions,
            remainSessions: numSessions,
            status: '유효'
        };
        
        const member = await membersDB.addMember(newMember);
        
        // 신규 세션 통계 추가
        if (numSessions > 0) {
          await monthlyStatsDB.addNewSessions(numSessions);
          
                  // 신규등록 로그 저장
        await registrationLogsDB.addLog({
          member_name: name,
          registration_type: '신규등록',
          session_count: numSessions,
          center: center,
          trainer: trainer,
          registration_date: regdate
        });
        }
        
        res.json({ message: '회원이 추가되었습니다.', member });
    } catch (error) {
        console.error('[API] 회원 추가 오류:', error);
        if (error.code === '23505') { // UNIQUE constraint violation
            res.status(409).json({ message: '이미 등록된 이름입니다.' });
        } else {
            res.status(500).json({ message: '회원 추가에 실패했습니다.' });
        }
    }
});

// 회원 목록 CSV 다운로드
app.post('/api/members/export', async (req, res) => {
    try {
        const { members } = req.body; // 프론트엔드에서 전송한 회원 목록
        
        if (!members || !Array.isArray(members)) {
            return res.status(400).json({ message: '회원 목록이 필요합니다.' });
        }
        
        // 트레이너 정보 가져오기
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const trainers = accounts.filter(acc => acc.role === 'trainer')
            .map(({ username, name }) => ({ username, name }));
        const trainerMap = {};
        trainers.forEach(t => { trainerMap[t.username] = t.name; });
        
        // BOM 추가 (한글 깨짐 방지)
        const BOM = '\uFEFF';
        
        // CSV 헤더
        let csv = BOM + '이름,성별,전화번호,담당 트레이너,센터,등록일,세션 수,잔여세션,상태\n';
        
        // CSV 데이터
        members.forEach(member => {
            const gender = member.gender === 'male' ? '남성' : member.gender === 'female' ? '여성' : '';
            const trainerName = trainerMap[member.trainer] || member.trainer;
            const remainSessions = member.remainSessions !== undefined ? member.remainSessions : '';
            
            // 전화번호 앞에 = 추가하여 텍스트로 강제 변환 (엑셀에서 0이 사라지는 것 방지)
            const phoneForExcel = `="${member.phone}"`;
            
            csv += `"${member.name}","${gender}",${phoneForExcel},"${trainerName}","${member.center}","${member.regdate}",${member.sessions},${remainSessions},"${member.status || ''}"\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="members.csv"');
        res.send(csv);
    } catch (error) {
        console.error('[API] 회원 목록 내보내기 오류:', error);
        res.status(500).json({ message: '회원 목록 내보내기에 실패했습니다.' });
    }
});

// 회원 정보 수정 (상태, 담당 트레이너, 세션수/잔여세션 추가, 성별, 센터, 전화번호, VIP 세션)
app.patch('/api/members/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const { status, trainer, addSessions, gender, center, phone, vipSession, currentUser } = req.body; // addSessions: 추가할 세션 수(숫자)
        
        // 센터관리자 권한 확인 및 센터 제한
        let userRole = null;
        let userCenter = null;
        if (currentUser) {
            let accounts = [];
            if (fs.existsSync(DATA_PATH)) {
                const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                if (raw) accounts = JSON.parse(raw);
            }
            const userAccount = accounts.find(acc => acc.username === currentUser);
            if (userAccount) {
                userRole = userAccount.role;
                userCenter = userAccount.center;
            }
        }
        
        const updates = {};
        if (status) updates.status = status;
        if (trainer) updates.trainer = trainer;
        if (gender) updates.gender = gender;
        
        // 센터관리자인 경우 센터 변경 제한
        if (userRole === 'center' && userCenter) {
            // 센터관리자는 자신의 센터로만 설정 가능
            updates.center = userCenter;
        } else if (center) {
            // 관리자나 트레이너는 센터 변경 가능
            updates.center = center;
        }
        
        if (phone !== undefined) updates.phone = phone; // 빈 문자열도 허용
        if (addSessions && !isNaN(Number(addSessions))) {
            updates.addSessions = Number(addSessions);
        }
        if (vipSession !== undefined && !isNaN(Number(vipSession))) {
            updates.vipSession = Number(vipSession);
        }
        
        const member = await membersDB.updateMember(name, updates);
        
        // 재등록 세션 통계 추가
        if (addSessions && !isNaN(Number(addSessions)) && Number(addSessions) !== 0) {
          await monthlyStatsDB.addReRegistrationSessions(Number(addSessions));
        }
        
        // 재등록 로그 저장 (세션 변경이 있는 경우)
        if (addSessions && !isNaN(Number(addSessions)) && Number(addSessions) !== 0) {
          await registrationLogsDB.addLog({
            member_name: name,
            registration_type: '재등록',
            session_count: Number(addSessions),
            center: member.center,
            trainer: member.trainer,
            registration_date: getKoreanDate()
          });
        }
        
        res.json({ message: '회원 정보가 수정되었습니다.', member });
    } catch (error) {
        console.error('[API] 회원 수정 오류:', error);
        if (error.message === '회원을 찾을 수 없습니다.') {
            res.status(404).json({ message: '회원을 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '회원 정보 수정에 실패했습니다.' });
        }
    }
});

// 회원 삭제
app.delete('/api/members/:name', async (req, res) => {
    try {
        const name = decodeURIComponent(req.params.name);
        if (!name) {
            return res.status(400).json({ message: '회원 이름이 필요합니다.' });
        }
        
        // 회원 삭제
        await membersDB.deleteMember(name);
        
        // 해당 회원의 모든 세션 삭제
        await sessionsDB.deleteSessionsByMember(name);
        
        res.json({ message: '회원이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 회원 삭제 오류:', error);
        if (error.message === '회원을 찾을 수 없습니다.') {
            res.status(404).json({ message: '회원을 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '회원 삭제에 실패했습니다.' });
        }
    }
});

// 세션 목록 조회 (트레이너, 날짜별, 주간 필터, 날짜 범위)
app.get('/api/sessions', async (req, res) => {
    try {
        const { trainer, date, week, startDate, endDate, member } = req.query;
        
        // 날짜 범위가 있으면 날짜 범위로 조회
        if (startDate && endDate) {
            let sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
            
            // 추가 필터링
            if (trainer) {
                sessions = sessions.filter(s => s.trainer === trainer);
            }
            if (member) {
                sessions = sessions.filter(s => s.member === member);
            }
            
            res.json(sessions);
            return;
        }
        
        // 기존 필터 방식
        const filters = {};
        if (trainer) filters.trainer = trainer;
        if (date) filters.date = date;
        if (week) filters.week = week;
        
        const sessions = await sessionsDB.getSessions(filters);
        res.json(sessions);
    } catch (error) {
        console.error('[API] 세션 조회 오류:', error);
        res.status(500).json({ message: '세션 목록을 불러오지 못했습니다.' });
    }
});

// 단일 세션 조회
app.get('/api/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const session = await sessionsDB.getSessionById(id);
        
        if (!session) {
            return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
        }
        
        res.json(session);
    } catch (error) {
        console.error('[API] 세션 조회 오류:', error);
        res.status(500).json({ message: '세션 조회 중 오류가 발생했습니다.' });
    }
});

// 세션 추가
app.post('/api/sessions', async (req, res) => {
    try {
        const { member, trainer, date, time, repeat, repeatCount } = req.body;
        if (!member || !trainer || !date || !time) {
            return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
        }
        
        // 반복 세션 처리
        if (repeat && repeatCount && parseInt(repeatCount) > 1) {
            const sessions = [];
            const count = parseInt(repeatCount);
            
            for (let i = 0; i < count; i++) {
                const sessionDate = new Date(date);
                sessionDate.setDate(sessionDate.getDate() + (i * 7)); // 7일씩 증가
                
                // 시간 중복 체크
                const hasConflict = await sessionsDB.checkTimeConflict(
                    trainer, 
                    sessionDate.toISOString().split('T')[0], 
                    time,
                    req.body['30min'] || false
                );
                
                if (!hasConflict) {
                    sessions.push({
                        id: uuidv4(),
                        member,
                        trainer,
                        date: sessionDate.toISOString().split('T')[0],
                        time,
                        status: '예정',
                        '30min': req.body['30min'] || false
                    });
                }
            }
            
            if (sessions.length === 0) {
                return res.status(400).json({ message: '모든 날짜에 시간 중복이 있습니다.' });
            }
            
            const addedSessions = await sessionsDB.addMultipleSessions(sessions);
            const skipped = count - sessions.length;
            
            // 무기명/체험 세션이면 trial DB에 자동 등록
            for (const addedSession of addedSessions) {
              await syncTrialWithSession(addedSession, 'create');
            }
            
            res.json({ 
                message: '세션이 추가되었습니다.', 
                session: addedSessions[0],
                total: count,
                added: sessions.length,
                skipped: skipped
            });
        } else {
            // 단일 세션 추가
            const newSession = {
                id: uuidv4(),
                member,
                trainer,
                date,
                time,
                status: '예정',
                '30min': req.body['30min'] || false
            };
            
            const session = await sessionsDB.addSession(newSession);
            
            // 무기명/체험 세션이면 trial DB에 자동 등록
            await syncTrialWithSession(session, 'create');
            
            res.json({ message: '세션이 추가되었습니다.', session });
        }
    } catch (error) {
        console.error('[API] 세션 추가 오류:', error);
        res.status(500).json({ message: '세션 추가에 실패했습니다.' });
    }
});

// 세션 출석(완료) 처리 및 회원 잔여세션 감소
app.patch('/api/sessions/:id/attend', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await sessionsDB.getSessionById(sessionId);
        if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
        if (session.status === '완료') return res.status(400).json({ message: '이미 완료된 세션입니다.' });
        
        // 세션 상태를 완료로 변경
        const updatedSession = await sessionsDB.updateSession(sessionId, { status: '완료' });
        
        // 회원 잔여세션 감소 (PostgreSQL)
        await membersDB.decrementRemainSessions(session.member);
        
        res.json({ message: '출석 처리되었습니다.', session: updatedSession });
    } catch (error) {
        console.error('[API] 출석 처리 오류:', error);
        res.status(500).json({ message: '출석 처리에 실패했습니다.' });
    }
});

// 세션 변경(날짜, 시간)
app.patch('/api/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const { date, time } = req.body;
        if (!date || !time) return res.status(400).json({ message: '날짜와 시간을 입력해주세요.' });
        
        const session = await sessionsDB.getSessionById(sessionId);
        if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
        
        const wasTrialSession = isTrialSession(session.member);
        
        const updatedSession = await sessionsDB.updateSession(sessionId, { date, time });
        
        // 무기명/체험 세션이면 trial DB도 업데이트
        if (isTrialSession(updatedSession.member)) {
          await syncTrialWithSession(updatedSession, 'update');
        } else if (wasTrialSession) {
          // 무기명/체험에서 일반으로 변경된 경우 trial 삭제
          await syncTrialWithSession(session, 'delete');
        }
        
        res.json({ message: '세션이 변경되었습니다.', session: updatedSession });
    } catch (error) {
        console.error('[API] 세션 변경 오류:', error);
        res.status(500).json({ message: '세션 변경에 실패했습니다.' });
    }
});
// 세션 삭제
app.delete('/api/sessions/:id', async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await sessionsDB.getSessionById(sessionId);
        if (!session) return res.status(404).json({ message: '세션을 찾을 수 없습니다.' });
        
        // 무기명/체험 세션이면 trial DB도 삭제
        if (isTrialSession(session.member)) {
          await syncTrialWithSession(session, 'delete');
        }
        
        await sessionsDB.deleteSession(sessionId);
        res.json({ message: '세션이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 세션 삭제 오류:', error);
        res.status(500).json({ message: '세션 삭제에 실패했습니다.' });
    }
});

// 비밀번호 변경 API
app.patch('/api/change-password', (req, res) => {
    const { username, currentPw, newPw } = req.body;
    if (!username || !currentPw || !newPw) {
        return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    const user = accounts.find(acc => acc.username === username);
    if (!user) {
        return res.status(404).json({ message: '계정을 찾을 수 없습니다.' });
    }
    if (user.password !== currentPw) {
        return res.status(401).json({ message: '현재 비밀번호가 올바르지 않습니다.' });
    }
    user.password = newPw;
    fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
    res.json({ message: '비밀번호가 변경되었습니다.' });
});

// 월별 통계 API
app.get('/api/monthly-stats', async (req, res) => {
    try {
        const { yearMonth } = req.query;
        const stats = await monthlyStatsDB.getMonthlyStats(yearMonth);
        res.json(stats);
    } catch (error) {
        console.error('[API] 월별 통계 조회 오류:', error);
        res.status(500).json({ message: '월별 통계 조회에 실패했습니다.' });
    }
});

// 전체 월별 통계 API (최근 12개월)
app.get('/api/monthly-stats/all', async (req, res) => {
    try {
        const stats = await monthlyStatsDB.getAllMonthlyStats();
        res.json(stats);
    } catch (error) {
        console.error('[API] 전체 월별 통계 조회 오류:', error);
        res.status(500).json({ message: '전체 월별 통계 조회에 실패했습니다.' });
    }
});

// 트레이너별 세션 조회 API
app.get('/api/trainer-sessions', async (req, res) => {
    try {
        const { trainer, yearMonth, status, member } = req.query;
        
        if (!trainer || !yearMonth) {
            return res.status(400).json({ message: '트레이너와 년월 정보가 필요합니다.' });
        }
        
        // 년월을 시작일과 종료일로 변환
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        // 해당 월의 마지막 날 계산 (한국시간 기준)
        const lastDay = new Date(year, month, 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        
        // 세션 데이터 조회
        const sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
        
        // 트레이너 필터링
        let filteredSessions = sessions.filter(session => session.trainer === trainer);
        
        // 추가 필터링
        if (status && status !== '전체') {
            filteredSessions = filteredSessions.filter(session => session.status === status);
        }
        
        if (member) {
            filteredSessions = filteredSessions.filter(session => 
                session.member.toLowerCase().includes(member.toLowerCase())
            );
        }
        
        // 세션 데이터 정리 (결석 자동 판단 포함) - 한국시간 기준
        const today = getKoreanToday();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD 형식
        
        const sessionsWithMemberInfo = filteredSessions.map(session => {
            let displayStatus = session.status;
            
            // 날짜가 지났고 완료되지 않은 세션은 결석으로 표시
            // session.date는 이미 YYYY-MM-DD 형식의 문자열
            if (session.status !== '완료' && session.date < todayStr) {
                displayStatus = '결석';
            }
            
            return {
                ...session,
                displayStatus
            };
        });
        
        // 날짜, 시간순 정렬 (최신순)
        sessionsWithMemberInfo.sort((a, b) => {
            // Date 객체를 직접 비교
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            
            // 날짜가 다르면 날짜로 비교
            if (dateA.getTime() !== dateB.getTime()) {
                return dateB.getTime() - dateA.getTime(); // 최신순
            }
            
            // 날짜가 같으면 시간으로 비교
            const timeA = String(a.time);
            const timeB = String(b.time);
            return timeB.localeCompare(timeA); // 최신순
        });
        
        // 요약 정보 계산
        const completedSessions = sessionsWithMemberInfo.filter(s => s.displayStatus === '완료');
        const trialOrAnonymousSessions = completedSessions.filter(s => 
            s.member.startsWith('체험') || s.member.startsWith('무기명')
        );
        
        const summary = {
            totalSessions: sessionsWithMemberInfo.length,
            completedSessions: completedSessions.length,
            completedTrialOrAnonymous: trialOrAnonymousSessions.length,
            pendingSessions: sessionsWithMemberInfo.filter(s => s.displayStatus === '예정').length,
            absentSessions: sessionsWithMemberInfo.filter(s => s.displayStatus === '결석').length
        };
        
        res.json({
            sessions: sessionsWithMemberInfo,
            summary,
            trainer,
            yearMonth
        });
    } catch (error) {
        console.error('[API] 트레이너 세션 조회 오류:', error);
        res.status(500).json({ message: '트레이너 세션 조회에 실패했습니다.' });
    }
});

// 통계 API
app.get('/api/stats', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    
    if (!period || !startDate || !endDate) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }
    
    // 세션 데이터와 트레이너 데이터 조회
    const sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
    
    // 회원 데이터 조회 (담당 회원 수 계산용)
    const members = await membersDB.getMembers();
    
    // 트레이너 데이터 직접 읽기
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    const trainers = accounts.filter(acc => acc.role === 'trainer')
      .map(({ username, name, role }) => ({ username, name, role }));
    
    // 트레이너 ID를 이름으로 매핑
    const trainerNameMap = {};
    trainers.forEach(trainer => {
      trainerNameMap[trainer.username] = trainer.name;
    });
    
    // 트레이너별 담당 회원 수 계산
    const trainerMemberCount = {};
    members.forEach(member => {
      if (member.status === '유효' && 
          !member.name.startsWith('무기명') && 
          !member.name.startsWith('체험')) { // 유효한 회원만 카운트 (무기명, 체험 제외)
        const trainerName = trainerNameMap[member.trainer] || member.trainer;
        trainerMemberCount[trainerName] = (trainerMemberCount[trainerName] || 0) + 1;
      }
    });
    
    // 통계 계산 - 한국시간 기준
    const today = getKoreanToday();
    const todayStr = getKoreanDate(); // YYYY-MM-DD 형식 (한국시간 기준)
    
    // 완료된 세션 중 체험/무기명 회원 필터링
    const completedSessions = sessions.filter(s => s.status === '완료');
    const trialOrAnonymousSessions = completedSessions.filter(s => 
        s.member.startsWith('체험') || s.member.startsWith('무기명')
    );
    
    // 전체 유효회원수 계산
    const totalValidMembers = members.filter(member => 
        member.status === '유효' && 
        !member.name.startsWith('무기명') && 
        !member.name.startsWith('체험')
    ).length;
    
    // 센터별 유효회원수 계산
    const centerValidMembers = {};
    // 전체 잔여세션수 계산
    let totalRemainingSessions = 0;
    // 센터별 잔여세션수 계산
    const centerRemainingSessions = {};
    
    members.forEach(member => {
        if (member.status === '유효' && 
            !member.name.startsWith('무기명') && 
            !member.name.startsWith('체험')) {
            const center = member.center;
            centerValidMembers[center] = (centerValidMembers[center] || 0) + 1;
            
            // 잔여세션수 계산
            const remainingSessions = member.remainSessions || 0;
            totalRemainingSessions += remainingSessions;
            centerRemainingSessions[center] = (centerRemainingSessions[center] || 0) + remainingSessions;
        }
    });
    
    // 센터별 세션 통계 계산
    const centerSessions = {
      total: {},
      completed: {},
      scheduled: {},
      absent: {}
    };
    
    // 회원별 센터 정보 매핑
    const memberCenterMap = {};
    members.forEach(member => {
      memberCenterMap[member.name] = member.center;
    });
    
    // 세션별로 센터 통계 계산
    sessions.forEach(session => {
      const center = memberCenterMap[session.member];
      if (center) {
        // 총 세션
        centerSessions.total[center] = (centerSessions.total[center] || 0) + 1;
        
        // session.date는 이미 YYYY-MM-DD 형식의 문자열
        if (session.status === '완료') {
          centerSessions.completed[center] = (centerSessions.completed[center] || 0) + 1;
        } else if (session.status === '예정' && session.date >= todayStr) {
          centerSessions.scheduled[center] = (centerSessions.scheduled[center] || 0) + 1;
        } else if (session.date < todayStr) {
          centerSessions.absent[center] = (centerSessions.absent[center] || 0) + 1;
        }
      }
    });
    
    const stats = {
      totalSessions: sessions.length,
      completedSessions: completedSessions.length,
      completedTrialOrAnonymous: trialOrAnonymousSessions.length,
      scheduledSessions: sessions.filter(s => {
        return s.status === '예정' && s.date >= todayStr; // 오늘 이후의 예정 세션만
      }).length,
      absentSessions: sessions.filter(s => {
        return s.status !== '완료' && s.date < todayStr; // 오늘 이전의 미완료 세션
      }).length,
      totalValidMembers: totalValidMembers,
      centerValidMembers: centerValidMembers,
      centerSessions: centerSessions,
      totalRemainingSessions: totalRemainingSessions,
      centerRemainingSessions: centerRemainingSessions,
      trainerStats: []
    };
    
    // 트레이너별 통계 계산
    const trainerMap = new Map();
    
    // 먼저 담당 회원이 있는 모든 트레이너를 추가
    Object.keys(trainerMemberCount).forEach(trainerName => {
      // 트레이너 이름으로 username 찾기
      const trainerAccount = trainers.find(t => t.name === trainerName);
      trainerMap.set(trainerName, {
        name: trainerName,
        username: trainerAccount ? trainerAccount.username : trainerName, // username 추가
        total: 0,
        completed: 0,
        completedTrialOrAnonymous: 0,
        scheduled: 0,
        absent: 0,
        memberCount: trainerMemberCount[trainerName] || 0,
        centerStats: {} // 센터별 통계 객체 추가
      });
    });
    
    // 세션 데이터로 통계 업데이트
    sessions.forEach(session => {
      const trainerName = trainerNameMap[session.trainer] || session.trainer; // 이름이 없으면 ID 사용
      const center = memberCenterMap[session.member]; // 회원의 센터 정보
      
      if (!trainerMap.has(trainerName)) {
        // 트레이너 이름으로 username 찾기
        const trainerAccount = trainers.find(t => t.name === trainerName);
        trainerMap.set(trainerName, {
          name: trainerName,
          username: trainerAccount ? trainerAccount.username : trainerName, // username 추가
          total: 0,
          completed: 0,
          completedTrialOrAnonymous: 0,
          scheduled: 0,
          absent: 0,
          memberCount: trainerMemberCount[trainerName] || 0,
          centerStats: {} // 센터별 통계 객체 추가
        });
      }
      
      const trainer = trainerMap.get(trainerName);
      trainer.total++;
      
      // 센터별 통계 계산 (센터가 있는 경우)
      if (center) {
        if (!trainer.centerStats[center]) {
          trainer.centerStats[center] = {
            memberCount: 0,
            total: 0,
            completed: 0,
            completedTrialOrAnonymous: 0,
            scheduled: 0,
            absent: 0
          };
        }
        
        const centerStat = trainer.centerStats[center];
        centerStat.total++;
        
        if (session.status === '완료') {
          centerStat.completed++;
          // 체험/무기명 회원 체크
          if (session.member.startsWith('체험') || session.member.startsWith('무기명')) {
            centerStat.completedTrialOrAnonymous++;
          }
        } else if (session.status === '예정' && session.date >= todayStr) {
          centerStat.scheduled++;
        } else if (session.date < todayStr) {
          centerStat.absent++;
        }
      }
      
      // 전체 통계 계산
      if (session.status === '완료') {
        trainer.completed++;
        // 체험/무기명 회원 체크
        if (session.member.startsWith('체험') || session.member.startsWith('무기명')) {
          trainer.completedTrialOrAnonymous++;
        }
      } else if (session.status === '예정' && session.date >= todayStr) {
        trainer.scheduled++;
      } else if (session.date < todayStr) {
        trainer.absent++;
      }
    });
    
    // 트레이너별 센터별 회원수 계산
    members.forEach(member => {
      if (member.status === '유효' && 
          !member.name.startsWith('무기명') && 
          !member.name.startsWith('체험')) {
        const trainerName = trainerNameMap[member.trainer] || member.trainer;
        const trainer = trainerMap.get(trainerName);
        
        if (trainer && member.center) {
          // 센터별 통계가 없으면 초기화
          if (!trainer.centerStats[member.center]) {
            trainer.centerStats[member.center] = {
              memberCount: 0,
              total: 0,
              completed: 0,
              completedTrialOrAnonymous: 0,
              scheduled: 0,
              absent: 0
            };
          }
          trainer.centerStats[member.center].memberCount++;
        }
      }
    });
    
    stats.trainerStats = Array.from(trainerMap.values());
    
    res.json(stats);
  } catch (error) {
    console.error('통계 API 오류:', error);
    res.status(500).json({ error: '통계를 불러오지 못했습니다.' });
  }
});

// 트레이너별 센터별 회원 세션 현황 조회 API
app.get('/api/member-sessions-by-center', async (req, res) => {
  try {
    const { trainer, center, yearMonth } = req.query;
    
    if (!trainer || !center || !yearMonth) {
      return res.status(400).json({ message: '트레이너, 센터, 년월 정보가 필요합니다.' });
    }
    
    // 년월을 시작일과 종료일로 변환
    const [year, month] = yearMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    // 세션 데이터 조회
    const sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
    
    // 회원 데이터 조회
    const members = await membersDB.getMembers();
    
    // 트레이너 ID를 이름으로 매핑
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    const trainers = accounts.filter(acc => acc.role === 'trainer')
      .map(({ username, name }) => ({ username, name }));
    const trainerNameMap = {};
    trainers.forEach(trainer => {
      trainerNameMap[trainer.username] = trainer.name;
    });
    
    // 해당 트레이너의 해당 센터 회원 필터링
    const trainerName = trainerNameMap[trainer] || trainer;
    const targetMembers = members.filter(member => 
      member.status === '유효' && 
      !member.name.startsWith('무기명') && 
      !member.name.startsWith('체험') &&
      member.trainer === trainer &&
      member.center === center
    );
    
    // 한국시간 기준 오늘 날짜
    const today = getKoreanToday();
    const todayStr = getKoreanDate();
    
    // 회원별 세션 통계 계산
    const memberStats = targetMembers.map(member => {
      const memberSessions = sessions.filter(s => 
        s.member === member.name && 
        (trainerNameMap[s.trainer] || s.trainer) === trainerName
      );
      
      const completed = memberSessions.filter(s => s.status === '완료').length;
      const scheduled = memberSessions.filter(s => 
        s.status === '예정' && s.date >= todayStr
      ).length;
      const absent = memberSessions.filter(s => 
        s.status !== '완료' && s.date < todayStr
      ).length;
      
      return {
        memberName: member.name,
        remainingSessions: member.remainSessions || 0,
        completed,
        scheduled,
        absent
      };
    });
    
    // 회원명 가나다순 정렬
    memberStats.sort((a, b) => a.memberName.localeCompare(b.memberName, 'ko'));
    
    res.json({
      trainer: trainerName,
      center,
      yearMonth,
      members: memberStats
    });
  } catch (error) {
    console.error('[API] 회원 세션 현황 조회 오류:', error);
    res.status(500).json({ message: '회원 세션 현황을 불러오지 못했습니다.' });
  }
});

// 체험/무기명 세션 조회 API (센터별, 월별)
app.get('/api/trial-sessions', async (req, res) => {
  try {
    const { yearMonth } = req.query;
    
    // 년월이 없으면 현재 년월 사용
    const targetYearMonth = yearMonth || getKoreanYearMonth();
    const [year, month] = targetYearMonth.split('-');
    const startDate = `${year}-${month}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    
    // 세션 데이터 조회
    const sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
    
    // 체험/무기명 세션 필터링
    const trialSessions = sessions.filter(s => 
      s.member.startsWith('체험') || s.member.startsWith('무기명')
    );
    
    // 회원 데이터 조회 (센터 정보를 위해)
    const members = await membersDB.getMembers();
    const memberCenterMap = {};
    members.forEach(member => {
      memberCenterMap[member.name] = member.center;
    });
    
    // 트레이너 ID를 이름으로 매핑
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    const trainers = accounts.filter(acc => acc.role === 'trainer')
      .map(({ username, name }) => ({ username, name }));
    const trainerNameMap = {};
    trainers.forEach(trainer => {
      trainerNameMap[trainer.username] = trainer.name;
    });
    
    // 센터별로 그룹화
    const centerGroups = {};
    
    trialSessions.forEach(session => {
      // 센터 정보 찾기: 먼저 members에서, 없으면 트레이너의 기본 센터 사용
      let center = memberCenterMap[session.member];
      if (!center) {
        // 트레이너 정보에서 센터 찾기
        const trainerAccount = accounts.find(acc => acc.username === session.trainer);
        if (trainerAccount && trainerAccount.center) {
          center = trainerAccount.center;
        } else {
          center = '미지정';
        }
      }
      
      if (!centerGroups[center]) {
        centerGroups[center] = [];
      }
      
      centerGroups[center].push({
        id: session.id,
        member: session.member,
        trainer: trainerNameMap[session.trainer] || session.trainer,
        date: session.date,
        time: session.time,
        status: session.status
      });
    });
    
    // 센터별로 날짜, 시간순 정렬
    Object.keys(centerGroups).forEach(center => {
      centerGroups[center].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return a.time.localeCompare(b.time);
      });
    });
    
    res.json({
      yearMonth: targetYearMonth,
      centers: centerGroups
    });
  } catch (error) {
    console.error('[API] 체험/무기명 세션 조회 오류:', error);
    res.status(500).json({ message: '체험/무기명 세션 조회에 실패했습니다.' });
  }
});


// Trial (신규 상담) API
// Trial 목록 조회 (센터별, 월별)
app.get('/api/trials', async (req, res) => {
  try {
    const { trainer, date, startDate, endDate, yearMonth } = req.query;
    
    const filters = {};
    if (trainer) filters.trainer = trainer;
    if (date) filters.date = date;
    if (startDate && endDate) {
      filters.startDate = startDate;
      filters.endDate = endDate;
    }
    if (yearMonth) filters.yearMonth = yearMonth;
    
    const trials = await trialsDB.getTrials(filters);
    
    // 트레이너 ID를 이름으로 매핑 및 센터 정보 가져오기
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    const trainers = accounts.filter(acc => acc.role === 'trainer');
    const trainerNameMap = {};
    const trainerCenterMap = {};
    trainers.forEach(trainer => {
      trainerNameMap[trainer.username] = trainer.name;
      trainerCenterMap[trainer.username] = trainer.center || '미지정';
    });
    
    // 센터별로 그룹화
    const centerGroups = {};
    
    trials.forEach(trial => {
      // DB에 저장된 center 값이 있으면 사용, 없으면 트레이너의 센터 정보 사용
      const center = trial.center || trainerCenterMap[trial.trainer] || '미지정';
      
      if (!centerGroups[center]) {
        centerGroups[center] = [];
      }
      
      centerGroups[center].push({
        id: trial.id,
        center: center,
        date: trial.date,
        time: trial.time,
        trainer: trainerNameMap[trial.trainer] || trial.trainer,
        member_name: trial.member_name || '',
        gender: trial.gender || '',
        phone: trial.phone || '',
        source: trial.source || '',
        purpose: trial.purpose || '',
        notes: trial.notes || '',
        result: trial.result || '',
        created_at: trial.created_at,
        updated_at: trial.updated_at
      });
    });
    
    // 센터별로 날짜, 시간순 정렬
    Object.keys(centerGroups).forEach(center => {
      centerGroups[center].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return a.time.localeCompare(b.time);
      });
    });
    
    const targetYearMonth = yearMonth || getKoreanYearMonth();
    res.json({
      yearMonth: targetYearMonth,
      centers: centerGroups
    });
  } catch (error) {
    console.error('[API] Trial 목록 조회 오류:', error);
    res.status(500).json({ message: 'Trial 목록 조회에 실패했습니다.' });
  }
});

// Trial ID로 조회
app.get('/api/trials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const trial = await trialsDB.getTrialById(id);
    
    if (!trial) {
      return res.status(404).json({ message: 'Trial을 찾을 수 없습니다.' });
    }
    
    res.json(trial);
  } catch (error) {
    console.error('[API] Trial 조회 오류:', error);
    res.status(500).json({ message: 'Trial 조회에 실패했습니다.' });
  }
});

// Trial 추가
app.post('/api/trials', async (req, res) => {
  try {
    const { center, date, time, trainer, member_name, gender, phone, source, purpose, notes, result } = req.body;
    
    // 필수 필드 검증
    if (!date || !time || !trainer) {
      return res.status(400).json({ message: '날짜, 시각, 트레이너는 필수 항목입니다.' });
    }
    
    const newTrial = {
      center,
      date,
      time,
      trainer,
      member_name,
      gender,
      phone,
      source,
      purpose,
      notes,
      result
    };
    
    const trial = await trialsDB.addTrial(newTrial);
    res.json({ message: 'Trial이 추가되었습니다.', trial });
  } catch (error) {
    console.error('[API] Trial 추가 오류:', error);
    res.status(500).json({ message: 'Trial 추가에 실패했습니다.' });
  }
});

// Trial 수정
app.patch('/api/trials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const trial = await trialsDB.updateTrial(id, updates);
    res.json({ message: 'Trial이 수정되었습니다.', trial });
  } catch (error) {
    console.error('[API] Trial 수정 오류:', error);
    if (error.message === 'Trial을 찾을 수 없습니다.') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Trial 수정에 실패했습니다.' });
    }
  }
});

// Trial 삭제
app.delete('/api/trials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await trialsDB.deleteTrial(id);
    res.json({ message: 'Trial이 삭제되었습니다.' });
  } catch (error) {
    console.error('[API] Trial 삭제 오류:', error);
    if (error.message === 'Trial을 찾을 수 없습니다.') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: 'Trial 삭제에 실패했습니다.' });
    }
  }
});

// Renewals (재등록 현황) API
// Renewals 목록 조회 (센터별, 월별)
app.get('/api/renewals', async (req, res) => {
  try {
    const filters = {};
    if (req.query.center) filters.center = req.query.center;
    if (req.query.trainer) filters.trainer = req.query.trainer;
    if (req.query.month) filters.month = req.query.month;
    if (req.query.status) filters.status = req.query.status;
    
    // month가 없으면 현재 년월 사용
    if (!filters.month) {
      filters.month = getKoreanYearMonth();
    }
    
    const renewals = await renewalsDB.getRenewals(filters);
    
    // 트레이너 ID를 이름으로 매핑
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
      const raw = fs.readFileSync(DATA_PATH, 'utf-8');
      if (raw) accounts = JSON.parse(raw);
    }
    const trainers = accounts.filter(acc => acc.role === 'trainer');
    const trainerNameMap = {};
    trainers.forEach(trainer => {
      trainerNameMap[trainer.username] = trainer.name;
    });
    
    // 센터별로 그룹화
    const centerGroups = {};
    
    renewals.forEach(renewal => {
      if (!centerGroups[renewal.center]) {
        centerGroups[renewal.center] = [];
      }
      
      centerGroups[renewal.center].push({
        id: renewal.id,
        center: renewal.center,
        trainer: trainerNameMap[renewal.trainer] || renewal.trainer,
        trainer_username: renewal.trainer,
        member_names: renewal.member_names || [],
        expected_sessions: renewal.expected_sessions,
        actual_sessions: renewal.actual_sessions,
        status: renewal.status,
        created_at: renewal.created_at,
        updated_at: renewal.updated_at
      });
    });
    
    res.json(centerGroups);
  } catch (error) {
    console.error('[API] Renewals 조회 오류:', error);
    res.status(500).json({ message: '재등록 현황 조회에 실패했습니다.' });
  }
});

// 센터/트레이너별 회원 목록 조회
app.get('/api/members-by-trainer-center', async (req, res) => {
  try {
    const { trainer, center } = req.query;
    
    if (!trainer || !center) {
      return res.status(400).json({ message: '트레이너와 센터 정보가 필요합니다.' });
    }
    
    const members = await membersDB.getMembers({ trainer, status: '유효' });
    
    // 해당 센터의 회원만 필터링 (무기명/체험 제외)
    const filteredMembers = members.filter(member => 
      member.center === center &&
      !member.name.startsWith('무기명') &&
      !member.name.startsWith('체험')
    );
    
    res.json(filteredMembers.map(m => ({
      name: m.name,
      gender: m.gender,
      phone: m.phone,
      remainSessions: m.remainSessions || 0
    })));
  } catch (error) {
    console.error('[API] 회원 목록 조회 오류:', error);
    res.status(500).json({ message: '회원 목록 조회에 실패했습니다.' });
  }
});

// Renewal 추가
app.post('/api/renewals', async (req, res) => {
  try {
    const { center, trainer, month, member_names, expected_sessions } = req.body;
    
    if (!center || !trainer || !member_names || !Array.isArray(member_names) || member_names.length === 0 || !expected_sessions || typeof expected_sessions !== 'object') {
      return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }
    
    // month가 없으면 현재 년월 사용
    const targetMonth = month || getKoreanYearMonth();
    
    // 같은 센터/트레이너/월 조합이 이미 있는지 확인
    const existingRenewals = await renewalsDB.getRenewals({ center, trainer, month: targetMonth });
    if (existingRenewals.length > 0) {
      return res.status(400).json({ message: '이미 해당 센터/트레이너/월에 대한 재등록 현황이 존재합니다. 수정 기능을 사용해주세요.' });
    }
    
    // 초기 상태는 모든 회원을 '예상'으로 설정
    const initialStatus = {};
    member_names.forEach(name => {
      initialStatus[name] = '예상';
    });
    
    const renewal = {
      center,
      trainer,
      month: targetMonth,
      member_names,
      expected_sessions: expected_sessions, // { "회원1": 10, "회원2": 20 } 형식
      status: initialStatus
    };
    
    const result = await renewalsDB.addRenewal(renewal);
    res.json({ message: '재등록 현황이 추가되었습니다.', renewal: result });
  } catch (error) {
    console.error('[API] Renewal 추가 오류:', error);
    res.status(500).json({ message: '재등록 현황 추가에 실패했습니다.' });
  }
});

// Renewal 수정 (회원 추가/삭제, 실제 재등록 수업수 및 상태)
app.patch('/api/renewals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { member_names, expected_sessions, actual_sessions, status } = req.body;
    
    if (member_names === undefined || !Array.isArray(member_names)) {
      return res.status(400).json({ message: '회원 목록을 입력해주세요.' });
    }
    
    if (member_names.length === 0) {
      return res.status(400).json({ message: '최소 1명 이상의 회원을 선택해주세요.' });
    }
    
    if (expected_sessions === undefined || typeof expected_sessions !== 'object') {
      return res.status(400).json({ message: '예상 재등록 수업수를 입력해주세요.' });
    }
    
    if (actual_sessions === undefined || typeof actual_sessions !== 'object') {
      return res.status(400).json({ message: '실제 재등록 수업수를 입력해주세요.' });
    }
    
    if (status === undefined || typeof status !== 'object') {
      return res.status(400).json({ message: '회원별 상태를 입력해주세요.' });
    }
    
    // 1. 기존 재등록 데이터 조회 (변경 전 상태 확인)
    const oldRenewal = await renewalsDB.getRenewalById(id);
    if (!oldRenewal) {
      return res.status(404).json({ message: 'Renewal을 찾을 수 없습니다.' });
    }
    const oldStatuses = oldRenewal.status || {};
    
    const updates = {
      member_names: member_names,
      expected_sessions: expected_sessions, // { "회원1": 10, "회원2": 20 } 형식
      actual_sessions: actual_sessions, // { "회원1": 10, "회원2": 20 } 형식
      status: status // { "회원1": "완료", "회원2": "예상" } 형식
    };
    
    // 2. 재등록 데이터 업데이트
    const renewal = await renewalsDB.updateRenewal(id, updates);
    
    // 3. 상태 변경 감지 및 회원 정보 업데이트
    const newStatuses = updates.status || {};
    const expiredMembers = []; // "만료"로 변경된 회원
    const validMembers = [];    // "만료"에서 다른 상태로 변경된 회원
    
    for (const memberName in newStatuses) {
      const oldStatus = oldStatuses[memberName] || '예상';
      const newStatus = newStatuses[memberName];
      
      // 케이스 1: 이전 상태가 "만료"가 아니고, 새 상태가 "만료"인 경우
      if (oldStatus !== '만료' && newStatus === '만료') {
        expiredMembers.push(memberName);
      }
      // 케이스 2: 이전 상태가 "만료"이고, 새 상태가 "만료"가 아닌 경우
      else if (oldStatus === '만료' && newStatus !== '만료') {
        validMembers.push(memberName);
      }
    }
    
    // 4-1. "만료"로 변경된 회원들의 상태를 "만료"로 업데이트
    if (expiredMembers.length > 0) {
      for (const memberName of expiredMembers) {
        try {
          await membersDB.updateMember(memberName, { status: '만료' });
        } catch (error) {
          console.error(`[Renewal] 회원 "${memberName}" 상태 업데이트 실패:`, error);
          // 회원 정보 업데이트 실패해도 재등록 업데이트는 성공으로 처리
        }
      }
    }
    
    // 4-2. "만료"에서 다른 상태로 변경된 회원들의 상태를 "유효"로 업데이트
    if (validMembers.length > 0) {
      for (const memberName of validMembers) {
        try {
          await membersDB.updateMember(memberName, { status: '유효' });
        } catch (error) {
          console.error(`[Renewal] 회원 "${memberName}" 상태 업데이트 실패:`, error);
          // 회원 정보 업데이트 실패해도 재등록 업데이트는 성공으로 처리
        }
      }
    }
    
    res.json({ message: '재등록 현황이 수정되었습니다.', renewal });
  } catch (error) {
    console.error('[API] Renewal 수정 오류:', error);
    if (error.message === 'Renewal을 찾을 수 없습니다.') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: '재등록 현황 수정에 실패했습니다.' });
    }
  }
});

// Renewal 삭제
app.delete('/api/renewals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await renewalsDB.deleteRenewal(id);
    res.json({ message: '재등록 현황이 삭제되었습니다.' });
  } catch (error) {
    console.error('[API] Renewal 삭제 오류:', error);
    if (error.message === 'Renewal을 찾을 수 없습니다.') {
      res.status(404).json({ message: error.message });
    } else {
      res.status(500).json({ message: '재등록 현황 삭제에 실패했습니다.' });
    }
  }
});

// 이메일 설정 테스트 API
app.get('/api/email/test', async (req, res) => {
    try {
        const result = await emailService.testEmailConnection();
        res.json(result);
    } catch (error) {
        console.error('[API] 이메일 설정 테스트 오류:', error);
        res.status(500).json({ success: false, message: '이메일 설정 테스트에 실패했습니다.' });
    }
});

// 계약서 이메일 전송 API
app.post('/api/email/contract', async (req, res) => {
    try {
        const { 
            recipientEmail, 
            memberName, 
            trainer, 
            regdate, 
            signatureData 
        } = req.body;
        
        if (!recipientEmail) {
            return res.status(400).json({ message: '이메일 주소를 입력해주세요.' });
        }
        
        if (!memberName || !trainer || !regdate || !signatureData) {
            return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
        }
        
        // 트레이너 이름 조회 (API 사용)
        let trainerName = trainer; // 기본값은 ID
        
        try {
            const trainersRes = await fetch(`http://localhost:${PORT}/api/trainers`);
            const trainers = await trainersRes.json();
            
            const trainerAccount = trainers.find(t => t.username === trainer);
            if (trainerAccount) {
                trainerName = trainerAccount.name;
            }
        } catch (error) {
            console.error('[API] 트레이너 이름 조회 오류:', error);
        }
        
        // 계약서 데이터 구성
        const contractData = {
            name: memberName,
            trainer: trainer,
            trainerName: trainerName,
            regdate: regdate,
            signatureData: signatureData
        };
        
        // 계약서 이메일 전송
        const result = await emailService.sendContractEmail(contractData, recipientEmail);
        
        res.json({ 
            message: '계약서가 성공적으로 전송되었습니다.', 
            messageId: result.messageId 
        });
        
    } catch (error) {
        console.error('[API] 계약서 이메일 전송 오류:', error);
        res.status(500).json({ message: '계약서 이메일 전송에 실패했습니다.' });
    }
});

// 엑셀 파일 파싱 API (Database 탭용)
app.post('/api/database/parse-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '파일을 선택해주세요.' });
        }

        // 파일 크기 검증 (10MB 제한)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: '파일 크기는 10MB 이하여야 합니다.' });
        }

        // 엑셀 파일 읽기
        let data = [];
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            
            if (workbook.worksheets.length === 0) {
                return res.status(400).json({ message: '엑셀 파일에 시트가 없습니다.' });
            }
            
            const worksheet = workbook.worksheets[0];
            const rows = [];
            
            // 최대 컬럼 수 확인 (모든 행을 먼저 확인)
            let maxColumnCount = 0;
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell, colNumber) => {
                    if (colNumber > maxColumnCount) {
                        maxColumnCount = colNumber;
                    }
                });
            });
            
            // 모든 행 읽기 (빈 셀 포함)
            worksheet.eachRow((row, rowNumber) => {
                // colNumber는 1부터 시작하므로 배열 크기는 maxColumnCount
                const rowData = new Array(maxColumnCount).fill(null);
                row.eachCell((cell, colNumber) => {
                    // colNumber는 1부터 시작하므로 인덱스는 colNumber - 1
                    rowData[colNumber - 1] = cell.value;
                });
                rows.push(rowData);
            });
            
            data = rows;
        } catch (excelError) {
            console.error('[API] 엑셀 파일 읽기 오류:', excelError);
            return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' });
        }

        // 데이터가 비어있는지 확인
        if (!data || data.length < 2) {
            return res.status(400).json({ message: '엑셀 파일에 데이터가 없습니다. (헤더 제외 최소 1개 행 필요)' });
        }

        // 헤더 확인 (첫 번째 행)
        const headers = data[0];
        if (!headers || headers.length === 0) {
            return res.status(400).json({ message: '엑셀 파일의 첫 번째 행(헤더)을 읽을 수 없습니다.' });
        }

        // 헬퍼 함수: 띄어쓰기 제거 후 비교
        const normalizeHeader = (header) => {
            if (!header) return '';
            return String(header).trim().replace(/\s+/g, ''); // 모든 공백 제거
        };
        
        // 헬퍼 함수: 날짜 형식인지 확인 (회원상태와 최근방문일 구분용)
        const isDateValue = (value) => {
            if (!value) return false;
            const str = String(value).trim();
            // 날짜 형식 패턴: YYYY-MM-DD, YYYY.MM.DD, YYYY/MM/DD, 또는 날짜+시간
            return /^\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2}/.test(str) || /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}/.test(str);
        };

        // 필수 컬럼 정의 (띄어쓰기 무시하고 매칭)
        const requiredColumnMap = {
            '회원이름': '회원 이름',
            '연락처': '연락처',
            '회원상태': '회원상태',
            '최근방문일': '최근방문일',
            '상품명': '상품명',
            '전체기간': '전체기간'
        };

        // 정규화된 헤더 맵 생성
        const normalizedHeaders = headers.map((h, idx) => ({
            original: String(h || '').trim(),
            normalized: normalizeHeader(h),
            index: idx
        }));

        // 컬럼 인덱스 찾기 (띄어쓰기 무시)
        const findColumnIndex = (targetKey) => {
            const normalizedTarget = normalizeHeader(targetKey);
            const found = normalizedHeaders.find(h => h.normalized === normalizedTarget);
            return found ? found.index : -1;
        };

        const nameIndex = findColumnIndex('회원 이름');
        const phoneIndex = findColumnIndex('연락처');
        let statusIndex = findColumnIndex('회원상태');
        const recentVisitIndex = findColumnIndex('최근방문일');
        const endDateIndex = findColumnIndex('회원권 종료일'); // 선택적 필드
        const productNameIndex = findColumnIndex('상품명');
        const totalPeriodIndex = findColumnIndex('전체기간');
        
        // statusIndex 검증: 만약 찾은 인덱스의 데이터가 날짜 형식이면, 다른 컬럼을 찾아봐야 함
        if (statusIndex >= 0 && data.length > 1) {
            // 첫 번째 데이터 행에서 해당 인덱스의 값을 확인
            const firstRow = data[1];
            if (firstRow && firstRow[statusIndex] && isDateValue(firstRow[statusIndex])) {
                // "회원상태"와 유사한 다른 컬럼들을 찾아봄
                const possibleStatusHeaders = normalizedHeaders.filter(h => 
                    h.normalized.includes('상태') || 
                    h.normalized.includes('유효') || 
                    h.normalized.includes('만료')
                );
                if (possibleStatusHeaders.length > 0) {
                    // 첫 번째 후보를 사용 (또는 더 정확한 매칭 로직 사용)
                    const candidate = possibleStatusHeaders.find(h => {
                        if (data.length > 1 && data[1][h.index]) {
                            const val = String(data[1][h.index]).trim();
                            // 날짜 형식이 아니고, "유효" 또는 "만료" 같은 값인지 확인
                            return !isDateValue(val) && (val.includes('유효') || val.includes('만료') || val.length < 10);
                        }
                        return false;
                    });
                    if (candidate) {
                        statusIndex = candidate.index;
                    } else {
                        // 날짜가 아닌 첫 번째 후보 사용
                        const nonDateCandidate = possibleStatusHeaders.find(h => {
                            if (data.length > 1 && data[1][h.index]) {
                                return !isDateValue(data[1][h.index]);
                            }
                            return false;
                        });
                        if (nonDateCandidate) {
                            statusIndex = nonDateCandidate.index;
                        }
                    }
                }
            }
        }
        
        

        // 필수 컬럼 존재 여부 확인
        const missingColumns = [];
        if (nameIndex === -1) missingColumns.push('회원 이름');
        if (phoneIndex === -1) missingColumns.push('연락처');
        if (statusIndex === -1) missingColumns.push('회원상태');
        if (recentVisitIndex === -1) missingColumns.push('최근방문일');
        if (productNameIndex === -1) missingColumns.push('상품명');
        if (totalPeriodIndex === -1) missingColumns.push('전체기간');

        if (missingColumns.length > 0) {
            return res.status(400).json({ 
                message: `필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`,
                availableHeaders: headers.filter(h => h).map(h => String(h).trim())
            });
        }

        // 회원별로 데이터 그룹화
        const memberMap = new Map();

        // 데이터 처리 (헤더 제외)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row.length === 0 || row.every(cell => !cell)) continue; // 빈 행 스킵

            const name = String(row[nameIndex] || '').trim();
            if (!name) continue; // 이름이 없으면 스킵

            // 데이터 추출 (인덱스 검증 포함)
            const phone = phoneIndex >= 0 ? String(row[phoneIndex] || '').trim() : '';
            const status = statusIndex >= 0 ? String(row[statusIndex] || '').trim() : '';
            const recentVisit = recentVisitIndex >= 0 && row[recentVisitIndex] ? String(row[recentVisitIndex]).trim() : '';
            const endDate = endDateIndex >= 0 && row[endDateIndex] ? String(row[endDateIndex]).trim() : '';
            const productName = productNameIndex >= 0 && row[productNameIndex] ? String(row[productNameIndex]).trim() : '';
            const totalPeriod = totalPeriodIndex >= 0 && row[totalPeriodIndex] ? String(row[totalPeriodIndex]).trim() : '';

            if (!memberMap.has(name)) {
                // 새로운 회원 추가
                // 상품명별 전체기간을 저장하기 위한 맵
                const productPeriodMap = {};
                if (productName && totalPeriod) {
                    productPeriodMap[productName] = totalPeriod;
                }
                
                memberMap.set(name, {
                    name: name,
                    phone: phone,
                    status: status,
                    recentVisit: recentVisit,
                    endDate: endDate,
                    productNames: productName ? [productName] : [],
                    productPeriodMap: productPeriodMap, // 상품명별 기간 맵
                    totalPeriod: totalPeriod || '0'
                });
            } else {
                // 기존 회원 정보 업데이트
                const member = memberMap.get(name);
                
                // productPeriodMap이 없으면 초기화
                if (!member.productPeriodMap) {
                    member.productPeriodMap = {};
                }
                
                // 상품명 추가 (중복 허용)
                if (productName) {
                    member.productNames.push(productName);
                    // 상품명별 기간 저장
                    if (totalPeriod) {
                        // 같은 상품명이 여러 번 나올 수 있으므로 합산
                        if (member.productPeriodMap[productName]) {
                            const currentPeriod = parsePeriodToNumber(member.productPeriodMap[productName]);
                            const newPeriod = parsePeriodToNumber(totalPeriod);
                            member.productPeriodMap[productName] = String(currentPeriod + newPeriod);
                        } else {
                            member.productPeriodMap[productName] = totalPeriod;
                        }
                    }
                }
                
                // 전체기간 합산 (숫자로 변환 가능한 경우) - 모든 상품의 기간 합
                if (totalPeriod) {
                    const currentPeriod = parsePeriodToNumber(member.totalPeriod);
                    const newPeriod = parsePeriodToNumber(totalPeriod);
                    member.totalPeriod = String(currentPeriod + newPeriod);
                }
                
                // 최근 방문 시간 업데이트 (더 최근 것으로)
                if (recentVisit && (!member.recentVisit || recentVisit > member.recentVisit)) {
                    member.recentVisit = recentVisit;
                }
            }
        }

        // Map을 배열로 변환
        const members = Array.from(memberMap.values());
        
        // 모든 상품명 수집 (중복 제거)
        const allProductNames = new Set();
        members.forEach(member => {
            if (member.productNames) {
                member.productNames.forEach(productName => {
                    if (productName) {
                        allProductNames.add(productName);
                    }
                });
            }
        });
        const uniqueProductNames = Array.from(allProductNames).sort();

        res.json({
            message: '엑셀 파일 파싱이 완료되었습니다.',
            members: members,
            total: members.length,
            allProductNames: uniqueProductNames // 모든 상품명 목록
        });

    } catch (error) {
        console.error('[API] 엑셀 파일 파싱 오류:', error);
        res.status(500).json({ message: '엑셀 파일 파싱에 실패했습니다.' });
    }
});

// 매출정보 엑셀 파일 파싱 API (Database 탭용)
app.post('/api/database/parse-sales-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '파일을 선택해주세요.' });
        }

        // 파일 크기 검증 (10MB 제한)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: '파일 크기는 10MB 이하여야 합니다.' });
        }

        // 엑셀 파일 읽기
        let data = [];
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            
            if (workbook.worksheets.length === 0) {
                return res.status(400).json({ message: '엑셀 파일에 시트가 없습니다.' });
            }
            
            const worksheet = workbook.worksheets[0];
            const rows = [];
            
            // 최대 컬럼 수 확인 (모든 행을 먼저 확인)
            let maxColumnCount = 0;
            worksheet.eachRow((row, rowNumber) => {
                row.eachCell((cell, colNumber) => {
                    if (colNumber > maxColumnCount) {
                        maxColumnCount = colNumber;
                    }
                });
            });
            
            // 모든 행 읽기 (빈 셀 포함)
            worksheet.eachRow((row, rowNumber) => {
                const rowData = new Array(maxColumnCount).fill(null);
                row.eachCell((cell, colNumber) => {
                    rowData[colNumber - 1] = cell.value;
                });
                rows.push(rowData);
            });
            
            data = rows;
        } catch (excelError) {
            console.error('[API] 엑셀 파일 읽기 오류:', excelError);
            return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' });
        }

        // 데이터가 비어있는지 확인
        if (!data || data.length < 2) {
            return res.status(400).json({ message: '엑셀 파일에 데이터가 없습니다. (헤더 제외 최소 1개 행 필요)' });
        }

        // 헤더 확인 (첫 번째 행)
        const headers = data[0];
        if (!headers || headers.length === 0) {
            return res.status(400).json({ message: '엑셀 파일의 첫 번째 행(헤더)을 읽을 수 없습니다.' });
        }

        // 헬퍼 함수: 띄어쓰기 제거 후 비교
        const normalizeHeader = (header) => {
            if (!header) return '';
            return String(header).trim().replace(/\s+/g, ''); // 모든 공백 제거
        };

        // 정규화된 헤더 맵 생성
        const normalizedHeaders = headers.map((h, idx) => ({
            original: String(h || '').trim(),
            normalized: normalizeHeader(h),
            index: idx
        }));

        // 컬럼 인덱스 찾기 (띄어쓰기 무시)
        const findColumnIndex = (targetKey) => {
            const normalizedTarget = normalizeHeader(targetKey);
            const found = normalizedHeaders.find(h => h.normalized === normalizedTarget);
            return found ? found.index : -1;
        };

        // 필수 컬럼 찾기
        const nameIndex = findColumnIndex('회원 이름');
        const phoneIndex = findColumnIndex('연락처');
        const salesNameIndex = findColumnIndex('매출 이름');

        // 필수 컬럼 존재 여부 확인
        const missingColumns = [];
        if (nameIndex === -1) missingColumns.push('회원 이름');
        if (phoneIndex === -1) missingColumns.push('연락처');
        if (salesNameIndex === -1) missingColumns.push('매출 이름');

        if (missingColumns.length > 0) {
            return res.status(400).json({ 
                message: `필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`,
                availableHeaders: headers.filter(h => h).map(h => String(h).trim())
            });
        }

        // 회원별로 데이터 그룹화 (회원 이름 + 연락처를 키로 사용)
        const salesMap = new Map();

        // 데이터 처리 (헤더 제외)
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row.length === 0 || row.every(cell => !cell)) continue; // 빈 행 스킵

            const name = String(row[nameIndex] || '').trim();
            const phone = String(row[phoneIndex] || '').trim();
            const salesName = String(row[salesNameIndex] || '').trim();

            // 회원 이름과 연락처가 모두 있어야 함
            if (!name || !phone) continue;

            // 키: 회원 이름 + 연락처
            const memberKey = `${name}|${phone}`;

            if (!salesMap.has(memberKey)) {
                // 새로운 회원 추가
                salesMap.set(memberKey, {
                    memberName: name,
                    phone: phone,
                    salesNames: salesName ? [salesName] : []
                });
            } else {
                // 기존 회원 정보 업데이트 (매출 이름 추가)
                const sales = salesMap.get(memberKey);
                if (salesName && !sales.salesNames.includes(salesName)) {
                    sales.salesNames.push(salesName);
                }
            }
        }

        // Map을 배열로 변환
        const sales = Array.from(salesMap.values());
        
        // 모든 매출 이름 수집 (중복 제거)
        const allSalesNames = new Set();
        sales.forEach(sale => {
            if (sale.salesNames) {
                sale.salesNames.forEach(salesName => {
                    if (salesName) {
                        allSalesNames.add(salesName);
                    }
                });
            }
        });
        const uniqueSalesNames = Array.from(allSalesNames).sort();

        res.json({
            message: '매출정보 엑셀 파일 파싱이 완료되었습니다.',
            sales: sales,
            total: sales.length,
            allSalesNames: uniqueSalesNames // 모든 매출 이름 목록
        });

    } catch (error) {
        console.error('[API] 매출정보 엑셀 파일 파싱 오류:', error);
        res.status(500).json({ message: '매출정보 엑셀 파일 파싱에 실패했습니다.' });
    }
});

// 파싱된 회원 정보 스냅샷 저장 API
app.post('/api/database/snapshots', async (req, res) => {
    try {
        const { center, yearMonth, members } = req.body;
        
        if (!center || !yearMonth || !members || !Array.isArray(members)) {
            return res.status(400).json({ message: '센터, 연도/월, 회원 목록이 필요합니다.' });
        }
        
        // yearMonth 형식 검증 (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
            return res.status(400).json({ message: '연도/월 형식이 올바르지 않습니다. (YYYY-MM)' });
        }
        
        const result = await parsedMemberSnapshotsDB.saveSnapshot(center, yearMonth, members);
        
        res.json({
            message: '스냅샷이 저장되었습니다.',
            savedCount: result.savedCount
        });
    } catch (error) {
        console.error('[API] 스냅샷 저장 오류:', error);
        res.status(500).json({ message: '스냅샷 저장에 실패했습니다.' });
    }
});

// 파싱된 회원 정보 스냅샷 조회 API
app.get('/api/database/snapshots', async (req, res) => {
    try {
        const { center, yearMonth } = req.query;
        
        if (!yearMonth) {
            return res.status(400).json({ message: '연도/월이 필요합니다.' });
        }
        
        const result = await parsedMemberSnapshotsDB.getSnapshot(center || null, yearMonth);
        res.json(result);
    } catch (error) {
        console.error('[API] 스냅샷 조회 오류:', error);
        res.status(500).json({ message: '스냅샷 조회에 실패했습니다.' });
    }
});

// 파싱된 회원 정보 스냅샷 목록 조회 API
app.get('/api/database/snapshots/list', async (req, res) => {
    try {
        const { center, yearMonth, year } = req.query;
        const filters = {};
        if (center) filters.center = center;
        if (yearMonth) filters.yearMonth = yearMonth;
        if (year) filters.year = year;
        
        const snapshots = await parsedMemberSnapshotsDB.getSnapshotList(filters);
        res.json({ snapshots });
    } catch (error) {
        console.error('[API] 스냅샷 목록 조회 오류:', error);
        res.status(500).json({ message: '스냅샷 목록 조회에 실패했습니다.' });
    }
});

// 파싱된 회원 정보 스냅샷 삭제 API
app.delete('/api/database/snapshots', async (req, res) => {
    try {
        const { center, yearMonth } = req.query;
        
        if (!center || !yearMonth) {
            return res.status(400).json({ message: '센터와 연도/월이 필요합니다.' });
        }
        
        const result = await parsedMemberSnapshotsDB.deleteSnapshot(center, yearMonth);
        res.json({
            message: '스냅샷이 삭제되었습니다.',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('[API] 스냅샷 삭제 오류:', error);
        res.status(500).json({ message: '스냅샷 삭제에 실패했습니다.' });
    }
});

// 파싱된 매출정보 스냅샷 저장 API
app.post('/api/database/sales-snapshots', async (req, res) => {
    try {
        const { center, yearMonth, sales } = req.body;
        
        if (!center || !yearMonth || !sales || !Array.isArray(sales)) {
            return res.status(400).json({ message: '센터, 연도/월, 매출 목록이 필요합니다.' });
        }
        
        // yearMonth 형식 검증 (YYYY-MM)
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
            return res.status(400).json({ message: '연도/월 형식이 올바르지 않습니다. (YYYY-MM)' });
        }
        
        const result = await parsedSalesSnapshotsDB.saveSnapshot(center, yearMonth, sales);
        
        res.json({
            message: '매출정보 스냅샷이 저장되었습니다.',
            savedCount: result.savedCount
        });
    } catch (error) {
        console.error('[API] 매출정보 스냅샷 저장 오류:', error);
        res.status(500).json({ message: '매출정보 스냅샷 저장에 실패했습니다.' });
    }
});

// 파싱된 매출정보 스냅샷 조회 API
app.get('/api/database/sales-snapshots', async (req, res) => {
    try {
        const { center, yearMonth } = req.query;
        
        if (!yearMonth) {
            return res.status(400).json({ message: '연도/월이 필요합니다.' });
        }
        
        const result = await parsedSalesSnapshotsDB.getSnapshot(center || null, yearMonth);
        res.json(result);
    } catch (error) {
        console.error('[API] 매출정보 스냅샷 조회 오류:', error);
        res.status(500).json({ message: '매출정보 스냅샷 조회에 실패했습니다.' });
    }
});

// 파싱된 매출정보 스냅샷 목록 조회 API
app.get('/api/database/sales-snapshots/list', async (req, res) => {
    try {
        const filters = {};
        if (req.query.center) filters.center = req.query.center;
        if (req.query.yearMonth) filters.yearMonth = req.query.yearMonth;
        if (req.query.year) filters.year = req.query.year;
        
        const snapshots = await parsedSalesSnapshotsDB.getSnapshotList(filters);
        res.json({ snapshots });
    } catch (error) {
        console.error('[API] 매출정보 스냅샷 목록 조회 오류:', error);
        res.status(500).json({ message: '매출정보 스냅샷 목록 조회에 실패했습니다.' });
    }
});

// 파싱된 매출정보 스냅샷 삭제 API
app.delete('/api/database/sales-snapshots', async (req, res) => {
    try {
        const { center, yearMonth } = req.query;
        
        if (!center || !yearMonth) {
            return res.status(400).json({ message: '센터와 연도/월이 필요합니다.' });
        }
        
        const result = await parsedSalesSnapshotsDB.deleteSnapshot(center, yearMonth);
        res.json({
            message: '매출정보 스냅샷이 삭제되었습니다.',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('[API] 매출정보 스냅샷 삭제 오류:', error);
        res.status(500).json({ message: '매출정보 스냅샷 삭제에 실패했습니다.' });
    }
});

// 기간 문자열을 숫자로 변환하는 헬퍼 함수 (예: "3개월" -> 3, "6개월" -> 6)
function parsePeriodToNumber(periodStr) {
    if (!periodStr) return 0;
    const str = String(periodStr).trim();
    // 숫자만 추출
    const match = str.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
}

// 엑셀 파일 업로드 및 회원 일괄 추가 API
app.post('/api/members/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '파일을 선택해주세요.' });
        }

        // 파일 크기 검증 (10MB 제한)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: '파일 크기는 10MB 이하여야 합니다.' });
        }

        // 엑셀 파일 읽기
        let data = [];
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            
            if (workbook.worksheets.length === 0) {
                return res.status(400).json({ message: '엑셀 파일에 시트가 없습니다.' });
            }
            
            const worksheet = workbook.worksheets[0];
            const rows = [];
            
            worksheet.eachRow((row, rowNumber) => {
                const rowData = [];
                row.eachCell((cell, colNumber) => {
                    rowData.push(cell.value);
                });
                rows.push(rowData);
            });
            
            data = rows;
        } catch (excelError) {
            console.error('[API] 엑셀 파일 읽기 오류:', excelError);
            return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' });
        }

        // 데이터가 비어있는지 확인
        if (!data || data.length < 2) {
            return res.status(400).json({ message: '엑셀 파일에 데이터가 없습니다. (헤더 제외 최소 1개 행 필요)' });
        }

        // 헤더 확인 (첫 번째 행)
        const headers = data[0];
        if (!headers || headers.length === 0) {
            return res.status(400).json({ message: '엑셀 파일의 첫 번째 행(헤더)을 읽을 수 없습니다.' });
        }

        const requiredHeaders = ['이름', '전화번호', '담당트레이너', '세션수'];
        
        // 필수 헤더 검증
        const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
        if (missingHeaders.length > 0) {
            return res.status(400).json({ 
                message: `필수 컬럼이 누락되었습니다: ${missingHeaders.join(', ')}` 
            });
        }

        // 기본값 설정을 위한 데이터 준비
        let defaultCenter = '';
        let trainerNameMap = {}; // 트레이너 name -> username 매핑
        let trainerUsernameMap = {}; // 트레이너 username -> name 매핑
        
        try {
            // 센터 목록에서 첫 번째 센터 가져오기
            let centers = [];
            if (fs.existsSync(CENTERS_PATH)) {
                const raw = fs.readFileSync(CENTERS_PATH, 'utf-8');
                if (raw) centers = JSON.parse(raw);
            }
            defaultCenter = centers.length > 0 ? centers[0].name : '';
            
            // 트레이너 목록 가져오기
            let accounts = [];
            if (fs.existsSync(DATA_PATH)) {
                const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                if (raw) accounts = JSON.parse(raw);
            }
            const trainers = accounts.filter(acc => acc.role === 'trainer');
            trainers.forEach(trainer => {
                trainerNameMap[trainer.name] = trainer.username; // name -> username 매핑
                trainerUsernameMap[trainer.username] = trainer.name; // username -> name 매핑
            });
        } catch (error) {
            console.error('[API] 센터/트레이너 정보 읽기 오류:', error);
        }

        const today = getKoreanDate(); // 한국시간 기준 YYYY-MM-DD 형식

        // 데이터 처리 (헤더 제외)
        const members = [];
        const errors = [];
        
        for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row.length === 0 || row.every(cell => !cell)) continue; // 빈 행 스킵
            
            try {
                // 필수 데이터 추출
                const name = String(row[headers.indexOf('이름')] || '').trim();
                const phone = String(row[headers.indexOf('전화번호')] || '').trim();
                const trainer = String(row[headers.indexOf('담당트레이너')] || '').trim();
                const sessions = Number(row[headers.indexOf('세션수')] || 0);

                // 선택적 데이터 추출 (기본값 적용)
                const genderInput = String(row[headers.indexOf('성별')] || '').trim();
                const centerInput = String(row[headers.indexOf('센터')] || '').trim();
                const regdateInput = String(row[headers.indexOf('등록일')] || '').trim();

                // 기본값 설정
                let gender = 'female'; // 기본값: 여성
                if (genderInput && ['남성', '여성', 'male', 'female'].includes(genderInput)) {
                    gender = genderInput === '남성' || genderInput === 'male' ? 'male' : 'female';
                }

                let center = defaultCenter; // 기본값: 첫 번째 센터
                if (centerInput) {
                    center = centerInput;
                }

                let regdate = today; // 기본값: 오늘
                if (regdateInput) {
                    // 등록일 형식 검증
                    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                    if (dateRegex.test(regdateInput)) {
                        regdate = regdateInput;
                    } else {
                        errors.push(`행 ${i + 1}: 등록일 형식이 올바르지 않습니다. (YYYY-MM-DD) - 기본값(오늘) 사용`);
                    }
                }

                // 트레이너명을 username으로 변환
                let trainerUsername = trainer;
                if (trainerNameMap[trainer]) {
                    trainerUsername = trainerNameMap[trainer];
                } else {
                    errors.push(`행 ${i + 1}: 존재하지 않는 트레이너입니다: ${trainer}`);
                    continue;
                }

                const member = {
                    name,
                    gender,
                    phone,
                    trainer: trainerUsername, // username으로 저장
                    center,
                    regdate,
                    sessions
                };

                // 필수 데이터 검증
                if (!member.name) {
                    errors.push(`행 ${i + 1}: 이름이 비어있습니다.`);
                    continue;
                }
                if (!member.phone) {
                    errors.push(`행 ${i + 1}: 전화번호가 비어있습니다.`);
                    continue;
                }
                if (!member.trainer) {
                    errors.push(`행 ${i + 1}: 담당트레이너가 비어있습니다.`);
                    continue;
                }
                if (member.sessions < 0) {
                    errors.push(`행 ${i + 1}: 세션수는 0 이상이어야 합니다.`);
                    continue;
                }
                if (!member.center) {
                    errors.push(`행 ${i + 1}: 센터 정보를 찾을 수 없습니다. (기본 센터 설정 필요)`);
                    continue;
                }

                members.push(member);
            } catch (error) {
                errors.push(`행 ${i + 1}: 데이터 처리 중 오류가 발생했습니다.`);
            }
        }

        // 에러가 있으면 중단
        if (errors.length > 0) {
            return res.status(400).json({ 
                message: '엑셀 파일에 오류가 있습니다.', 
                errors: errors 
            });
        }

        // 기존 회원 목록 조회 (중복 체크용)
        const existingMembers = await membersDB.getMembers();
        const existingNames = new Set(existingMembers.map(m => m.name));

        // 회원 일괄 추가
        const addedMembers = [];
        const failedMembers = [];

        for (const member of members) {
            try {
                // 중복 이름 체크
                if (existingNames.has(member.name)) {
                    failedMembers.push({
                        member: member,
                        error: `이미 존재하는 회원명입니다: ${member.name}`
                    });
                    continue;
                }

                const newMember = {
                    ...member,
                    remainSessions: member.sessions,
                    status: '유효'
                };
                
                const addedMember = await membersDB.addMember(newMember);
                addedMembers.push(addedMember);
                
                // 성공한 회원명을 기존 목록에 추가 (같은 파일 내 중복 방지)
                existingNames.add(member.name);
                
                // 신규 세션 통계 추가
                if (member.sessions > 0) {
                    await monthlyStatsDB.addNewSessions(member.sessions);
                }
            } catch (error) {
                failedMembers.push({
                    member: member,
                    error: error.message
                });
            }
        }

        res.json({
            message: `회원 일괄 추가가 완료되었습니다.`,
            summary: {
                total: members.length,
                success: addedMembers.length,
                failed: failedMembers.length
            },
            addedMembers: addedMembers,
            failedMembers: failedMembers
        });

    } catch (error) {
        console.error('[API] 엑셀 파일 업로드 오류:', error);
        res.status(500).json({ message: '엑셀 파일 처리에 실패했습니다.' });
    }
});




        


// 트레이너 목록 조회 API
app.get('/api/trainers', (req, res) => {
    try {
        const accountsPath = path.join(__dirname, '../data/accounts.json');
        
        if (!fs.existsSync(accountsPath)) {
            return res.status(404).json({ 
                message: '계정 파일을 찾을 수 없습니다.',
                trainers: [] 
            });
        }
        
        // 특정 트레이너 username으로 조회 (성능 최적화)
        if (req.query.username) {
            const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
            const trainer = accounts.find(acc => acc.role === 'trainer' && acc.username === req.query.username);
            
            if (trainer) {
                return res.json([{
                    username: trainer.username,
                    name: trainer.name || trainer.username
                }]);
            } else {
                return res.json([]);
            }
        }
        
        const accounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        
        // 트레이너만 필터링 (role이 'trainer'인 사용자)
        const trainers = accounts.filter(account => account.role === 'trainer')
            .map(trainer => ({
                username: trainer.username,
                name: trainer.name || trainer.username
            }));
        
        res.json(trainers);
        
    } catch (error) {
        console.error('[API] 트레이너 목록 조회 오류:', error);
        res.status(500).json({ 
            message: '트레이너 목록을 불러오는데 실패했습니다.',
            trainers: [] 
        });
    }
});

// 계약서 내용 조회 API
app.get('/api/contract/content', (req, res) => {
    try {
        const contractPath = path.join(__dirname, '../public/img/contract.txt');
        
        if (!fs.existsSync(contractPath)) {
            return res.status(404).json({ 
                message: '계약서 파일을 찾을 수 없습니다.',
                content: '계약서 파일이 존재하지 않습니다.' 
            });
        }
        
        const content = fs.readFileSync(contractPath, 'utf-8');
        
        // 텍스트를 HTML로 변환 (줄바꿈을 <br>로 변환)
        const htmlContent = content
            .replace(/\n/g, '<br>')
            .replace(/\r\n/g, '<br>')
            .replace(/\r/g, '<br>');
        
        res.json({ 
            message: '계약서 내용을 성공적으로 불러왔습니다.',
            content: htmlContent 
        });
        
    } catch (error) {
        console.error('[API] 계약서 내용 조회 오류:', error);
        res.status(500).json({ 
            message: '계약서 내용을 불러오는데 실패했습니다.',
            content: '계약서 내용을 불러오는데 실패했습니다.' 
        });
    }
});

// 월별 통계 초기화 API
app.post('/api/monthly-stats/reset', async (req, res) => {
    try {
        const { yearMonth } = req.body;
        
        if (!yearMonth) {
            return res.status(400).json({ message: '연도-월 형식(YYYY-MM)이 필요합니다.' });
        }
        
        // YYYY-MM 형식 검증
        const yearMonthRegex = /^\d{4}-\d{2}$/;
        if (!yearMonthRegex.test(yearMonth)) {
            return res.status(400).json({ message: '올바른 연도-월 형식(YYYY-MM)을 입력해주세요.' });
        }
        
        // 월별 통계 초기화
        const result = await monthlyStatsDB.resetMonthlyStats(yearMonth);
        
        res.json({ 
            message: `${yearMonth} 월별 통계가 초기화되었습니다.`,
            result: result
        });
        
    } catch (error) {
        console.error('[API] 월별 통계 초기화 오류:', error);
        res.status(500).json({ message: '월별 통계 초기화에 실패했습니다.' });
    }
});

// 전체 등록 로그 조회 API
app.get('/api/registration-logs', async (req, res) => {
    try {
        // 모든 등록 로그 조회
        const logs = await registrationLogsDB.getAllLogs();
        
        res.json({ 
            message: '전체 등록 로그를 조회했습니다.',
            logs: logs
        });
        
    } catch (error) {
        console.error('[API] 전체 등록 로그 조회 오류:', error);
        res.status(500).json({ message: '전체 등록 로그 조회에 실패했습니다.' });
    }
});

// 특정 월 등록 로그 조회 API
app.get('/api/registration-logs/:yearMonth', async (req, res) => {
    try {
        const { yearMonth } = req.params;
        
        if (!yearMonth) {
            return res.status(400).json({ message: '연도-월 형식(YYYY-MM)이 필요합니다.' });
        }
        
        // YYYY-MM 형식 검증
        const yearMonthRegex = /^\d{4}-\d{2}$/;
        if (!yearMonthRegex.test(yearMonth)) {
            return res.status(400).json({ message: '올바른 연도-월 형식(YYYY-MM)을 입력해주세요.' });
        }
        
        // 해당 월의 등록 로그 조회
        const logs = await registrationLogsDB.getLogsByMonth(yearMonth);
        
        res.json({ 
            message: `${yearMonth} 등록 로그를 조회했습니다.`,
            logs: logs
        });
        
    } catch (error) {
        console.error('[API] 등록 로그 조회 오류:', error);
        res.status(500).json({ message: '등록 로그 조회에 실패했습니다.' });
    }
});

// 지출 내역 추가 API (트레이너만 가능)
app.post('/api/expenses', async (req, res) => {
    try {
        const { trainer, expenseType, amount, datetime, participantTrainers, purchaseItem, center } = req.body;
        
        // 기본 필수 필드 검증
        if (!trainer || amount === undefined || !datetime) {
            return res.status(400).json({ message: '모든 필수 항목을 입력해주세요.' });
        }
        
        // 지출 유형 검증
        const type = expenseType || 'meal'; // 기본값: meal
        if (type !== 'meal' && type !== 'purchase' && type !== 'personal') {
            return res.status(400).json({ message: '지출 유형은 meal, purchase 또는 personal이어야 합니다.' });
        }
        
        // 금액 검증
        const numAmount = Number(amount);
        if (isNaN(numAmount) || numAmount < 0) {
            return res.status(400).json({ message: '금액은 0 이상의 숫자여야 합니다.' });
        }
        
        // 지출 유형별 필수 필드 검증
        if (type === 'meal') {
            // 식대: 함께 지출한 트레이너 필수
            if (!participantTrainers || !Array.isArray(participantTrainers) || participantTrainers.length === 0) {
                return res.status(400).json({ message: '함께 지출한 트레이너를 최소 1명 이상 선택해주세요.' });
            }
        } else if (type === 'purchase') {
            // 구매: 구매물품, 센터 필수
            if (!purchaseItem || !purchaseItem.trim()) {
                return res.status(400).json({ message: '구매물품을 입력해주세요.' });
            }
            if (!center || !center.trim()) {
                return res.status(400).json({ message: '센터를 선택해주세요.' });
            }
        } else if (type === 'personal') {
            // 개인지출: 지출내역(personalItem)은 선택, 센터는 선택
            // 필수 필드 검증 제거 (개인지출은 선택 필드)
        }
        
        // datetime 처리: datetime-local 입력값을 한국시간 TIMESTAMP로 변환
        // 입력 형식: "2025-01-15T12:30" 또는 "2025-01-15T12:30:00" (로컬 시간)
        // 저장 형식: "2025-01-15 12:30:00+09:00" (한국시간)
        let datetimeValue;
        try {
            // datetime-local 형식인 경우
            if (datetime.includes('T')) {
                // 한국시간으로 해석 (UTC+9)
                const [datePart, timePart] = datetime.split('T');
                // timePart에서 초가 없으면 추가, 있으면 그대로 사용
                const timeWithSeconds = timePart.includes(':') && timePart.split(':').length === 3 
                    ? timePart 
                    : timePart + ':00';
                datetimeValue = `${datePart} ${timeWithSeconds}+09:00`;
            } else {
                // 이미 TIMESTAMP 형식인 경우
                datetimeValue = datetime;
            }
        } catch (error) {
            console.error('[API] datetime 처리 오류:', error, datetime);
            return res.status(400).json({ message: '올바른 날짜 형식을 입력해주세요.' });
        }
        
        const expenseData = {
            trainer,
            expenseType: type,
            amount: numAmount,
            datetime: datetimeValue
        };
        
        if (type === 'meal') {
            expenseData.participantTrainers = participantTrainers;
        } else if (type === 'purchase') {
            expenseData.purchaseItem = purchaseItem ? purchaseItem.trim() : null;
            expenseData.center = center ? center.trim() : null;
        } else if (type === 'personal') {
            expenseData.personalItem = req.body.personalItem ? req.body.personalItem.trim() : null;
            expenseData.center = center ? center.trim() : null;
        }
        
        const expense = await expensesDB.addExpense(expenseData);
        
        res.json({ 
            message: '지출 내역이 추가되었습니다.',
            expense 
        });
    } catch (error) {
        console.error('[API] 지출 내역 추가 오류:', error);
        res.status(500).json({ message: '지출 내역 추가에 실패했습니다.' });
    }
});

// 지출 내역 조회 API (관리자만 가능)
app.get('/api/expenses', async (req, res) => {
    try {
        const { trainer, startDate, endDate, limit, offset } = req.query;
        
        const filters = {};
        if (trainer) filters.trainer = trainer;
        if (startDate) filters.startDate = startDate;
        if (endDate) filters.endDate = endDate;
        if (limit) filters.limit = parseInt(limit);
        if (offset) filters.offset = parseInt(offset);
        
        const expenses = await expensesDB.getExpenses(filters);
        
        // 트레이너 이름 매핑을 위한 계정 정보 조회
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const trainerMap = {};
        accounts.forEach(acc => {
            if (acc.role === 'trainer') {
                // 이름에서 "(아이디)" 형식 제거하여 이름만 저장
                const nameOnly = acc.name ? acc.name.replace(/\s*\([^)]*\)\s*$/, '').trim() : acc.username;
                trainerMap[acc.username] = nameOnly;
            }
        });
        
        // 트레이너 이름 추가 및 함께 지출한 트레이너 이름 매핑
        const expensesWithNames = expenses.map(expense => {
            const participantNames = (expense.participantTrainers || []).map(username => {
                const name = trainerMap[username];
                if (name) {
                    // 이름에서 "(아이디)" 형식 제거
                    return name.replace(/\s*\([^)]*\)\s*$/, '').trim();
                }
                return username;
            });
            
            const trainerName = trainerMap[expense.trainer];
            const trainerNameOnly = trainerName ? trainerName.replace(/\s*\([^)]*\)\s*$/, '').trim() : expense.trainer;
            
            return {
                ...expense,
                trainerName: trainerNameOnly,
                participantTrainerNames: participantNames
            };
        });
        
        // 요약 정보 계산
        const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);
        const summary = {
            totalAmount,
            count: expenses.length
        };
        
        res.json({
            expenses: expensesWithNames,
            total: expenses.length,
            summary
        });
    } catch (error) {
        console.error('[API] 지출 내역 조회 오류:', error);
        res.status(500).json({ message: '지출 내역 조회에 실패했습니다.' });
    }
});

// 지출 내역 수정 API
app.patch('/api/expenses/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ message: '올바른 지출 내역 ID를 입력해주세요.' });
        }
        
        // datetime 처리: datetime-local 입력값을 한국시간 TIMESTAMP로 변환
        // 입력 형식: "2025-01-15T12:30" 또는 "2025-01-15T12:30:00" (로컬 시간)
        // 저장 형식: "2025-01-15 12:30:00+09:00" (한국시간)
        const updates = { ...req.body };
        if (updates.datetime) {
            try {
                // datetime-local 형식인 경우
                if (updates.datetime.includes('T')) {
                    // 한국시간으로 해석 (UTC+9)
                    const [datePart, timePart] = updates.datetime.split('T');
                    // 시간 부분에서 초 제거 (이미 있을 수 있음)
                    const timeOnly = timePart.split(':').slice(0, 2).join(':');
                    updates.datetime = `${datePart} ${timeOnly}:00+09:00`;
                } else if (!updates.datetime.includes('+')) {
                    // TIMESTAMP 형식이지만 타임존 정보가 없는 경우
                    updates.datetime = updates.datetime + '+09:00';
                }
            } catch (error) {
                return res.status(400).json({ message: '올바른 날짜 형식을 입력해주세요.' });
            }
        }
        
        const result = await expensesDB.updateExpense(id, updates);
        res.json({ message: '지출 내역이 수정되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 지출 내역 수정 오류:', error);
        if (error.message === '지출 내역을 찾을 수 없습니다.') {
            res.status(404).json({ message: '지출 내역을 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '지출 내역 수정에 실패했습니다.' });
        }
    }
});

// 지출 내역 삭제 API (관리자만 가능)
app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ message: '올바른 지출 내역 ID를 입력해주세요.' });
        }
        
        await expensesDB.deleteExpense(id);
        
        res.json({ message: '지출 내역이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 지출 내역 삭제 오류:', error);
        if (error.message === '지출 내역을 찾을 수 없습니다.') {
            res.status(404).json({ message: '지출 내역을 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '지출 내역 삭제에 실패했습니다.' });
        }
    }
});

// 매출 엑셀 파일 업로드 및 저장 API
app.post('/api/sales/upload-excel', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '파일을 선택해주세요.' });
        }

        // 파일 크기 검증 (10MB 제한)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: '파일 크기는 10MB 이하여야 합니다.' });
        }

        // 엑셀 파일 읽기
        let workbook;
        try {
            workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            
            if (workbook.worksheets.length === 0) {
                return res.status(400).json({ message: '엑셀 파일에 시트가 없습니다.' });
            }
        } catch (excelError) {
            console.error('[API] 엑셀 파일 읽기 오류:', excelError);
            return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' });
        }

        // 헬퍼 함수: 띄어쓰기 제거 후 비교
        const normalizeHeader = (header) => {
            if (!header) return '';
            return String(header).trim().replace(/\s+/g, ''); // 모든 공백 제거
        };

        // 시트 이름에서 연월 추출 (예: "25.01" -> "2025-01")
        const parseYearMonth = (sheetName) => {
            const match = String(sheetName).match(/^(\d{2})\.(\d{2})$/);
            if (!match) return null;
            const year = parseInt(match[1], 10);
            const month = match[2];
            // 2000년대 가정 (25 -> 2025)
            const fullYear = year < 50 ? 2000 + year : 1900 + year;
            return `${fullYear}-${month}`;
        };

        const allResults = [];
        let totalSaved = 0;
        let totalSkipped = 0;

        // 각 시트 처리
        for (const worksheet of workbook.worksheets) {
            const sheetName = worksheet.name.trim();
            const yearMonth = parseYearMonth(sheetName);
            
            if (!yearMonth) {
                console.log(`[API] 시트 "${sheetName}"의 연월 형식을 인식할 수 없습니다. (예: 25.01)`);
                totalSkipped++;
                continue;
            }

            // 최대 컬럼 수 확인
            let maxColumnCount = 0;
            worksheet.eachRow((row) => {
                row.eachCell((cell, colNumber) => {
                    if (colNumber > maxColumnCount) {
                        maxColumnCount = colNumber;
                    }
                });
            });

            // 모든 행 읽기
            const rows = [];
            worksheet.eachRow((row) => {
                const rowData = new Array(maxColumnCount).fill(null);
                row.eachCell((cell, colNumber) => {
                    rowData[colNumber - 1] = cell.value;
                });
                rows.push(rowData);
            });

            if (rows.length < 2) {
                console.log(`[API] 시트 "${sheetName}"에 데이터가 없습니다. (헤더 제외 최소 1개 행 필요)`);
                totalSkipped++;
                continue;
            }

            // 헤더 확인 (첫 번째 행)
            const headers = rows[0];
            if (!headers || headers.length === 0) {
                console.log(`[API] 시트 "${sheetName}"의 헤더를 읽을 수 없습니다.`);
                totalSkipped++;
                continue;
            }

            // 정규화된 헤더 맵 생성
            const normalizedHeaders = headers.map((h, idx) => ({
                original: String(h || '').trim(),
                normalized: normalizeHeader(h),
                index: idx
            }));

            // 컬럼 인덱스 찾기
            const findColumnIndex = (targetKeys) => {
                const normalizedTargets = Array.isArray(targetKeys) 
                    ? targetKeys.map(k => normalizeHeader(k))
                    : [normalizeHeader(targetKeys)];
                const found = normalizedHeaders.find(h => normalizedTargets.includes(h.normalized));
                return found ? found.index : -1;
            };

            // 필수 컬럼 찾기
            const dateIndex = findColumnIndex(['날짜', '일자', 'date']);
            const memberNameIndex = findColumnIndex(['회원명', '회원이름', '이름', 'membername', 'name']);
            const amountIndex = findColumnIndex(['금액', 'amount', '매출금액']);

            // 필수 컬럼 존재 여부 확인
            const missingColumns = [];
            if (dateIndex === -1) missingColumns.push('날짜');
            if (memberNameIndex === -1) missingColumns.push('회원명');
            if (amountIndex === -1) missingColumns.push('금액');

            if (missingColumns.length > 0) {
                console.log(`[API] 시트 "${sheetName}"에서 필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`);
                totalSkipped++;
                continue;
            }

            // 선택 컬럼 찾기
            const membershipIndex = findColumnIndex(['회원권', 'membership']);
            const paymentMethodIndex = findColumnIndex(['결제방법', '결제', 'paymentmethod', 'payment']);
            const notesIndex = findColumnIndex(['비고', 'notes', '메모', 'memo']);
            const isNewIndex = findColumnIndex(['신규', 'isnew', 'is_new']);

            // 데이터 처리 (헤더 제외)
            const salesToSave = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length === 0 || row.every(cell => !cell)) continue; // 빈 행 스킵

                const dateValue = row[dateIndex];
                const memberName = String(row[memberNameIndex] || '').trim();
                const amountValue = row[amountIndex];

                // 필수 필드 검증
                if (!dateValue || !memberName || amountValue === null || amountValue === undefined) {
                    continue;
                }

                // 날짜 처리
                let dateStr;
                if (dateValue instanceof Date) {
                    // Date 객체인 경우
                    const year = dateValue.getFullYear();
                    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
                    const day = String(dateValue.getDate()).padStart(2, '0');
                    dateStr = `${year}-${month}-${day}`;
                } else {
                    // 문자열인 경우 (예: "2025-01-15" 또는 "2025/01/15")
                    const dateStrRaw = String(dateValue).trim();
                    // 다양한 날짜 형식 처리
                    if (dateStrRaw.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        dateStr = dateStrRaw;
                    } else if (dateStrRaw.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                        dateStr = dateStrRaw.replace(/\//g, '-');
                    } else {
                        // Excel 날짜 숫자로 저장된 경우 처리 (선택사항)
                        try {
                            const excelDate = parseFloat(dateStrRaw);
                            if (!isNaN(excelDate)) {
                                // Excel 날짜는 1900-01-01부터의 일수
                                const baseDate = new Date(1900, 0, 1);
                                baseDate.setDate(baseDate.getDate() + excelDate - 2); // Excel은 1900-01-01을 1로 계산
                                const year = baseDate.getFullYear();
                                const month = String(baseDate.getMonth() + 1).padStart(2, '0');
                                const day = String(baseDate.getDate()).padStart(2, '0');
                                dateStr = `${year}-${month}-${day}`;
                            } else {
                                continue; // 날짜 형식을 인식할 수 없으면 스킵
                            }
                        } catch (e) {
                            continue; // 날짜 변환 실패 시 스킵
                        }
                    }
                }

                // 금액 처리
                let amount;
                if (typeof amountValue === 'number') {
                    amount = Math.round(amountValue);
                } else {
                    const amountStr = String(amountValue).trim().replace(/,/g, ''); // 쉼표 제거
                    amount = parseInt(amountStr, 10);
                    if (isNaN(amount)) {
                        continue; // 금액을 숫자로 변환할 수 없으면 스킵
                    }
                }

                // 선택 필드 처리
                const membership = membershipIndex !== -1 ? String(row[membershipIndex] || '').trim() : null;
                const paymentMethod = paymentMethodIndex !== -1 ? String(row[paymentMethodIndex] || '').trim() : null;
                const notes = notesIndex !== -1 ? String(row[notesIndex] || '').trim() : null;
                
                // 신규 여부 처리: "신규" 컬럼에 값이 있으면 true, 없으면 false
                let isNew = false;
                if (isNewIndex !== -1) {
                    const isNewValue = row[isNewIndex];
                    // 값이 있고, 빈 문자열이 아니면 true
                    if (isNewValue !== null && isNewValue !== undefined && String(isNewValue).trim() !== '') {
                        isNew = true;
                    }
                }

                salesToSave.push({
                    date: dateStr,
                    memberName: memberName,
                    isNew: isNew,
                    membership: membership || null,
                    paymentMethod: paymentMethod || null,
                    amount: amount,
                    notes: notes || ''
                });
            }

            // DB에 저장
            let savedCount = 0;
            for (const sale of salesToSave) {
                try {
                    await salesDB.addSale(sale);
                    savedCount++;
                } catch (error) {
                    console.error(`[API] 매출 저장 오류 (시트: ${sheetName}, 회원: ${sale.memberName}):`, error);
                }
            }

            totalSaved += savedCount;
            allResults.push({
                sheetName: sheetName,
                yearMonth: yearMonth,
                savedCount: savedCount,
                totalRows: salesToSave.length
            });
        }

        res.json({
            message: `매출 엑셀 파일 업로드가 완료되었습니다.`,
            results: allResults,
            summary: {
                totalSheets: workbook.worksheets.length,
                processedSheets: allResults.length,
                skippedSheets: totalSkipped,
                totalSaved: totalSaved
            }
        });

    } catch (error) {
        console.error('[API] 매출 엑셀 파일 업로드 오류:', error);
        res.status(500).json({ message: '매출 엑셀 파일 업로드에 실패했습니다.' });
    }
});

// 월별 매출 목록 조회 API
app.get('/api/sales/by-month', async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        
        if (!year || isNaN(year)) {
            return res.status(400).json({ message: '연도가 필요합니다.' });
        }
        
        const months = await salesDB.getSalesByMonth(year);
        res.json({ months });
    } catch (error) {
        console.error('[API] 월별 매출 목록 조회 오류:', error);
        res.status(500).json({ message: '월별 매출 목록 조회에 실패했습니다.' });
    }
});

// 매출 내역 추가 API
app.post('/api/sales', async (req, res) => {
    try {
        const { date, memberName, isNew, membership, paymentMethod, amount, notes, currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        // 필수 필드 검증
        if (!date || !memberName || amount === undefined) {
            return res.status(400).json({ message: '날짜, 회원명, 금액은 필수 항목입니다.' });
        }
        
        const saleData = {
            date,
            memberName: memberName.trim(),
            isNew: isNew || false,
            membership: membership ? membership.trim() : null,
            paymentMethod: paymentMethod ? paymentMethod.trim() : null,
            amount: parseInt(amount) || 0,
            notes: notes ? notes.trim() : null
        };
        
        const sale = await salesDB.addSale(saleData);
        
        res.json({ 
            message: '매출 내역이 추가되었습니다.',
            sale
        });
    } catch (error) {
        console.error('[API] 매출 내역 추가 오류:', error);
        res.status(500).json({ message: '매출 내역 추가에 실패했습니다.' });
    }
});

// 월별 매출 상세 조회 API
app.get('/api/sales', async (req, res) => {
    try {
        const filters = {};
        
        // startDate와 endDate가 직접 제공되면 우선 사용
        if (req.query.startDate && req.query.endDate) {
            filters.startDate = req.query.startDate;
            filters.endDate = req.query.endDate;
        } else if (req.query.yearMonth) {
            // YYYY-MM 형식의 yearMonth를 startDate와 endDate로 변환
            const [year, month] = req.query.yearMonth.split('-');
            if (year && month) {
                filters.startDate = `${year}-${month}-01`;
                // 해당 월의 마지막 날 계산
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                filters.endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
            }
        }
        
        if (req.query.memberName) {
            // 공백 제거 후 빈 문자열이 아니면 필터에 추가
            const memberName = req.query.memberName.trim();
            if (memberName) {
                filters.memberName = memberName;
            }
        }
        
        const sales = await salesDB.getSales(filters);
        
        // 요약 정보 계산
        const totalAmount = sales.reduce((sum, s) => sum + s.amount, 0);
        const summary = {
            totalAmount,
            count: sales.length
        };
        
        res.json({
            sales,
            total: sales.length,
            summary
        });
    } catch (error) {
        console.error('[API] 매출 조회 오류:', error);
        res.status(500).json({ message: '매출 조회에 실패했습니다.' });
    }
});

// 매출 내역 수정 API
app.patch('/api/sales/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ message: '올바른 매출 ID를 입력해주세요.' });
        }
        
        const { currentUser, ...saleData } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        const updatedSale = await salesDB.updateSale(id, saleData);
        
        res.json({ 
            message: '매출 내역이 수정되었습니다.',
            sale: updatedSale
        });
    } catch (error) {
        console.error('[API] 매출 내역 수정 오류:', error);
        if (error.message === '매출 내역을 찾을 수 없습니다.') {
            res.status(404).json({ message: '매출 내역을 찾을 수 없습니다.' });
        } else if (error.message === '수정할 필드가 없습니다.') {
            res.status(400).json({ message: '수정할 필드가 없습니다.' });
        } else {
            res.status(500).json({ message: '매출 내역 수정에 실패했습니다.' });
        }
    }
});

// 매출 내역 삭제 API
app.delete('/api/sales/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ message: '올바른 매출 ID를 입력해주세요.' });
        }
        
        const { currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        await salesDB.deleteSale(id);
        
        res.json({ message: '매출 내역이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 매출 내역 삭제 오류:', error);
        if (error.message === '매출 내역을 찾을 수 없습니다.') {
            res.status(404).json({ message: '매출 내역을 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '매출 내역 삭제에 실패했습니다.' });
        }
    }
});

// 매출 내역 전체 삭제 API (관리자만 가능)
app.delete('/api/sales/all', async (req, res) => {
    try {
        const { currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자만 매출 데이터를 삭제할 수 있습니다.' });
        }
        
        const result = await salesDB.deleteAllSales();
        
        res.json({ 
            message: '모든 매출 데이터가 삭제되었습니다.',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('[API] 매출 데이터 전체 삭제 오류:', error);
        res.status(500).json({ message: '매출 데이터 삭제에 실패했습니다.' });
    }
});

// ============================================
// 상담기록 API
// ============================================

// 상담기록 추가
app.post('/api/consultation-records', async (req, res) => {
    try {
        const { currentUser, ...recordData } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        // 필수 필드 검증
        if (!recordData.name || !recordData.trainer_username || !recordData.center) {
            return res.status(400).json({ message: '이름, 센터, 담당 트레이너는 필수 항목입니다.' });
        }
        
        const record = await consultationRecordsDB.addConsultationRecord(recordData);
        
        res.status(201).json(record);
    } catch (error) {
        console.error('[API] 상담기록 추가 오류:', error);
        res.status(500).json({ message: '상담기록 추가에 실패했습니다.' });
    }
});

// 상담기록 목록 조회
app.get('/api/consultation-records', async (req, res) => {
    try {
        const { currentUser, center, trainer, startDate, endDate } = req.query;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        const filters = {};
        if (center && center.trim() !== '') filters.center = center.trim();
        if (trainer && trainer.trim() !== '') filters.trainer = trainer.trim();
        if (startDate && startDate.trim() !== '') filters.startDate = startDate.trim();
        if (endDate && endDate.trim() !== '') filters.endDate = endDate.trim();
        
        const records = await consultationRecordsDB.getConsultationRecords(filters);
        
        res.json({ records });
    } catch (error) {
        console.error('[API] 상담기록 목록 조회 오류:', error);
        res.status(500).json({ message: '상담기록 조회에 실패했습니다.' });
    }
});

// 상담기록 단건 조회
app.get('/api/consultation-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        const record = await consultationRecordsDB.getConsultationRecordById(id);
        
        if (!record) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 상담기록 단건 조회 오류:', error);
        res.status(500).json({ message: '상담기록 조회에 실패했습니다.' });
    }
});

// 상담기록 수정
app.patch('/api/consultation-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser, ...updates } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        const record = await consultationRecordsDB.updateConsultationRecord(id, updates);
        
        if (!record) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 이름 또는 전화번호가 변경되었으면 연결된 공유 토큰도 업데이트
        if (updates.name !== undefined || updates.phone !== undefined) {
            const shareUpdates = {};
            if (updates.name !== undefined) {
                shareUpdates.name = updates.name;
            }
            if (updates.phone !== undefined) {
                shareUpdates.phone = updates.phone;
            }
            
            try {
                await consultationSharesDB.updateShareTokensByConsultationId(id, shareUpdates);
            } catch (shareUpdateError) {
                console.error('[API] 공유 토큰 업데이트 오류:', shareUpdateError);
                // 공유 토큰 업데이트 실패해도 상담기록 업데이트는 성공으로 처리
            }
        }
        
        res.json(record);
    } catch (error) {
        console.error('[API] 상담기록 수정 오류:', error);
        res.status(500).json({ message: '상담기록 수정에 실패했습니다.' });
    }
});

// 상담기록 삭제
app.delete('/api/consultation-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        // 삭제 전에 동영상 및 사진 폴더도 삭제
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        
        if (consultation) {
            // 동영상 폴더 삭제 (파일 URL에서 폴더 경로 추출)
            if (consultation.video_urls) {
                const videos = Array.isArray(consultation.video_urls) 
                    ? consultation.video_urls 
                    : (typeof consultation.video_urls === 'string' ? JSON.parse(consultation.video_urls) : []);
                
                if (videos.length > 0) {
                    try {
                        // 첫 번째 동영상 URL에서 폴더 경로 추출
                        // URL 형식: /uploads/consultation-videos/{year}/{month}/{consultation_id}/{filename}
                        const firstVideoUrl = videos[0].url;
                        const urlPath = firstVideoUrl.replace(/^\/uploads\//, '');
                        const filePath = path.join(UPLOADS_DIR, urlPath);
                        const videoDir = path.dirname(filePath); // 파일이 있는 폴더
                        
                        if (fs.existsSync(videoDir)) {
                            fs.rmSync(videoDir, { recursive: true, force: true });
                        }
                    } catch (fileError) {
                        console.error('[API] 동영상 폴더 삭제 오류:', fileError);
                    }
                }
            }
            
            // 사진 폴더 삭제 (파일 URL에서 폴더 경로 추출)
            if (consultation.image_urls) {
                const images = Array.isArray(consultation.image_urls) 
                    ? consultation.image_urls 
                    : (typeof consultation.image_urls === 'string' ? JSON.parse(consultation.image_urls) : []);
                
                if (images.length > 0) {
                    try {
                        // 첫 번째 사진 URL에서 폴더 경로 추출
                        // URL 형식: /uploads/consultation-images/{year}/{month}/{consultation_id}/{filename}
                        const firstImageUrl = images[0].url;
                        const urlPath = firstImageUrl.replace(/^\/uploads\//, '');
                        const filePath = path.join(UPLOADS_DIR, urlPath);
                        const imageDir = path.dirname(filePath); // 파일이 있는 폴더
                        
                        if (fs.existsSync(imageDir)) {
                            fs.rmSync(imageDir, { recursive: true, force: true });
                        }
                    } catch (fileError) {
                        console.error('[API] 사진 폴더 삭제 오류:', fileError);
                    }
                }
            }
        }
        
        const deleted = await consultationRecordsDB.deleteConsultationRecord(id);
        
        if (!deleted) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        res.json({ message: '상담기록이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 상담기록 삭제 오류:', error);
        res.status(500).json({ message: '상담기록 삭제에 실패했습니다.' });
    }
});

// 상담기록 동영상 업로드
app.post('/api/consultation-records/:id/videos', videoUpload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: '동영상 파일을 선택해주세요.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 기존 동영상 개수 확인 (최대 4개)
        const maxVideos = parseInt(process.env.CONSULTATION_VIDEO_MAX_COUNT || '4', 10);
        const existingVideos = consultation.video_urls ? (Array.isArray(consultation.video_urls) ? consultation.video_urls : JSON.parse(consultation.video_urls)) : [];
        
        if (existingVideos.length >= maxVideos) {
            return res.status(400).json({ message: `동영상은 최대 ${maxVideos}개까지 업로드 가능합니다.` });
        }
        
        // 파일 저장 경로 생성
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const videoId = uuidv4();
        const fileExt = path.extname(req.file.originalname);
        const videoDir = path.join(CONSULTATION_VIDEOS_DIR, String(year), month, id);
        const videoFileName = `${videoId}${fileExt}`;
        const videoPath = path.join(videoDir, videoFileName);
        
        // 디렉토리 생성
        if (!fs.existsSync(videoDir)) {
            fs.mkdirSync(videoDir, { recursive: true });
        }
        
        // 파일 저장
        fs.writeFileSync(videoPath, req.file.buffer);
        
        // 상대 경로 생성 (URL용) - /uploads/... 형식
        const relativePath = path.join('uploads', 'consultation-videos', String(year), month, id, videoFileName).replace(/\\/g, '/');
        
        // 동영상 메타데이터 생성
        const videoMetadata = {
            id: videoId,
            url: `/${relativePath}`,
            filename: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            uploaded_at: new Date().toISOString(),
            uploaded_by: currentUser
        };
        
        // 기존 동영상 배열에 추가
        existingVideos.push(videoMetadata);
        
        // 상담기록 업데이트
        const updated = await consultationRecordsDB.updateConsultationRecord(id, {
            video_urls: existingVideos
        });
        
        res.json({
            video: videoMetadata
        });
    } catch (error) {
        console.error('[API] 동영상 업로드 오류:', error);
        res.status(500).json({ message: '동영상 업로드에 실패했습니다.' });
    }
});

// 상담기록 동영상 이름 수정
app.patch('/api/consultation-records/:id/videos/:videoId', async (req, res) => {
    try {
        const { id, videoId } = req.params;
        const { currentUser, filename } = req.body;
        
        if (!filename || typeof filename !== 'string' || !filename.trim()) {
            return res.status(400).json({ message: '동영상 이름을 입력해주세요.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 동영상 목록 가져오기
        const videos = consultation.video_urls ? (Array.isArray(consultation.video_urls) ? consultation.video_urls : JSON.parse(consultation.video_urls)) : [];
        const videoIndex = videos.findIndex(v => v.id === videoId);
        
        if (videoIndex === -1) {
            return res.status(404).json({ message: '동영상을 찾을 수 없습니다.' });
        }
        
        // 동영상 이름 업데이트
        videos[videoIndex].filename = filename.trim();
        
        // 상담기록 업데이트
        await consultationRecordsDB.updateConsultationRecord(id, {
            video_urls: videos
        });
        
        res.json({
            video: videos[videoIndex]
        });
    } catch (error) {
        console.error('[API] 동영상 이름 수정 오류:', error);
        res.status(500).json({ message: '동영상 이름 수정에 실패했습니다.' });
    }
});

// 상담기록 동영상 삭제
app.delete('/api/consultation-records/:id/videos/:videoId', async (req, res) => {
    try {
        const { id, videoId } = req.params;
        const { currentUser } = req.body;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 동영상 배열 파싱
        let videos = consultation.video_urls ? (Array.isArray(consultation.video_urls) ? consultation.video_urls : JSON.parse(consultation.video_urls)) : [];
        
        // 삭제할 동영상 찾기
        const videoIndex = videos.findIndex(v => v.id === videoId);
        if (videoIndex === -1) {
            return res.status(404).json({ message: '동영상을 찾을 수 없습니다.' });
        }
        
        const videoToDelete = videos[videoIndex];
        
        // 파일 시스템에서 삭제
        try {
            // URL이 /uploads/... 형식이므로 UPLOADS_DIR 기준으로 경로 변환
            const urlPath = videoToDelete.url.replace(/^\/uploads\//, '');
            const filePath = path.join(UPLOADS_DIR, urlPath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (fileError) {
            console.error('[API] 동영상 파일 삭제 오류:', fileError);
            // 파일 삭제 실패해도 DB에서는 제거
        }
        
        // 배열에서 제거
        videos.splice(videoIndex, 1);
        
        // 상담기록 업데이트
        await consultationRecordsDB.updateConsultationRecord(id, {
            video_urls: videos
        });
        
        res.json({ message: '동영상이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 동영상 삭제 오류:', error);
        res.status(500).json({ message: '동영상 삭제에 실패했습니다.' });
    }
});

// 상담기록 사진 업로드
app.post('/api/consultation-records/:id/images', consultationImageUpload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: '사진 파일을 선택해주세요.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 기존 사진 개수 확인 (최대 4개)
        const maxImages = parseInt(process.env.CONSULTATION_IMAGE_MAX_COUNT || '4', 10);
        const existingImages = consultation.image_urls ? (Array.isArray(consultation.image_urls) ? consultation.image_urls : JSON.parse(consultation.image_urls)) : [];
        
        if (existingImages.length >= maxImages) {
            return res.status(400).json({ message: `사진은 최대 ${maxImages}개까지 업로드 가능합니다.` });
        }
        
        // 파일 저장 경로 생성
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const imageId = uuidv4();
        const fileExt = path.extname(req.file.originalname);
        const imageDir = path.join(CONSULTATION_IMAGES_DIR, String(year), month, id);
        const imageFileName = `${imageId}${fileExt}`;
        const imagePath = path.join(imageDir, imageFileName);
        
        // 디렉토리 생성
        if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
        }
        
        // 파일 저장
        fs.writeFileSync(imagePath, req.file.buffer);
        
        // 상대 경로 생성 (URL용) - /uploads/... 형식
        const relativePath = path.join('uploads', 'consultation-images', String(year), month, id, imageFileName).replace(/\\/g, '/');
        
        // 사진 메타데이터 생성
        const imageMetadata = {
            id: imageId,
            url: `/${relativePath}`,
            filename: req.file.originalname,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            uploaded_at: new Date().toISOString(),
            uploaded_by: currentUser
        };
        
        // 기존 사진 배열에 추가
        existingImages.push(imageMetadata);
        
        // 상담기록 업데이트
        const updated = await consultationRecordsDB.updateConsultationRecord(id, {
            image_urls: existingImages
        });
        
        res.json({
            image: imageMetadata
        });
    } catch (error) {
        console.error('[API] 사진 업로드 오류:', error);
        res.status(500).json({ message: '사진 업로드에 실패했습니다.' });
    }
});

// 상담기록 사진 이름 수정
app.patch('/api/consultation-records/:id/images/:imageId', async (req, res) => {
    try {
        const { id, imageId } = req.params;
        const { currentUser, filename } = req.body;
        
        if (!filename || typeof filename !== 'string' || !filename.trim()) {
            return res.status(400).json({ message: '사진 이름을 입력해주세요.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 사진 목록 가져오기
        const images = consultation.image_urls ? (Array.isArray(consultation.image_urls) ? consultation.image_urls : JSON.parse(consultation.image_urls)) : [];
        const imageIndex = images.findIndex(img => img.id === imageId);
        
        if (imageIndex === -1) {
            return res.status(404).json({ message: '사진을 찾을 수 없습니다.' });
        }
        
        // 사진 이름 업데이트
        images[imageIndex].filename = filename.trim();
        images[imageIndex].updated_at = new Date().toISOString();
        
        // 상담기록 업데이트
        await consultationRecordsDB.updateConsultationRecord(id, {
            image_urls: images
        });
        
        res.json({
            message: '사진 이름이 업데이트되었습니다.',
            image: images[imageIndex]
        });
    } catch (error) {
        console.error('[API] 사진 이름 수정 오류:', error);
        res.status(500).json({ message: '사진 이름 수정에 실패했습니다.' });
    }
});

// 상담기록 사진 삭제
app.delete('/api/consultation-records/:id/images/:imageId', async (req, res) => {
    try {
        const { id, imageId } = req.params;
        const { currentUser } = req.body;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 사진 배열 파싱
        let images = consultation.image_urls ? (Array.isArray(consultation.image_urls) ? consultation.image_urls : JSON.parse(consultation.image_urls)) : [];
        
        // 삭제할 사진 찾기
        const imageIndex = images.findIndex(img => img.id === imageId);
        if (imageIndex === -1) {
            return res.status(404).json({ message: '사진을 찾을 수 없습니다.' });
        }
        
        const imageToDelete = images[imageIndex];
        
        // 파일 시스템에서 삭제
        try {
            // URL이 /uploads/... 형식이므로 UPLOADS_DIR 기준으로 경로 변환
            const urlPath = imageToDelete.url.replace(/^\/uploads\//, '');
            const filePath = path.join(UPLOADS_DIR, urlPath);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        } catch (fileError) {
            console.error('[API] 사진 파일 삭제 오류:', fileError);
            // 파일 삭제 실패해도 DB에서 제거는 진행
        }
        
        // 배열에서 제거
        images.splice(imageIndex, 1);
        
        // 상담기록 업데이트
        await consultationRecordsDB.updateConsultationRecord(id, {
            image_urls: images
        });
        
        res.json({ message: '사진이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 사진 삭제 오류:', error);
        res.status(500).json({ message: '사진 삭제에 실패했습니다.' });
    }
});

// 상담기록 공유 링크 생성
app.post('/api/consultation-records/:id/share', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser, name, phone, expiresInDays } = req.body;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인: admin/su는 모든 상담기록, trainer는 본인 작성만
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 필수 필드 검증
        if (!name) {
            return res.status(400).json({ message: '회원 이름은 필수입니다.' });
        }
        
        // 기존 활성 공개상담지 확인
        const existingShares = await consultationSharesDB.getShareTokensByConsultationId(id);
        const now = new Date();
        
        // 활성 토큰 찾기 (is_active = true이고 만료되지 않은 토큰)
        const activeShare = existingShares.find(share => {
            if (!share.is_active) return false;
            if (!share.expires_at) return true; // 만료일이 없으면 활성
            const expiresAt = new Date(share.expires_at);
            return expiresAt > now;
        });
        
        // 기존 활성 공개상담지가 있으면 에러 반환
        if (activeShare) {
            return res.status(409).json({ 
                message: '이미 활성화된 공개상담지가 존재합니다. 기존 상담지를 사용하거나 비활성화 후 다시 시도해주세요.',
                existingToken: activeShare.token
            });
        }
        
        // 활성 토큰이 없으면 새로 생성
        // 만료일 계산 (기본 90일)
        const expiresIn = expiresInDays || 90;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresIn);
        
        // 공유 토큰 생성
        const shareToken = await consultationSharesDB.createShareToken({
            consultation_record_id: id,
            name: name,
            phone: phone || null,
            expires_at: expiresAt,
            created_by: currentUser
        });
        
        if (!shareToken) {
            return res.status(500).json({ message: '공유 링크 생성에 실패했습니다.' });
        }
        
        // 전체 URL 생성
        let baseUrl = process.env.PUBLIC_URL;
        if (!baseUrl) {
            const protocol = req.protocol || (req.secure ? 'https' : 'http');
            const host = req.get('host');
            if (host) {
                baseUrl = `${protocol}://${host}`;
            } else {
                baseUrl = process.env.NODE_ENV === 'production' 
                    ? 'https://goodlift.onrender.com' 
                    : 'http://localhost:3000';
            }
        }
        const shareUrl = `${baseUrl}/consultation/view/${shareToken.token}`;
        
        res.json({
            token: shareToken.token,
            shareUrl: shareUrl,
            expiresAt: shareToken.expires_at
        });
    } catch (error) {
        console.error('[API] 공유 링크 생성 오류:', error);
        res.status(500).json({ message: '공유 링크 생성에 실패했습니다.' });
    }
});

// 공개 상담기록 조회 (토큰 기반)
app.get('/api/public/consultation/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        // 토큰으로 공유 정보 조회
        const shareToken = await consultationSharesDB.getShareTokenByToken(token);
        
        if (!shareToken) {
            return res.status(404).json({ error: 'NOT_FOUND', message: '링크를 찾을 수 없습니다.' });
        }
        
        // 비활성화 확인
        if (!shareToken.is_active) {
            return res.status(403).json({ error: 'TOKEN_DISABLED', message: '비활성화된 링크입니다.' });
        }
        
        // 만료 확인
        if (shareToken.expires_at) {
            const expiresAt = new Date(shareToken.expires_at);
            if (expiresAt < new Date()) {
                return res.status(403).json({ error: 'EXPIRED_TOKEN', message: '만료된 링크입니다.' });
            }
        }
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(shareToken.consultation_record_id);
        
        if (!consultation) {
            return res.status(404).json({ error: 'NOT_FOUND', message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 트레이너 이름 조회
        if (consultation.trainer_username) {
            try {
                let accounts = [];
                if (fs.existsSync(DATA_PATH)) {
                    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                    if (raw) accounts = JSON.parse(raw);
                }
                const trainer = accounts.find(acc => acc.role === 'trainer' && acc.username === consultation.trainer_username);
                if (trainer) {
                    // trainer.name이 있으면 사용, 없으면 username 사용
                    consultation.trainer_name = (trainer.name && trainer.name.trim()) ? trainer.name : consultation.trainer_username;
                } else {
                    consultation.trainer_name = consultation.trainer_username;
                }
            } catch (error) {
                console.error('[API] 트레이너 이름 조회 오류:', error);
                consultation.trainer_name = consultation.trainer_username;
            }
        }
        
        // 접근 횟수 증가
        await consultationSharesDB.incrementAccessCount(token);
        
        res.json({
            consultation: consultation,
            shareInfo: {
                expiresAt: shareToken.expires_at,
                accessCount: shareToken.access_count + 1
            }
        });
    } catch (error) {
        console.error('[API] 공개 상담기록 조회 오류:', error);
        res.status(500).json({ error: 'SERVER_ERROR', message: '상담기록 조회에 실패했습니다.' });
    }
});

// 상담기록의 공유 링크 목록 조회
app.get('/api/consultation-records/:id/shares', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        const isAdminOrSu = userAccount.role === 'admin' || userAccount.role === 'su';
        const isTrainer = userAccount.role === 'trainer';
        
        // 상담기록 조회
        const consultation = await consultationRecordsDB.getConsultationRecordById(id);
        if (!consultation) {
            return res.status(404).json({ message: '상담기록을 찾을 수 없습니다.' });
        }
        
        // 권한 확인
        if (!isAdminOrSu && (isTrainer && consultation.trainer_username !== currentUser)) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 공유 링크 목록 조회
        const shares = await consultationSharesDB.getShareTokensByConsultationId(id);
        
        res.json({ shares: shares });
    } catch (error) {
        console.error('[API] 공유 링크 목록 조회 오류:', error);
        res.status(500).json({ message: '공유 링크 목록 조회에 실패했습니다.' });
    }
});

// 모든 활성 공개상담 목록 조회
app.get('/api/consultation-shares/active', async (req, res) => {
    try {
        const { currentUser } = req.query;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        if (!isAdminOrSu(userAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        // 활성 공개상담 목록 조회
        const shares = await consultationSharesDB.getAllActiveShareTokens();
        
        // 트레이너 이름 매핑
        const trainerUsernameSet = new Set();
        shares.forEach(share => {
            if (share.trainer_username) {
                trainerUsernameSet.add(share.trainer_username);
            }
        });
        
        // 트레이너 목록 조회
        const trainerNameMap = {};
        if (trainerUsernameSet.size > 0) {
            accounts.forEach(acc => {
                if (acc.role === 'trainer' && trainerUsernameSet.has(acc.username)) {
                    trainerNameMap[acc.username] = (acc.name && acc.name.trim()) ? acc.name : acc.username;
                }
            });
        }
        
        // 각 share에 trainer_name 추가
        shares.forEach(share => {
            if (share.trainer_username) {
                share.trainer_name = trainerNameMap[share.trainer_username] || share.trainer_username;
            }
        });
        
        res.json({ shares: shares });
    } catch (error) {
        console.error('[API] 활성 공개상담 목록 조회 오류:', error);
        res.status(500).json({ message: '활성 공개상담 목록 조회에 실패했습니다.' });
    }
});

// 공개상담 삭제
app.delete('/api/consultation-shares/:shareId', async (req, res) => {
    try {
        const { shareId } = req.params;
        const { currentUser } = req.query;
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const userAccount = accounts.find(acc => acc.username === currentUser);
        if (!userAccount) {
            return res.status(401).json({ message: '인증이 필요합니다.' });
        }
        
        if (!isAdminOrSu(userAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        // 공개상담 삭제
        const deleted = await consultationSharesDB.deleteShareToken(shareId);
        
        if (!deleted) {
            return res.status(404).json({ message: '공개상담을 찾을 수 없습니다.' });
        }
        
        res.json({ message: '공개상담이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 공개상담 삭제 오류:', error);
        res.status(500).json({ message: '공개상담 삭제에 실패했습니다.' });
    }
});

// Metrics (지표) API
// Metrics 목록 조회
app.get('/api/metrics', async (req, res) => {
    try {
        const filters = {};
        if (req.query.center) filters.center = req.query.center;
        if (req.query.month) filters.month = req.query.month;
        
        const metrics = await metricsDB.getMetrics(filters);
        res.json(metrics);
    } catch (error) {
        console.error('[API] Metrics 조회 오류:', error);
        res.status(500).json({ message: '지표 조회에 실패했습니다.' });
    }
});

// Metric 추가
app.post('/api/metrics', async (req, res) => {
    try {
        const { center, month, naver_clicks, naver_leads, karrot_clicks, karrot_leads,
                pt_new, pt_consultation, pt_renewal, pt_expiring, membership_new, membership_renewal, membership_expiring,
                total_members, pt_total_members, total_sales, pt_sales, membership_sales } = req.body;
        
        if (!center || !month) {
            return res.status(400).json({ message: '센터와 연월을 입력해주세요.' });
        }
        
        // 같은 센터/월 조합이 이미 있는지 확인
        const existingMetric = await metricsDB.getMetricByCenterAndMonth(center, month);
        if (existingMetric) {
            return res.status(400).json({ message: '이미 해당 센터/월에 대한 지표가 존재합니다. 수정 기능을 사용해주세요.' });
        }
        
        const metric = {
            center,
            month,
            naver_clicks: naver_clicks || 0,
            naver_leads: naver_leads || 0,
            karrot_clicks: karrot_clicks || 0,
            karrot_leads: karrot_leads || 0,
            pt_new: pt_new || 0,
            pt_consultation: pt_consultation || 0,
            pt_renewal: pt_renewal || 0,
            pt_expiring: pt_expiring || 0,
            membership_new: membership_new || 0,
            membership_renewal: membership_renewal || 0,
            membership_expiring: membership_expiring || 0,
            total_members: total_members || 0,
            pt_total_members: pt_total_members || 0,
            total_sales: total_sales || 0,
            pt_sales: pt_sales || 0,
            membership_sales: membership_sales || 0
        };
        
        const result = await metricsDB.addMetric(metric);
        res.json({ message: '지표가 추가되었습니다.', metric: result });
    } catch (error) {
        console.error('[API] Metric 추가 오류:', error);
        if (error.code === '23505') { // UNIQUE 제약조건 위반
            res.status(400).json({ message: '이미 해당 센터/월에 대한 지표가 존재합니다.' });
        } else {
            res.status(500).json({ message: '지표 추가에 실패했습니다.' });
        }
    }
});

// Metric 수정
app.patch('/api/metrics/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const result = await metricsDB.updateMetric(id, updates);
        res.json({ message: '지표가 수정되었습니다.', metric: result });
    } catch (error) {
        console.error('[API] Metric 수정 오류:', error);
        if (error.message === 'Metric을 찾을 수 없습니다.') {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: '지표 수정에 실패했습니다.' });
        }
    }
});

// 마케팅 조회 API
app.get('/api/marketing', async (req, res) => {
    try {
        const filters = {};
        if (req.query.center) {
            filters.center = req.query.center;
        }
        if (req.query.month) {
            filters.month = req.query.month;
        }
        if (req.query.type) {
            filters.type = req.query.type;
        }
        
        const marketing = await marketingDB.getMarketing(filters);
        res.json(marketing);
    } catch (error) {
        console.error('[API] 마케팅 조회 오류:', error);
        res.status(500).json({ message: '마케팅 조회에 실패했습니다.' });
    }
});

// 마케팅 추가 API
app.post('/api/marketing', async (req, res) => {
    try {
        const { center, month, type, item, direction, target, cost, action_result, target_result } = req.body;
        
        if (!center || !month || !type || !item) {
            return res.status(400).json({ message: '센터, 월, 타입, 아이템은 필수입니다.' });
        }
        
        if (type !== 'online' && type !== 'offline') {
            return res.status(400).json({ message: '타입은 online 또는 offline이어야 합니다.' });
        }
        
        const marketing = {
            center,
            month,
            type,
            item,
            direction: direction || null,
            target: target || null,
            cost: cost ? String(cost) : '0',
            action_result: action_result || null,
            target_result: target_result || null
        };
        
        const result = await marketingDB.addMarketing(marketing);
        res.json({ message: '마케팅이 추가되었습니다.', marketing: result });
    } catch (error) {
        console.error('[API] 마케팅 추가 오류:', error);
        res.status(500).json({ message: '마케팅 추가에 실패했습니다.' });
    }
});

// 마케팅 수정 API
app.patch('/api/marketing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        if (updates.type && updates.type !== 'online' && updates.type !== 'offline') {
            return res.status(400).json({ message: '타입은 online 또는 offline이어야 합니다.' });
        }
        
        const result = await marketingDB.updateMarketing(id, updates);
        res.json({ message: '마케팅이 수정되었습니다.', marketing: result });
    } catch (error) {
        console.error('[API] 마케팅 수정 오류:', error);
        res.status(500).json({ message: '마케팅 수정에 실패했습니다.' });
    }
});

// 마케팅 삭제 API
app.delete('/api/marketing/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await marketingDB.deleteMarketing(id);
        res.json({ message: '마케팅이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 마케팅 삭제 오류:', error);
        res.status(500).json({ message: '마케팅 삭제에 실패했습니다.' });
    }
});

// 고정지출 조회 API
app.get('/api/fixed-expenses', async (req, res) => {
    try {
        const filters = {};
        if (req.query.center) filters.center = req.query.center;
        if (req.query.month) filters.month = req.query.month;
        
        const expenses = await ledgerDB.getFixedExpenses(filters);
        res.json(expenses);
    } catch (error) {
        console.error('[API] 고정지출 조회 오류:', error);
        res.status(500).json({ message: '고정지출 조회에 실패했습니다.' });
    }
});

// 고정지출 추가 API
app.post('/api/fixed-expenses', async (req, res) => {
    try {
        const { center, month, item, amount } = req.body;
        
        if (!center || !month || !item) {
            return res.status(400).json({ message: '센터, 월, 항목은 필수입니다.' });
        }
        
        const expense = {
            center,
            month,
            item,
            amount: amount || 0
        };
        
        const result = await ledgerDB.addFixedExpense(expense);
        res.json({ message: '고정지출이 추가되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 고정지출 추가 오류:', error);
        res.status(500).json({ message: '고정지출 추가에 실패했습니다.' });
    }
});

// 고정지출 수정 API
app.patch('/api/fixed-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const result = await ledgerDB.updateFixedExpense(id, updates);
        res.json({ message: '고정지출이 수정되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 고정지출 수정 오류:', error);
        res.status(500).json({ message: '고정지출 수정에 실패했습니다.' });
    }
});

// 고정지출 삭제 API
app.delete('/api/fixed-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await ledgerDB.deleteFixedExpense(id);
        res.json({ message: '고정지출이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 고정지출 삭제 오류:', error);
        res.status(500).json({ message: '고정지출 삭제에 실패했습니다.' });
    }
});

// 변동지출 조회 API
app.get('/api/variable-expenses', async (req, res) => {
    try {
        const filters = {};
        if (req.query.center) filters.center = req.query.center;
        if (req.query.month) filters.month = req.query.month;
        
        const expenses = await ledgerDB.getVariableExpenses(filters);
        res.json(expenses);
    } catch (error) {
        console.error('[API] 변동지출 조회 오류:', error);
        res.status(500).json({ message: '변동지출 조회에 실패했습니다.' });
    }
});

// 변동지출 추가 API
app.post('/api/variable-expenses', async (req, res) => {
    try {
        const { center, month, date, item, amount, note, taxType } = req.body;
        
        if (!center || !month || !item) {
            return res.status(400).json({ message: '센터, 월, 항목은 필수입니다.' });
        }
        
        const expense = {
            center,
            month,
            date: date || null,
            item,
            amount: amount || 0,
            note: note || null,
            taxType: taxType || null
        };
        
        const result = await ledgerDB.addVariableExpense(expense);
        res.json({ message: '변동지출이 추가되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 변동지출 추가 오류:', error);
        res.status(500).json({ message: '변동지출 추가에 실패했습니다.' });
    }
});

// 변동지출 수정 API
app.patch('/api/variable-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const result = await ledgerDB.updateVariableExpense(id, updates);
        res.json({ message: '변동지출이 수정되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 변동지출 수정 오류:', error);
        res.status(500).json({ message: '변동지출 수정에 실패했습니다.' });
    }
});

// 변동지출 삭제 API
app.delete('/api/variable-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await ledgerDB.deleteVariableExpense(id);
        res.json({ message: '변동지출이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 변동지출 삭제 오류:', error);
        res.status(500).json({ message: '변동지출 삭제에 실패했습니다.' });
    }
});

// 급여 조회 API
app.get('/api/salaries', async (req, res) => {
    try {
        const filters = {};
        if (req.query.center) filters.center = req.query.center;
        if (req.query.month) filters.month = req.query.month;
        
        const salaries = await ledgerDB.getSalaries(filters);
        res.json(salaries);
    } catch (error) {
        console.error('[API] 급여 조회 오류:', error);
        res.status(500).json({ message: '급여 조회에 실패했습니다.' });
    }
});

// 급여 추가 API
app.post('/api/salaries', async (req, res) => {
    try {
        const { center, month, item, amount } = req.body;
        
        if (!center || !month || !item) {
            return res.status(400).json({ message: '센터, 월, 항목은 필수입니다.' });
        }
        
        const salary = {
            center,
            month,
            item,
            amount: amount || 0
        };
        
        const result = await ledgerDB.addSalary(salary);
        res.json({ message: '급여가 추가되었습니다.', salary: result });
    } catch (error) {
        console.error('[API] 급여 추가 오류:', error);
        res.status(500).json({ message: '급여 추가에 실패했습니다.' });
    }
});

// 급여 수정 API
app.patch('/api/salaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        const result = await ledgerDB.updateSalary(id, updates);
        res.json({ message: '급여가 수정되었습니다.', salary: result });
    } catch (error) {
        console.error('[API] 급여 수정 오류:', error);
        res.status(500).json({ message: '급여 수정에 실패했습니다.' });
    }
});

// 급여 삭제 API
app.delete('/api/salaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await ledgerDB.deleteSalary(id);
        res.json({ message: '급여가 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 급여 삭제 오류:', error);
        res.status(500).json({ message: '급여 삭제에 실패했습니다.' });
    }
});

// 정산 조회 API
app.get('/api/settlements', async (req, res) => {
    try {
        const filters = {};
        if (req.query.month) filters.month = req.query.month;
        
        const settlements = await ledgerDB.getSettlements(filters);
        res.json(settlements);
    } catch (error) {
        console.error('[API] 정산 조회 오류:', error);
        res.status(500).json({ message: '정산 조회에 실패했습니다.' });
    }
});

// 정산 추가 API
app.post('/api/settlements', async (req, res) => {
    try {
        const { month, profitAmount, settlementAmount } = req.body;
        
        if (!month || profitAmount === undefined) {
            return res.status(400).json({ message: '월, 손익금액은 필수입니다.' });
        }
        
        const settlement = {
            month,
            profitAmount: profitAmount || 0,
            settlementAmount: settlementAmount || null
        };
        
        const result = await ledgerDB.addSettlement(settlement);
        res.json({ message: '정산이 추가되었습니다.', settlement: result });
    } catch (error) {
        console.error('[API] 정산 추가 오류:', error);
        if (error.code === '23505') { // UNIQUE 제약조건 위반
            res.status(400).json({ message: '이미 해당 월에 대한 정산이 존재합니다.' });
        } else {
            res.status(500).json({ message: '정산 추가에 실패했습니다.' });
        }
    }
});

// 정산 수정 API
app.patch('/api/settlements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // camelCase를 snake_case로 변환
        if (updates.profitAmount !== undefined) {
            updates.profitAmount = updates.profitAmount;
        }
        if (updates.settlementAmount !== undefined) {
            updates.settlementAmount = updates.settlementAmount;
        }
        
        const result = await ledgerDB.updateSettlement(id, updates);
        res.json({ message: '정산이 수정되었습니다.', settlement: result });
    } catch (error) {
        console.error('[API] 정산 수정 오류:', error);
        if (error.message === '정산을 찾을 수 없습니다.') {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: '정산 수정에 실패했습니다.' });
        }
    }
});

// 정산 삭제 API
app.delete('/api/settlements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await ledgerDB.deleteSettlement(id);
        res.json({ message: '정산이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 정산 삭제 오류:', error);
        if (error.message === '정산을 찾을 수 없습니다.') {
            res.status(404).json({ message: error.message });
        } else {
            res.status(500).json({ message: '정산 삭제에 실패했습니다.' });
        }
    }
});

// ========== 트레이너 장부 API ==========

// 트레이너 고정지출 조회 API
app.get('/api/trainer/fixed-expenses', async (req, res) => {
    try {
        const currentUser = req.query.currentUser || req.session?.username;
        const trainer = req.query.trainer; // SU가 특정 트레이너 조회 시 사용
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        // SU이거나 트레이너인 경우만 접근 가능
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 조회할 트레이너 결정: SU가 trainer 파라미터를 보낸 경우 해당 트레이너, 아니면 본인
        const targetTrainer = (isSU && trainer) ? trainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 조회 가능
        if (!isSU && targetTrainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 조회할 수 있습니다.' });
        }
        
        const filters = {
            trainer: targetTrainer
        };
        if (req.query.month) filters.month = req.query.month;
        
        const expenses = await trainerLedgerDB.getTrainerFixedExpenses(filters);
        res.json(expenses);
    } catch (error) {
        console.error('[API] 트레이너 고정지출 조회 오류:', error);
        res.status(500).json({ message: '트레이너 고정지출 조회에 실패했습니다.' });
    }
});

// 트레이너 고정지출 추가 API
app.post('/api/trainer/fixed-expenses', async (req, res) => {
    try {
        const { month, item, amount, currentUser, trainer: targetTrainer } = req.body;
        const currentUserAccount = currentUser || req.session?.username;
        
        if (!currentUserAccount) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUserAccount);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 저장할 트레이너 결정: SU가 targetTrainer를 보낸 경우 해당 트레이너, 아니면 본인
        const trainer = (isSU && targetTrainer) ? targetTrainer : currentUserAccount;
        
        // SU가 아닌 경우 본인 데이터만 저장 가능
        if (!isSU && trainer !== currentUserAccount) {
            return res.status(403).json({ message: '본인의 데이터만 추가할 수 있습니다.' });
        }
        
        if (!month || !item) {
            return res.status(400).json({ message: '월, 항목은 필수입니다.' });
        }
        
        const expense = {
            trainer,
            month,
            item,
            amount: amount || 0
        };
        
        const result = await trainerLedgerDB.addTrainerFixedExpense(expense);
        res.json({ message: '고정지출이 추가되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 트레이너 고정지출 추가 오류:', error);
        res.status(500).json({ message: '트레이너 고정지출 추가에 실패했습니다.' });
    }
});

// 트레이너 고정지출 수정 API
app.patch('/api/trainer/fixed-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { month, item, amount, currentUser } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allExpenses = await trainerLedgerDB.getTrainerFixedExpenses({});
        const expense = allExpenses.find(e => e.id === id);
        
        if (!expense) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 수정 가능
        if (!isSU && expense.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 수정할 수 있습니다.' });
        }
        
        const updates = {};
        if (month !== undefined) updates.month = month;
        if (item !== undefined) updates.item = item;
        if (amount !== undefined) updates.amount = amount;
        
        const result = await trainerLedgerDB.updateTrainerFixedExpense(id, updates);
        res.json({ message: '고정지출이 수정되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 트레이너 고정지출 수정 오류:', error);
        res.status(500).json({ message: '트레이너 고정지출 수정에 실패했습니다.' });
    }
});

// 트레이너 고정지출 삭제 API
app.delete('/api/trainer/fixed-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allExpenses = await trainerLedgerDB.getTrainerFixedExpenses({});
        const expense = allExpenses.find(e => e.id === id);
        
        if (!expense) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 삭제 가능
        if (!isSU && expense.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 삭제할 수 있습니다.' });
        }
        
        await trainerLedgerDB.deleteTrainerFixedExpense(id);
        res.json({ message: '고정지출이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 트레이너 고정지출 삭제 오류:', error);
        res.status(500).json({ message: '트레이너 고정지출 삭제에 실패했습니다.' });
    }
});

// 트레이너 변동지출 조회 API
app.get('/api/trainer/variable-expenses', async (req, res) => {
    try {
        const currentUser = req.query.currentUser || req.session?.username;
        const trainer = req.query.trainer; // SU가 특정 트레이너 조회 시 사용
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        // SU이거나 트레이너인 경우만 접근 가능
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 조회할 트레이너 결정: SU가 trainer 파라미터를 보낸 경우 해당 트레이너, 아니면 본인
        const targetTrainer = (isSU && trainer) ? trainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 조회 가능
        if (!isSU && targetTrainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 조회할 수 있습니다.' });
        }
        
        const filters = {
            trainer: targetTrainer
        };
        if (req.query.month) filters.month = req.query.month;
        
        const expenses = await trainerLedgerDB.getTrainerVariableExpenses(filters);
        res.json(expenses);
    } catch (error) {
        console.error('[API] 트레이너 변동지출 조회 오류:', error);
        res.status(500).json({ message: '트레이너 변동지출 조회에 실패했습니다.' });
    }
});

// 트레이너 변동지출 추가 API
app.post('/api/trainer/variable-expenses', async (req, res) => {
    try {
        const { month, date, item, amount, note, taxType, currentUser, trainer: targetTrainer } = req.body;
        const currentUserAccount = currentUser || req.session?.username;
        
        if (!currentUserAccount) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUserAccount);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 저장할 트레이너 결정: SU가 targetTrainer를 보낸 경우 해당 트레이너, 아니면 본인
        const trainer = (isSU && targetTrainer) ? targetTrainer : currentUserAccount;
        
        // SU가 아닌 경우 본인 데이터만 저장 가능
        if (!isSU && trainer !== currentUserAccount) {
            return res.status(403).json({ message: '본인의 데이터만 추가할 수 있습니다.' });
        }
        
        if (!month || !item) {
            return res.status(400).json({ message: '월, 항목은 필수입니다.' });
        }
        
        const expense = {
            trainer,
            month,
            date: date || null,
            item,
            amount: amount || 0,
            note: note || null,
            taxType: taxType || null
        };
        
        const result = await trainerLedgerDB.addTrainerVariableExpense(expense);
        res.json({ message: '변동지출이 추가되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 트레이너 변동지출 추가 오류:', error);
        res.status(500).json({ message: '트레이너 변동지출 추가에 실패했습니다.' });
    }
});

// 트레이너 변동지출 수정 API
app.patch('/api/trainer/variable-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { month, date, item, amount, note, taxType, currentUser } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allExpenses = await trainerLedgerDB.getTrainerVariableExpenses({});
        const expense = allExpenses.find(e => e.id === id);
        
        if (!expense) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 수정 가능
        if (!isSU && expense.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 수정할 수 있습니다.' });
        }
        
        const updates = {};
        if (month !== undefined) updates.month = month;
        if (date !== undefined) updates.date = date;
        if (item !== undefined) updates.item = item;
        if (amount !== undefined) updates.amount = amount;
        if (note !== undefined) updates.note = note;
        if (taxType !== undefined) updates.taxType = taxType;
        
        const result = await trainerLedgerDB.updateTrainerVariableExpense(id, updates);
        res.json({ message: '변동지출이 수정되었습니다.', expense: result });
    } catch (error) {
        console.error('[API] 트레이너 변동지출 수정 오류:', error);
        res.status(500).json({ message: '트레이너 변동지출 수정에 실패했습니다.' });
    }
});

// 트레이너 변동지출 삭제 API
app.delete('/api/trainer/variable-expenses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allExpenses = await trainerLedgerDB.getTrainerVariableExpenses({});
        const expense = allExpenses.find(e => e.id === id);
        
        if (!expense) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 삭제 가능
        if (!isSU && expense.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 삭제할 수 있습니다.' });
        }
        
        await trainerLedgerDB.deleteTrainerVariableExpense(id);
        res.json({ message: '변동지출이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 트레이너 변동지출 삭제 오류:', error);
        res.status(500).json({ message: '트레이너 변동지출 삭제에 실패했습니다.' });
    }
});

// 트레이너 급여 조회 API
app.get('/api/trainer/salaries', async (req, res) => {
    try {
        const currentUser = req.query.currentUser || req.session?.username;
        const trainer = req.query.trainer; // SU가 특정 트레이너 조회 시 사용
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        // SU이거나 트레이너인 경우만 접근 가능
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 조회할 트레이너 결정: SU가 trainer 파라미터를 보낸 경우 해당 트레이너, 아니면 본인
        const targetTrainer = (isSU && trainer) ? trainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 조회 가능
        if (!isSU && targetTrainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 조회할 수 있습니다.' });
        }
        
        const filters = {
            trainer: targetTrainer
        };
        if (req.query.month) filters.month = req.query.month;
        
        const salaries = await trainerLedgerDB.getTrainerSalaries(filters);
        res.json(salaries);
    } catch (error) {
        console.error('[API] 트레이너 급여 조회 오류:', error);
        res.status(500).json({ message: '트레이너 급여 조회에 실패했습니다.' });
    }
});

// 트레이너 급여 추가 API
app.post('/api/trainer/salaries', async (req, res) => {
    try {
        const { month, item, amount, currentUser, trainer: targetTrainer } = req.body;
        const currentUserAccount = currentUser || req.session?.username;
        
        if (!currentUserAccount) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUserAccount);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 저장할 트레이너 결정: SU가 targetTrainer를 보낸 경우 해당 트레이너, 아니면 본인
        const trainer = (isSU && targetTrainer) ? targetTrainer : currentUserAccount;
        
        // SU가 아닌 경우 본인 데이터만 저장 가능
        if (!isSU && trainer !== currentUserAccount) {
            return res.status(403).json({ message: '본인의 데이터만 추가할 수 있습니다.' });
        }
        
        if (!month || !item) {
            return res.status(400).json({ message: '월, 항목은 필수입니다.' });
        }
        
        const salary = {
            trainer,
            month,
            item,
            amount: amount || 0
        };
        
        const result = await trainerLedgerDB.addTrainerSalary(salary);
        res.json({ message: '급여가 추가되었습니다.', salary: result });
    } catch (error) {
        console.error('[API] 트레이너 급여 추가 오류:', error);
        res.status(500).json({ message: '트레이너 급여 추가에 실패했습니다.' });
    }
});

// 트레이너 급여 수정 API
app.patch('/api/trainer/salaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { month, item, amount, currentUser } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allSalaries = await trainerLedgerDB.getTrainerSalaries({});
        const salary = allSalaries.find(s => s.id === id);
        
        if (!salary) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 수정 가능
        if (!isSU && salary.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 수정할 수 있습니다.' });
        }
        
        const updates = {};
        if (month !== undefined) updates.month = month;
        if (item !== undefined) updates.item = item;
        if (amount !== undefined) updates.amount = amount;
        
        const result = await trainerLedgerDB.updateTrainerSalary(id, updates);
        res.json({ message: '급여가 수정되었습니다.', salary: result });
    } catch (error) {
        console.error('[API] 트레이너 급여 수정 오류:', error);
        res.status(500).json({ message: '트레이너 급여 수정에 실패했습니다.' });
    }
});

// 트레이너 급여 삭제 API
app.delete('/api/trainer/salaries/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allSalaries = await trainerLedgerDB.getTrainerSalaries({});
        const salary = allSalaries.find(s => s.id === id);
        
        if (!salary) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 삭제 가능
        if (!isSU && salary.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 삭제할 수 있습니다.' });
        }
        
        await trainerLedgerDB.deleteTrainerSalary(id);
        res.json({ message: '급여가 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 트레이너 급여 삭제 오류:', error);
        res.status(500).json({ message: '트레이너 급여 삭제에 실패했습니다.' });
    }
});

// 트레이너 매출 조회 API
app.get('/api/trainer/revenues', async (req, res) => {
    try {
        const { month, currentUser, trainer } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        // SU이거나 트레이너인 경우만 접근 가능
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 조회할 트레이너 결정: SU가 trainer 파라미터를 보낸 경우 해당 트레이너, 아니면 본인
        const targetTrainer = (isSU && trainer) ? trainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 조회 가능
        if (!isSU && targetTrainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 조회할 수 있습니다.' });
        }
        
        const filters = {
            trainer: targetTrainer,
            month: month || null
        };
        
        const revenues = await trainerRevenueDB.getTrainerRevenues(filters);
        res.json(revenues);
    } catch (error) {
        console.error('[API] 트레이너 매출 조회 오류:', error);
        res.status(500).json({ message: '트레이너 매출 조회에 실패했습니다.' });
    }
});

// 트레이너 매출 추가/수정 API
app.post('/api/trainer/revenues', async (req, res) => {
    try {
        const { month, amount, currentUser, trainer: targetTrainer } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 저장할 트레이너 결정: SU가 targetTrainer를 보낸 경우 해당 트레이너, 아니면 본인
        const trainer = (isSU && targetTrainer) ? targetTrainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 저장 가능
        if (!isSU && trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 추가할 수 있습니다.' });
        }
        
        if (!month) {
            return res.status(400).json({ message: '연월은 필수입니다.' });
        }
        
        const revenue = {
            trainer: trainer,
            month,
            amount: parseInt(amount) || 0
        };
        
        const result = await trainerRevenueDB.addTrainerRevenue(revenue);
        res.json(result);
    } catch (error) {
        console.error('[API] 트레이너 매출 추가/수정 오류:', error);
        res.status(500).json({ message: '트레이너 매출 추가/수정에 실패했습니다.' });
    }
});

// 트레이너 매출 수정 API
app.patch('/api/trainer/revenues/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { month, amount, currentUser } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allRevenues = await trainerRevenueDB.getTrainerRevenues({});
        const revenue = allRevenues.find(r => r.id === id);
        
        if (!revenue) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 수정 가능
        if (!isSU && revenue.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 수정할 수 있습니다.' });
        }
        
        const updates = {};
        if (month !== undefined) updates.month = month;
        if (amount !== undefined) updates.amount = parseInt(amount) || 0;
        
        const result = await trainerRevenueDB.updateTrainerRevenue(id, updates);
        res.json(result);
    } catch (error) {
        console.error('[API] 트레이너 매출 수정 오류:', error);
        res.status(500).json({ message: '트레이너 매출 수정에 실패했습니다.' });
    }
});

// 트레이너 매출 삭제 API
app.delete('/api/trainer/revenues/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allRevenues = await trainerRevenueDB.getTrainerRevenues({});
        const revenue = allRevenues.find(r => r.id === id);
        
        if (!revenue) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 삭제 가능
        if (!isSU && revenue.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 삭제할 수 있습니다.' });
        }
        
        await trainerRevenueDB.deleteTrainerRevenue(id);
        res.json({ message: '매출이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 트레이너 매출 삭제 오류:', error);
        res.status(500).json({ message: '트레이너 매출 삭제에 실패했습니다.' });
    }
});

// 트레이너 기타수입 조회 API
app.get('/api/trainer/other-revenues', async (req, res) => {
    try {
        const { month, currentUser, trainer } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        // SU이거나 트레이너인 경우만 접근 가능
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 조회할 트레이너 결정: SU가 trainer 파라미터를 보낸 경우 해당 트레이너, 아니면 본인
        const targetTrainer = (isSU && trainer) ? trainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 조회 가능
        if (!isSU && targetTrainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 조회할 수 있습니다.' });
        }
        
        const filters = {
            trainer: targetTrainer,
            month: month || null
        };
        
        const revenues = await trainerRevenueDB.getTrainerOtherRevenues(filters);
        res.json(revenues);
    } catch (error) {
        console.error('[API] 트레이너 기타수입 조회 오류:', error);
        res.status(500).json({ message: '트레이너 기타수입 조회에 실패했습니다.' });
    }
});

// 트레이너 기타수입 추가 API
app.post('/api/trainer/other-revenues', async (req, res) => {
    try {
        const { month, item, amount, currentUser, trainer: targetTrainer } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        const isTrainer = userAccount && userAccount.role === 'trainer';
        
        if (!isSU && !isTrainer) {
            return res.status(403).json({ message: '권한이 없습니다.' });
        }
        
        // 저장할 트레이너 결정: SU가 targetTrainer를 보낸 경우 해당 트레이너, 아니면 본인
        const trainer = (isSU && targetTrainer) ? targetTrainer : currentUser;
        
        // SU가 아닌 경우 본인 데이터만 저장 가능
        if (!isSU && trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 추가할 수 있습니다.' });
        }
        
        if (!month || !item) {
            return res.status(400).json({ message: '연월과 항목은 필수입니다.' });
        }
        
        const revenue = {
            trainer: trainer,
            month,
            item,
            amount: parseInt(amount) || 0
        };
        
        const result = await trainerRevenueDB.addTrainerOtherRevenue(revenue);
        res.json(result);
    } catch (error) {
        console.error('[API] 트레이너 기타수입 추가 오류:', error);
        res.status(500).json({ message: '트레이너 기타수입 추가에 실패했습니다.' });
    }
});

// 트레이너 기타수입 수정 API
app.patch('/api/trainer/other-revenues/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { month, item, amount, currentUser } = req.body;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allRevenues = await trainerRevenueDB.getTrainerOtherRevenues({});
        const revenue = allRevenues.find(r => r.id === id);
        
        if (!revenue) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 수정 가능
        if (!isSU && revenue.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 수정할 수 있습니다.' });
        }
        
        const updates = {};
        if (month !== undefined) updates.month = month;
        if (item !== undefined) updates.item = item;
        if (amount !== undefined) updates.amount = parseInt(amount) || 0;
        
        const result = await trainerRevenueDB.updateTrainerOtherRevenue(id, updates);
        res.json(result);
    } catch (error) {
        console.error('[API] 트레이너 기타수입 수정 오류:', error);
        res.status(500).json({ message: '트레이너 기타수입 수정에 실패했습니다.' });
    }
});

// 트레이너 기타수입 삭제 API
app.delete('/api/trainer/other-revenues/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { currentUser } = req.query;
        
        if (!currentUser) {
            return res.status(401).json({ message: '로그인이 필요합니다.' });
        }
        
        // 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        const userAccount = accounts.find(acc => acc.username === currentUser);
        const isSU = userAccount && userAccount.role === 'su';
        
        // 데이터 조회하여 트레이너 확인
        const allRevenues = await trainerRevenueDB.getTrainerOtherRevenues({});
        const revenue = allRevenues.find(r => r.id === id);
        
        if (!revenue) {
            return res.status(404).json({ message: '데이터를 찾을 수 없습니다.' });
        }
        
        // SU가 아니면 본인 데이터만 삭제 가능
        if (!isSU && revenue.trainer !== currentUser) {
            return res.status(403).json({ message: '본인의 데이터만 삭제할 수 있습니다.' });
        }
        
        await trainerRevenueDB.deleteTrainerOtherRevenue(id);
        res.json({ message: '기타수입이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 트레이너 기타수입 삭제 오류:', error);
        res.status(500).json({ message: '트레이너 기타수입 삭제에 실패했습니다.' });
    }
});

// 트레이너 이전월 데이터 복사 API
app.post('/api/trainer/copy-previous-month', async (req, res) => {
    try {
        const { fromMonth, toMonth, currentUser } = req.body;
        
        if (!fromMonth || !toMonth || !currentUser) {
            return res.status(400).json({ message: 'fromMonth, toMonth, currentUser는 필수입니다.' });
        }
        
        // 현재 로그인한 트레이너의 이전월 데이터 조회
        const [fixedExpenses, variableExpenses, salaries] = await Promise.all([
            trainerLedgerDB.getTrainerFixedExpenses({ trainer: currentUser, month: fromMonth }),
            trainerLedgerDB.getTrainerVariableExpenses({ trainer: currentUser, month: fromMonth }),
            trainerLedgerDB.getTrainerSalaries({ trainer: currentUser, month: fromMonth })
        ]);
        
        // 이번달 데이터 복사
        const copyResults = {
            fixed: 0,
            variable: 0,
            salary: 0
        };
        
        // 고정지출 복사
        for (const expense of fixedExpenses) {
            try {
                await trainerLedgerDB.addTrainerFixedExpense({
                    trainer: currentUser,
                    month: toMonth,
                    item: expense.item,
                    amount: expense.amount
                });
                copyResults.fixed++;
            } catch (err) {
                // 중복 등 오류는 무시하고 계속 진행
                console.error(`트레이너 고정지출 복사 오류 (${expense.id}):`, err);
            }
        }
        
        // 변동지출 복사
        for (const expense of variableExpenses) {
            try {
                await trainerLedgerDB.addTrainerVariableExpense({
                    trainer: currentUser,
                    month: toMonth,
                    date: expense.date,
                    item: expense.item,
                    amount: expense.amount,
                    note: expense.note,
                    taxType: expense.tax_type || null
                });
                copyResults.variable++;
            } catch (err) {
                console.error(`트레이너 변동지출 복사 오류 (${expense.id}):`, err);
            }
        }
        
        // 급여 복사
        for (const salary of salaries) {
            try {
                await trainerLedgerDB.addTrainerSalary({
                    trainer: currentUser,
                    month: toMonth,
                    item: salary.item,
                    amount: salary.amount
                });
                copyResults.salary++;
            } catch (err) {
                console.error(`트레이너 급여 복사 오류 (${salary.id}):`, err);
            }
        }
        
        res.json({
            message: '이전월 데이터가 복사되었습니다.',
            results: copyResults
        });
    } catch (error) {
        console.error('[API] 트레이너 이전월 데이터 복사 오류:', error);
        res.status(500).json({ message: '이전월 데이터 복사에 실패했습니다.' });
    }
});

// 이전월 데이터 복사 API
app.post('/api/ledger/copy-previous-month', async (req, res) => {
    try {
        const { fromMonth, toMonth } = req.body;
        
        if (!fromMonth || !toMonth) {
            return res.status(400).json({ message: 'fromMonth와 toMonth는 필수입니다.' });
        }
        
        // 이전월 데이터 조회
        const [fixedExpenses, variableExpenses, salaries] = await Promise.all([
            ledgerDB.getFixedExpenses({ month: fromMonth }),
            ledgerDB.getVariableExpenses({ month: fromMonth }),
            ledgerDB.getSalaries({ month: fromMonth })
        ]);
        
        // 이번달 데이터 복사
        const copyResults = {
            fixed: 0,
            variable: 0,
            salary: 0
        };
        
        // 고정지출 복사
        for (const expense of fixedExpenses) {
            try {
                await ledgerDB.addFixedExpense({
                    center: expense.center,
                    month: toMonth,
                    item: expense.item,
                    amount: expense.amount
                });
                copyResults.fixed++;
            } catch (err) {
                // 중복 등 오류는 무시하고 계속 진행
                console.error(`고정지출 복사 오류 (${expense.id}):`, err);
            }
        }
        
        // 변동지출 복사
        for (const expense of variableExpenses) {
            try {
                await ledgerDB.addVariableExpense({
                    center: expense.center,
                    month: toMonth,
                    date: expense.date,
                    item: expense.item,
                    amount: expense.amount,
                    note: expense.note,
                    taxType: expense.tax_type || null
                });
                copyResults.variable++;
            } catch (err) {
                console.error(`변동지출 복사 오류 (${expense.id}):`, err);
            }
        }
        
        // 급여 복사
        for (const salary of salaries) {
            try {
                await ledgerDB.addSalary({
                    center: salary.center,
                    month: toMonth,
                    item: salary.item,
                    amount: salary.amount
                });
                copyResults.salary++;
            } catch (err) {
                console.error(`급여 복사 오류 (${salary.id}):`, err);
            }
        }
        
        res.json({
            message: '이전월 데이터가 복사되었습니다.',
            results: copyResults
        });
    } catch (error) {
        console.error('[API] 이전월 데이터 복사 오류:', error);
        res.status(500).json({ message: '이전월 데이터 복사에 실패했습니다.' });
    }
});

// 네트워크 인터페이스의 IP 주소 가져오기
const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // IPv4이고 내부 주소가 아닌 경우
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
};

const HOST = '0.0.0.0'; // 모든 네트워크 인터페이스에서 수신
const LOCAL_IP = getLocalIP();

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server also accessible at http://${LOCAL_IP}:${PORT}`);
    console.log(`\n📱 핸드폰에서 접속: http://${LOCAL_IP}:${PORT}`);
    console.log('\n=== 쿼리 로깅 설정 ===');
    console.log(`ENABLE_QUERY_LOGGING: ${process.env.ENABLE_QUERY_LOGGING !== 'false' ? 'true' : 'false'}`);
    console.log(`SLOW_QUERY_THRESHOLD: ${parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10)}ms`);
    console.log(`DEBUG_QUERIES: ${process.env.DEBUG_QUERIES === 'true' ? 'true' : 'false'}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    console.log('====================');
    console.log('\n🔄 PWA 버전:', PWA_VERSION);
    console.log(`   ${process.env.PWA_VERSION ? '(환경 변수에서 로드됨)' : '(기본값: 서버 시작 시간)'}\n`);
});
