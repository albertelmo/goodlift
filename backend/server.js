const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

// PostgreSQL 세션 데이터베이스 모듈
const sessionsDB = require('./sessions-db');
const membersDB = require('./members-db');
const monthlyStatsDB = require('./monthly-stats-db');

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
        .map(({ username, name, role }) => ({ username, name, role }));
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

// 회원 정보 수정 (상태, 담당 트레이너, 세션수/잔여세션 추가)
app.patch('/api/members/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const { status, trainer, addSessions } = req.body; // addSessions: 추가할 세션 수(숫자)
        
        const updates = {};
        if (status) updates.status = status;
        if (trainer) updates.trainer = trainer;
        if (addSessions && !isNaN(Number(addSessions))) {
            updates.addSessions = Number(addSessions);
        }
        
        const member = await membersDB.updateMember(name, updates);
        
        // 재등록 세션 통계 추가
        if (addSessions && !isNaN(Number(addSessions)) && Number(addSessions) > 0) {
          await monthlyStatsDB.addReRegistrationSessions(Number(addSessions));
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
        const { member, trainer, date, time } = req.body;
        if (!member || !trainer || !date || !time) {
            return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
        }
        
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

// 통계 API
app.get('/api/stats', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    
    if (!period || !startDate || !endDate) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }
    
    // 세션 데이터와 트레이너 데이터 조회
    const sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
    
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
    
    // 통계 계산
    const stats = {
      totalSessions: sessions.length,
      completedSessions: sessions.filter(s => s.status === '완료').length,
      scheduledSessions: sessions.filter(s => s.status === '예정').length,
      trainerStats: []
    };
    
    // 트레이너별 통계 계산
    const trainerMap = new Map();
    
    sessions.forEach(session => {
      const trainerName = trainerNameMap[session.trainer] || session.trainer; // 이름이 없으면 ID 사용
      
      if (!trainerMap.has(trainerName)) {
        trainerMap.set(trainerName, {
          name: trainerName,
          total: 0,
          completed: 0,
          scheduled: 0
        });
      }
      
      const trainer = trainerMap.get(trainerName);
      trainer.total++;
      
      switch (session.status) {
        case '완료':
          trainer.completed++;
          break;
        case '예정':
          trainer.scheduled++;
          break;
      }
    });
    
    stats.trainerStats = Array.from(trainerMap.values());
    
    res.json(stats);
  } catch (error) {
    console.error('통계 API 오류:', error);
    res.status(500).json({ error: '통계를 불러오지 못했습니다.' });
  }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
