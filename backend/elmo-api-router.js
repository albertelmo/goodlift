// Elmo API 라우터

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const elmoUsersDB = require('./elmo-users-db');
const elmoCalendarRecordsDB = require('./elmo-calendar-records-db');
const membersDB = require('./members-db');
const sessionsDB = require('./sessions-db');
const { verifyElmoSession } = require('./elmo-middleware');
const { saveElmoImage, elmoMediaUpload, ELMO_IMAGES_DIR } = require('./elmo-utils');

// 업로드 디렉토리 설정
const getUploadsDir = () => {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
  return process.env.UPLOADS_DIR || path.join(DATA_DIR, 'uploads');
};

const UPLOADS_DIR = getUploadsDir();

const elmoApiRouter = express.Router();

// Elmo 회원가입
elmoApiRouter.post('/register', async (req, res) => {
    try {
        const { username, password, name, email } = req.body;
        
        console.log(`[Elmo 회원가입] 시도: username=${username}, name=${name}, IP=${req.ip || req.connection.remoteAddress}`);
        
        // 필수 필드 검증
        if (!username || !password || !name) {
            console.log(`[Elmo 회원가입] 실패: 필수 필드 누락`);
            return res.status(400).json({ message: '아이디, 비밀번호, 이름은 필수입니다.' });
        }
        
        // 아이디 중복 확인
        const existingUser = await elmoUsersDB.getElmoUserByUsername(username);
        if (existingUser) {
            console.log(`[Elmo 회원가입] 실패: 아이디 중복 - username=${username}`);
            return res.status(400).json({ message: '이미 사용 중인 아이디입니다.' });
        }
        
        // 전체 사용자 수 확인 (첫 번째 계정 판별)
        const userCount = await elmoUsersDB.getElmoUserCount();
        const role = userCount === 0 ? 'su' : 'user';
        
        console.log(`[Elmo 회원가입] 사용자 수: ${userCount}, 할당된 역할: ${role}`);
        
        // 사용자 추가
        const newUser = await elmoUsersDB.addElmoUser({
            username,
            password,
            name,
            email,
            role
        });
        
        console.log(`[Elmo 회원가입] 성공: username=${username}, userId=${newUser.id}`);
        
        res.status(201).json({
            message: '회원가입이 완료되었습니다.',
            user: {
                id: newUser.id,
                username: newUser.username,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error('[Elmo 회원가입] 오류:', error);
        if (error.code === '23505') { // PostgreSQL unique constraint violation
            console.log(`[Elmo 회원가입] 실패: DB 제약 조건 위반 - username=${req.body.username}`);
            return res.status(400).json({ message: '이미 사용 중인 아이디입니다.' });
        }
        res.status(500).json({ message: '회원가입 중 오류가 발생했습니다.' });
    }
});

// Elmo 로그인 (elmo_users 테이블 사용)
elmoApiRouter.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({ message: '아이디와 비밀번호를 입력하세요.' });
        }
        
        // Elmo 사용자 인증
        const user = await elmoUsersDB.verifyPassword(username, password);
        
        if (user) {
            // 마지막 로그인 시간 업데이트
            await elmoUsersDB.updateLastLogin(username);
            
            const sessionId = uuidv4();
            
            const responseData = {
                message: '로그인 성공',
                sessionId: sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    name: user.name,
                    email: user.email,
                    role: user.role || 'user'
                }
            };
            
            res.json(responseData);
        } else {
            res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
        }
    } catch (error) {
        console.error('[Elmo 로그인] 오류:', error);
        if (error.message === '비활성화된 계정입니다.') {
            return res.status(403).json({ message: error.message });
        }
        res.status(500).json({ message: '로그인 중 오류가 발생했습니다.' });
    }
});

// Elmo 데이터 API (기존 DB 활용 예시)
elmoApiRouter.get('/members', async (req, res) => {
    try {
        // 기존 membersDB 사용 가능
        const members = await membersDB.getMembers();
        res.json(members);
    } catch (error) {
        console.error('[Elmo API] 회원 조회 오류:', error);
        res.status(500).json({ message: '회원 조회 중 오류가 발생했습니다.' });
    }
});

elmoApiRouter.get('/sessions', async (req, res) => {
    try {
        // 기존 sessionsDB 사용 가능
        const sessions = await sessionsDB.getSessions({});
        res.json(sessions);
    } catch (error) {
        console.error('[Elmo API] 세션 조회 오류:', error);
        res.status(500).json({ message: '세션 조회 중 오류가 발생했습니다.' });
    }
});

// Elmo 캘린더 기록 API
// 월별 요약 조회 (캘린더 표시용)
elmoApiRouter.get('/calendar/summary', verifyElmoSession, async (req, res) => {
    try {
        const { year, month } = req.query;
        const userId = req.elmoUserId;
        
        if (!year || !month) {
            return res.status(400).json({ message: '년도와 월을 입력해주세요.' });
        }
        
        const summary = await elmoCalendarRecordsDB.getRecordsSummaryByMonth(
            userId, 
            parseInt(year), 
            parseInt(month)
        );
        
        res.json(summary);
    } catch (error) {
        console.error('[Elmo API] 캘린더 요약 조회 오류:', error);
        res.status(500).json({ message: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

// 날짜별 기록 조회
elmoApiRouter.get('/calendar/records', verifyElmoSession, async (req, res) => {
    try {
        const { date } = req.query;
        const userId = req.elmoUserId;
        
        if (!date) {
            return res.status(400).json({ message: '날짜를 입력해주세요.' });
        }
        
        const records = await elmoCalendarRecordsDB.getRecordsByDate(userId, date);
        res.json(records);
    } catch (error) {
        console.error('[Elmo API] 기록 조회 오류:', error);
        res.status(500).json({ message: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

// 기록 추가 (FormData 지원)
elmoApiRouter.post('/calendar/records', verifyElmoSession, elmoMediaUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 }
]), async (req, res) => {
    try {
        const { record_date, type, text_content } = req.body;
        const userId = req.elmoUserId;
        const imageFile = req.files && req.files['image'] ? req.files['image'][0] : null;
        const videoFile = req.files && req.files['video'] ? req.files['video'][0] : null;
        
        if (!record_date || !type) {
            return res.status(400).json({ message: '날짜와 타입을 입력해주세요.' });
        }
        
        if (type !== '일정' && type !== 'ToDo') {
            return res.status(400).json({ message: '타입은 "일정" 또는 "ToDo"만 가능합니다.' });
        }
        
        // ToDo는 동영상 불가
        if (type === 'ToDo' && videoFile) {
            return res.status(400).json({ message: 'ToDo는 동영상을 추가할 수 없습니다.' });
        }
        
        let image_url = null;
        let video_url = null;
        
        // 이미지 업로드 처리
        if (imageFile) {
            // 임시 레코드 생성 (ID 필요)
            const tempRecord = await elmoCalendarRecordsDB.addCalendarRecord(userId, {
                record_date,
                type,
                text_content: text_content || null,
                image_url: null,
                video_url: null
            });
            
            try {
                const imageUrls = await saveElmoImage(tempRecord.id, imageFile.buffer, record_date);
                image_url = imageUrls.image_url;
                
                // 이미지 URL 업데이트
                const updatedRecord = await elmoCalendarRecordsDB.updateCalendarRecord(userId, tempRecord.id, {
                    image_url
                });
                
                res.json(updatedRecord);
                return;
            } catch (imageError) {
                // 이미지 저장 실패 시 임시 레코드 삭제
                await elmoCalendarRecordsDB.deleteRecord(userId, tempRecord.id);
                throw imageError;
            }
        } else {
            // 이미지 없이 추가 (동영상은 추후 구현)
            const record = await elmoCalendarRecordsDB.addCalendarRecord(userId, {
                record_date,
                type,
                text_content: text_content || null,
                image_url: null,
                video_url: null
            });
            
            res.json(record);
        }
    } catch (error) {
        console.error('[Elmo API] 기록 추가 오류:', error);
        res.status(500).json({ message: '기록 추가 중 오류가 발생했습니다.' });
    }
});

// 기록 상세 조회
elmoApiRouter.get('/calendar/records/:id', verifyElmoSession, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.elmoUserId;
        
        const record = await elmoCalendarRecordsDB.getRecordById(userId, id);
        
        if (!record) {
            return res.status(404).json({ message: '기록을 찾을 수 없습니다.' });
        }
        
        res.json(record);
    } catch (error) {
        console.error('[Elmo API] 기록 상세 조회 오류:', error);
        res.status(500).json({ message: '데이터 조회 중 오류가 발생했습니다.' });
    }
});

// 기록 삭제
elmoApiRouter.delete('/calendar/records/:id', verifyElmoSession, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.elmoUserId;
        
        const record = await elmoCalendarRecordsDB.deleteRecord(userId, id);
        
        if (!record) {
            return res.status(404).json({ message: '기록을 찾을 수 없습니다.' });
        }
        
        // 이미지 파일 삭제
        if (record.image_url) {
            try {
                // 예: uploads/elmo-images/2025/01/{uuid}/original.jpg
                let relativePath = record.image_url;
                if (relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1); // 앞의 / 제거
                }
                if (relativePath.startsWith('uploads/')) {
                    relativePath = relativePath.substring('uploads/'.length); // 'uploads/' 제거
                }
                
                // UPLOADS_DIR 기준으로 실제 파일 경로 구성
                const imagePath = path.join(UPLOADS_DIR, relativePath);
                const imageDir = path.dirname(imagePath);
                
                // 디렉토리가 존재하면 전체 디렉토리 삭제 (original.jpg, thumbnail_300x300.jpg 모두 포함)
                if (fs.existsSync(imageDir)) {
                    fs.rmSync(imageDir, { recursive: true, force: true });
                }
            } catch (fileError) {
                // 파일 삭제 실패해도 DB 삭제는 성공했으므로 경고만 로그
                console.warn('[Elmo API] 이미지 파일 삭제 실패 (DB 삭제는 완료):', fileError);
            }
        }
        
        res.json({ message: '기록이 삭제되었습니다.', record });
    } catch (error) {
        console.error('[Elmo API] 기록 삭제 오류:', error);
        res.status(500).json({ message: '기록 삭제 중 오류가 발생했습니다.' });
    }
});

// 계정 관리 API (SU만 접근 가능)
// 계정 목록 조회
elmoApiRouter.get('/users', verifyElmoSession, async (req, res) => {
    try {
        const userId = req.elmoUserId;
        
        // 현재 사용자 정보 조회
        const currentUser = await elmoUsersDB.getElmoUserById(userId);
        if (!currentUser || currentUser.role !== 'su') {
            return res.status(403).json({ message: 'SU 권한이 필요합니다.' });
        }
        
        // 모든 사용자 조회
        const users = await elmoUsersDB.getAllElmoUsers();
        res.json(users);
    } catch (error) {
        console.error('[Elmo API] 계정 목록 조회 오류:', error);
        res.status(500).json({ message: '계정 목록 조회 중 오류가 발생했습니다.' });
    }
});

// 계정 권한 수정
elmoApiRouter.patch('/users/:id/role', verifyElmoSession, async (req, res) => {
    try {
        const userId = req.elmoUserId;
        const targetUserId = req.params.id;
        const { role } = req.body;
        
        // 현재 사용자 정보 조회
        const currentUser = await elmoUsersDB.getElmoUserById(userId);
        if (!currentUser || currentUser.role !== 'su') {
            return res.status(403).json({ message: 'SU 권한이 필요합니다.' });
        }
        
        // 역할 검증
        if (!role || !['su', 'admin', 'user'].includes(role)) {
            return res.status(400).json({ message: '유효하지 않은 역할입니다.' });
        }
        
        // 자신의 역할을 변경하려는 경우 방지
        if (userId === targetUserId) {
            return res.status(400).json({ message: '자신의 역할을 변경할 수 없습니다.' });
        }
        
        // SU 권한으로 변경하는 것을 방지
        if (role === 'su') {
            return res.status(400).json({ message: 'SU 권한으로 변경할 수 없습니다.' });
        }
        
        // 권한 수정
        const updatedUser = await elmoUsersDB.updateElmoUserRole(targetUserId, role);
        
        if (!updatedUser) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({ message: '권한이 수정되었습니다.', user: updatedUser });
    } catch (error) {
        console.error('[Elmo API] 계정 권한 수정 오류:', error);
        res.status(500).json({ message: '권한 수정 중 오류가 발생했습니다.' });
    }
});

// 계정 삭제
elmoApiRouter.delete('/users/:id', verifyElmoSession, async (req, res) => {
    try {
        const userId = req.elmoUserId;
        const targetUserId = req.params.id;
        
        // 현재 사용자 정보 조회
        const currentUser = await elmoUsersDB.getElmoUserById(userId);
        if (!currentUser || currentUser.role !== 'su') {
            return res.status(403).json({ message: 'SU 권한이 필요합니다.' });
        }
        
        // 자신을 삭제하려는 경우 방지
        if (userId === targetUserId) {
            return res.status(400).json({ message: '자신의 계정을 삭제할 수 없습니다.' });
        }
        
        // 계정 삭제
        const deleted = await elmoUsersDB.deleteElmoUser(targetUserId);
        
        if (!deleted) {
            return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
        }
        
        res.json({ message: '계정이 삭제되었습니다.' });
    } catch (error) {
        console.error('[Elmo API] 계정 삭제 오류:', error);
        res.status(500).json({ message: '계정 삭제 중 오류가 발생했습니다.' });
    }
});

module.exports = elmoApiRouter;
