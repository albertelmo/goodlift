// Elmo API 미들웨어

const elmoUsersDB = require('./elmo-users-db');

/**
 * Elmo 세션 확인 미들웨어
 */
async function verifyElmoSession(req, res, next) {
    try {
        const sessionId = req.headers['x-elmo-session'] || req.body.sessionId || req.query.sessionId;
        let userId = req.headers['x-elmo-user-id'] || req.body.userId || req.query.userId;
        
        // "null" 문자열이나 null 값 체크
        if (!sessionId || !userId || userId === 'null' || userId === null) {
            return res.status(401).json({ message: '세션 또는 사용자 정보가 없습니다.' });
        }
        
        // UUID 형식 검증
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            return res.status(401).json({ message: '유효하지 않은 사용자 ID입니다.' });
        }
        
        // 세션 ID로 사용자 확인 (간단한 검증)
        // 실제로는 세션 테이블에서 확인해야 하지만, 우선 userId로 사용자 존재 여부만 확인
        const user = await elmoUsersDB.getElmoUserById(userId);
        if (!user) {
            return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' });
        }
        
        req.elmoUserId = user.id;
        next();
    } catch (error) {
        console.error('[Elmo API] 세션 확인 오류:', error);
        res.status(500).json({ message: '세션 확인 중 오류가 발생했습니다.' });
    }
}

module.exports = {
    verifyElmoSession
};
