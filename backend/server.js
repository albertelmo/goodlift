const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { getKoreanDate, getKoreanToday, parseKoreanDate } = require('./utils');

require('dotenv').config();

// PostgreSQL 세션 데이터베이스 모듈
const sessionsDB = require('./sessions-db');
const membersDB = require('./members-db');
const monthlyStatsDB = require('./monthly-stats-db');
const registrationLogsDB = require('./registration-logs-db');

// 이메일 서비스 모듈
const emailService = require('./email-service');

const app = express();
const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DATA_PATH = path.join(DATA_DIR, 'accounts.json');
const CENTERS_PATH = path.join(DATA_DIR, 'centers.json');


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



// PostgreSQL 데이터베이스 초기화
sessionsDB.initializeDatabase();
membersDB.initializeDatabase();
monthlyStatsDB.initializeDatabase();
registrationLogsDB.initializeDatabase();

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

// migrateTrainerVipField();

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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 회원가입 API
app.post('/api/signup', (req, res) => {
    const { username, password, name, role } = req.body;
    if (!username || !password || !name || !role) {
        return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    if (accounts.find(acc => acc.username === username)) {
        return res.status(409).json({ message: '이미 존재하는 아이디입니다.' });
    }
    accounts.push({ username, password, name, role });
    fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
    res.json({ message: '회원가입이 완료되었습니다.' });
});

// 로그인 API
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요.' });
    }
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    const user = accounts.find(acc => acc.username === username && acc.password === password);
    if (!user) {
        return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    res.json({ message: '로그인 성공!', role: user.role, name: user.name });
});

// 트레이너 리스트 API
app.get('/api/trainers', (req, res) => {
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    const trainers = accounts.filter(acc => acc.role === 'trainer')
        .map(({ username, name, role, vip_member }) => ({ 
            username, 
            name, 
            role, 
            vip_member: vip_member || false  // 기본값: VIP 기능 사용 안함
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
        if (!currentUserAccount || currentUserAccount.role !== 'admin') {
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
        const { vip_member, currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!currentUserAccount || currentUserAccount.role !== 'admin') {
            return res.status(403).json({ message: '관리자만 트레이너 설정을 수정할 수 있습니다.' });
        }
        
        // 트레이너 찾기
        const trainerIndex = accounts.findIndex(acc => acc.username === username && acc.role === 'trainer');
        if (trainerIndex === -1) {
            return res.status(404).json({ message: '트레이너를 찾을 수 없습니다.' });
        }
        
        // VIP 기능 설정 업데이트
        accounts[trainerIndex].vip_member = Boolean(vip_member);
        fs.writeFileSync(DATA_PATH, JSON.stringify(accounts, null, 2));
        
        res.json({ 
            message: 'VIP 기능 설정이 업데이트되었습니다.',
            trainer: {
                username: accounts[trainerIndex].username,
                name: accounts[trainerIndex].name,
                vip_member: accounts[trainerIndex].vip_member
            }
        });
    } catch (error) {
        console.error('[API] 트레이너 VIP 기능 설정 수정 오류:', error);
        res.status(500).json({ message: 'VIP 기능 설정 수정에 실패했습니다.' });
    }
});

// 관리자 계정 존재 여부 확인 API
app.get('/api/admin-exists', (req, res) => {
    let accounts = [];
    if (fs.existsSync(DATA_PATH)) {
        const raw = fs.readFileSync(DATA_PATH, 'utf-8');
        if (raw) accounts = JSON.parse(raw);
    }
    const exists = accounts.some(acc => acc.role === 'admin');
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
        const { status, trainer, addSessions, gender, center, phone, vipSession } = req.body; // addSessions: 추가할 세션 수(숫자)
        
        const updates = {};
        if (status) updates.status = status;
        if (trainer) updates.trainer = trainer;
        if (gender) updates.gender = gender;
        if (center) updates.center = center;
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

// 세션 목록 조회 (트레이너, 날짜별, 주간 필터)
app.get('/api/sessions', async (req, res) => {
    try {
        const { trainer, date, week } = req.query;
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
                    time
                );
                
                if (!hasConflict) {
                    sessions.push({
                        id: uuidv4(),
                        member,
                        trainer,
                        date: sessionDate.toISOString().split('T')[0],
                        time,
                        status: '예정'
                    });
                }
            }
            
            if (sessions.length === 0) {
                return res.status(400).json({ message: '모든 날짜에 시간 중복이 있습니다.' });
            }
            
            const addedSessions = await sessionsDB.addMultipleSessions(sessions);
            const skipped = count - sessions.length;
            
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
                status: '예정'
            };
            
            const session = await sessionsDB.addSession(newSession);
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
        
        const updatedSession = await sessionsDB.updateSession(sessionId, { date, time });
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
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD 형식
    
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
    members.forEach(member => {
        if (member.status === '유효' && 
            !member.name.startsWith('무기명') && 
            !member.name.startsWith('체험')) {
            const center = member.center;
            centerValidMembers[center] = (centerValidMembers[center] || 0) + 1;
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
        memberCount: trainerMemberCount[trainerName] || 0
      });
    });
    
    // 세션 데이터로 통계 업데이트
    sessions.forEach(session => {
      const trainerName = trainerNameMap[session.trainer] || session.trainer; // 이름이 없으면 ID 사용
      
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
          memberCount: trainerMemberCount[trainerName] || 0
        });
      }
      
      const trainer = trainerMap.get(trainerName);
      trainer.total++;
      
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
    
    stats.trainerStats = Array.from(trainerMap.values());
    
    res.json(stats);
  } catch (error) {
    console.error('통계 API 오류:', error);
    res.status(500).json({ error: '통계를 불러오지 못했습니다.' });
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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
