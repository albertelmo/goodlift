const { Pool } = require('pg');
const crypto = require('crypto');

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 공유 토큰 테이블 생성
const createConsultationShareTokensTable = async () => {
  try {
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'consultation_share_tokens'
    `;
    const checkResult = await pool.query(checkQuery);
    
    if (checkResult.rows.length === 0) {
      const createQuery = `
        CREATE TABLE consultation_share_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          consultation_record_id UUID NOT NULL REFERENCES consultation_records(id) ON DELETE CASCADE,
          token VARCHAR(64) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          phone VARCHAR(50),
          expires_at TIMESTAMP,
          access_count INTEGER DEFAULT 0,
          last_accessed_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          created_by VARCHAR(100),
          is_active BOOLEAN DEFAULT true
        )
      `;
      await pool.query(createQuery);
      
      // 인덱스 생성
      await pool.query(`CREATE INDEX idx_share_tokens_token ON consultation_share_tokens(token)`);
      await pool.query(`CREATE INDEX idx_share_tokens_consultation_id ON consultation_share_tokens(consultation_record_id)`);
      await pool.query(`CREATE INDEX idx_share_tokens_expires_at ON consultation_share_tokens(expires_at)`);
      
      console.log('[PostgreSQL] 상담기록 공유 토큰 테이블이 생성되었습니다.');
    } else {
      console.log('[PostgreSQL] 상담기록 공유 토큰 테이블이 이미 존재합니다.');
    }
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 공유 토큰 테이블 생성 오류:', error);
  }
};

// 공유 토큰 생성
const createShareToken = async (shareData) => {
  try {
    // 토큰 생성 (64자 hex)
    const token = crypto.randomBytes(32).toString('hex');
    
    const query = `
      INSERT INTO consultation_share_tokens (
        consultation_record_id, token, name, phone, expires_at, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING 
        id, consultation_record_id, token, name, phone, 
        expires_at AT TIME ZONE 'Asia/Seoul' as expires_at,
        access_count, last_accessed_at AT TIME ZONE 'Asia/Seoul' as last_accessed_at,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        created_by, is_active
    `;
    
    const values = [
      shareData.consultation_record_id,
      token,
      shareData.name,
      shareData.phone || null,
      shareData.expires_at || null,
      shareData.created_by || null
    ];
    
    const result = await pool.query(query, values);
    const row = result.rows[0];
    
    if (!row) return null;
    
    // 타임스탬프 변환
    if (row.expires_at) {
      const date = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        row.expires_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
      }
    }
    
    if (row.created_at) {
      const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
      }
    }
    
    return row;
  } catch (error) {
    console.error('[PostgreSQL] 공유 토큰 생성 오류:', error);
    throw error;
  }
};

// 토큰으로 공유 정보 조회 (접근 시)
const getShareTokenByToken = async (token) => {
  try {
    const query = `
      SELECT 
        id, consultation_record_id, token, name, phone,
        expires_at AT TIME ZONE 'Asia/Seoul' as expires_at,
        access_count, last_accessed_at AT TIME ZONE 'Asia/Seoul' as last_accessed_at,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        created_by, is_active
      FROM consultation_share_tokens
      WHERE token = $1
    `;
    
    const result = await pool.query(query, [token]);
    const row = result.rows[0];
    
    if (!row) return null;
    
    // 타임스탬프 변환
    if (row.expires_at) {
      const date = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        row.expires_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
      }
    }
    
    if (row.last_accessed_at) {
      const date = row.last_accessed_at instanceof Date ? row.last_accessed_at : new Date(row.last_accessed_at);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        row.last_accessed_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
      }
    }
    
    return row;
  } catch (error) {
    console.error('[PostgreSQL] 공유 토큰 조회 오류:', error);
    throw error;
  }
};

// 접근 횟수 증가 및 마지막 접근 시간 업데이트
const incrementAccessCount = async (token) => {
  try {
    const query = `
      UPDATE consultation_share_tokens
      SET 
        access_count = access_count + 1,
        last_accessed_at = NOW() AT TIME ZONE 'Asia/Seoul'
      WHERE token = $1
      RETURNING access_count, last_accessed_at AT TIME ZONE 'Asia/Seoul' as last_accessed_at
    `;
    
    const result = await pool.query(query, [token]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 접근 횟수 증가 오류:', error);
    throw error;
  }
};

// 상담기록 ID로 모든 공유 토큰 조회
const getShareTokensByConsultationId = async (consultationId) => {
  try {
    const query = `
      SELECT 
        id, consultation_record_id, token, name, phone,
        expires_at AT TIME ZONE 'Asia/Seoul' as expires_at,
        access_count, last_accessed_at AT TIME ZONE 'Asia/Seoul' as last_accessed_at,
        created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        created_by, is_active
      FROM consultation_share_tokens
      WHERE consultation_record_id = $1
      ORDER BY created_at DESC
    `;
    
    const result = await pool.query(query, [consultationId]);
    
    // 타임스탬프 변환
    return result.rows.map(row => {
      if (row.expires_at) {
        const date = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.expires_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      }
      
      if (row.last_accessed_at) {
        const date = row.last_accessed_at instanceof Date ? row.last_accessed_at : new Date(row.last_accessed_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.last_accessed_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      }
      
      if (row.created_at) {
        const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      }
      
      return row;
    });
  } catch (error) {
    console.error('[PostgreSQL] 공유 토큰 목록 조회 오류:', error);
    throw error;
  }
};

// 공유 토큰 비활성화
const updateShareToken = async (shareId, updates) => {
  try {
    const allowedFields = ['is_active'];
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }
    
    if (updateFields.length === 0) {
      return null;
    }
    
    values.push(shareId);
    const query = `
      UPDATE consultation_share_tokens
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, is_active
    `;
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 공유 토큰 수정 오류:', error);
    throw error;
  }
};

// 공유 토큰 삭제
const deleteShareToken = async (shareId) => {
  try {
    const query = `
      DELETE FROM consultation_share_tokens
      WHERE id = $1
      RETURNING id
    `;
    
    const result = await pool.query(query, [shareId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('[PostgreSQL] 공유 토큰 삭제 오류:', error);
    throw error;
  }
};

// 모든 활성 공유 토큰 조회 (상담기록 정보 포함)
const getAllActiveShareTokens = async () => {
  try {
    const query = `
      SELECT 
        st.id,
        st.consultation_record_id,
        st.token,
        st.name,
        st.phone,
        st.expires_at AT TIME ZONE 'Asia/Seoul' as expires_at,
        st.access_count,
        st.last_accessed_at AT TIME ZONE 'Asia/Seoul' as last_accessed_at,
        st.created_at AT TIME ZONE 'Asia/Seoul' as created_at,
        st.created_by,
        st.is_active,
        cr.name as consultation_name,
        cr.center,
        cr.trainer_username,
        cr.created_at AT TIME ZONE 'Asia/Seoul' as consultation_created_at
      FROM consultation_share_tokens st
      INNER JOIN consultation_records cr ON st.consultation_record_id = cr.id
      WHERE st.is_active = true
      ORDER BY st.created_at DESC
    `;
    
    const result = await pool.query(query);
    
    // 타임스탬프 변환
    return result.rows.map(row => {
      if (row.expires_at) {
        const date = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.expires_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      }
      
      if (row.created_at) {
        const date = row.created_at instanceof Date ? row.created_at : new Date(row.created_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      }
      
      if (row.consultation_created_at) {
        const date = row.consultation_created_at instanceof Date ? row.consultation_created_at : new Date(row.consultation_created_at);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          const seconds = String(date.getSeconds()).padStart(2, '0');
          row.consultation_created_at = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+09:00`;
        }
      }
      
      return row;
    });
  } catch (error) {
    console.error('[PostgreSQL] 활성 공유 토큰 조회 오류:', error);
    throw error;
  }
};

// 데이터베이스 초기화
const initializeDatabase = async () => {
  try {
    await createConsultationShareTokensTable();
    console.log('[PostgreSQL] 상담기록 공유 토큰 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] 상담기록 공유 토큰 데이터베이스 초기화 오류:', error);
  }
};

module.exports = {
  initializeDatabase,
  createShareToken,
  getShareTokenByToken,
  incrementAccessCount,
  getShareTokensByConsultationId,
  updateShareToken,
  deleteShareToken,
  getAllActiveShareTokens
};
