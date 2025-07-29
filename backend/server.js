const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

require('dotenv').config();

// PostgreSQL 세션 데이터베이스 모듈
const sessionsDB = require('./sessions-db');

const app = express();
const PORT = 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const DATA_PATH = path.join(DATA_DIR, 'accounts.json');
const CENTERS_PATH = path.join(DATA_DIR, 'centers.json');
const MEMBERS_PATH = path.join(DATA_DIR, 'members.json');

// 데이터 파일 자동 생성 기능 수정: 디렉토리가 없으면 에러만 출력
const DATA_FILES = [
  { path: DATA_PATH, name: 'accounts.json' },
  { path: CENTERS_PATH, name: 'centers.json' },
  { path: MEMBERS_PATH, name: 'members.json' }
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
app.delete('/api/centers/:name', (req, res) => {
    const name = decodeURIComponent(req.params.name);
    if (!name) {
        return res.status(400).json({ message: '센터 이름이 필요합니다.' });
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
});

// 회원 목록 조회
app.get('/api/members', (req, res) => {
    let members = [];
    if (fs.existsSync(MEMBERS_PATH)) {
        const raw = fs.readFileSync(MEMBERS_PATH, 'utf-8');
        if (raw) members = JSON.parse(raw);
    }
    res.json(members);
});
// 회원 추가
app.post('/api/members', (req, res) => {
    const { name, gender, phone, trainer, center, regdate, sessions } = req.body;
    if (!name || !gender || !phone || !trainer || !center || !regdate || sessions === undefined) {
        return res.status(400).json({ message: '모든 항목을 입력해주세요.' });
    }
    let members = [];
    if (fs.existsSync(MEMBERS_PATH)) {
        const raw = fs.readFileSync(MEMBERS_PATH, 'utf-8');
        if (raw) members = JSON.parse(raw);
    }
    // 이름 중복 체크
    if (members.find(m => m.name === name)) {
        return res.status(409).json({ message: '이미 등록된 이름입니다.' });
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
    members.push(newMember);
    fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
    res.json({ message: '회원이 추가되었습니다.', member: newMember });
});

// 회원 정보 수정 (상태, 담당 트레이너, 세션수/잔여세션 추가)
app.patch('/api/members/:name', (req, res) => {
    const name = req.params.name;
    const { status, trainer, addSessions } = req.body; // addSessions: 추가할 세션 수(숫자)
    let members = [];
    if (fs.existsSync(MEMBERS_PATH)) {
        const raw = fs.readFileSync(MEMBERS_PATH, 'utf-8');
        if (raw) members = JSON.parse(raw);
    }
    const member = members.find(m => m.name === name);
    if (!member) {
        return res.status(404).json({ message: '회원을 찾을 수 없습니다.' });
    }
    if (status) member.status = status;
    if (trainer) member.trainer = trainer;
    if (addSessions && !isNaN(Number(addSessions))) {
        const add = Number(addSessions);
        member.sessions += add;
        member.remainSessions += add;
    }
    fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
    res.json({ message: '회원 정보가 수정되었습니다.', member });
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
        
        // 회원 잔여세션 감소 (JSON 파일 유지)
        let members = [];
        if (fs.existsSync(MEMBERS_PATH)) {
            const raw = fs.readFileSync(MEMBERS_PATH, 'utf-8');
            if (raw) members = JSON.parse(raw);
        }
        const member = members.find(m => m.name === session.member);
        if (member && member.remainSessions > 0) {
            member.remainSessions -= 1;
            fs.writeFileSync(MEMBERS_PATH, JSON.stringify(members, null, 2));
        }
        
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

// 통계 API
app.get('/api/stats', async (req, res) => {
  try {
    const { period, startDate, endDate } = req.query;
    
    if (!period || !startDate || !endDate) {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다.' });
    }
    
    // 세션 데이터 조회
    const sessions = await sessionsDB.getSessionsByDateRange(startDate, endDate);
    
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
      if (!trainerMap.has(session.trainer)) {
        trainerMap.set(session.trainer, {
          name: session.trainer,
          total: 0,
          completed: 0,
          scheduled: 0
        });
      }
      
      const trainer = trainerMap.get(session.trainer);
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
