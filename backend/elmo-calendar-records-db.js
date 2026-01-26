// Elmo 캘린더 기록 데이터베이스 모듈

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

/**
 * 데이터베이스 초기화
 */
async function initializeDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS elmo_calendar_records (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                record_date DATE NOT NULL,
                type VARCHAR(20) NOT NULL CHECK (type IN ('일정', 'ToDo')),
                text_content TEXT,
                image_url TEXT,
                video_url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES elmo_users(id) ON DELETE CASCADE
            )
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_elmo_calendar_records_user_date 
            ON elmo_calendar_records(user_id, record_date)
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_elmo_calendar_records_type 
            ON elmo_calendar_records(type)
        `);
        
        console.log('[Elmo Calendar Records DB] 테이블 초기화 완료');
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 초기화 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 캘린더 기록 추가
 */
async function addCalendarRecord(userId, recordData) {
    const { record_date, type, text_content, image_url, video_url } = recordData;
    
    const client = await pool.connect();
    try {
        const result = await client.query(
            `INSERT INTO elmo_calendar_records 
             (user_id, record_date, type, text_content, image_url, video_url)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [userId, record_date, type, text_content || null, image_url || null, video_url || null]
        );
        
        return result.rows[0];
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 추가 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 날짜별 기록 조회
 */
async function getRecordsByDate(userId, date) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM elmo_calendar_records 
             WHERE user_id = $1 AND record_date = $2 
             ORDER BY created_at ASC`,
            [userId, date]
        );
        
        return result.rows;
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 조회 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 월별 기록 요약 조회 (캘린더 표시용)
 */
async function getRecordsSummaryByMonth(userId, year, month) {
    const client = await pool.connect();
    try {
        // PostgreSQL에서 날짜를 문자열로 직접 변환하여 시간대 문제 방지
        const result = await client.query(
            `SELECT 
                TO_CHAR(record_date, 'YYYY-MM-DD') as record_date,
                COUNT(*) as count,
                BOOL_OR(type = '일정') as has_schedule,
                BOOL_OR(type = 'ToDo') as has_todo
             FROM elmo_calendar_records 
             WHERE user_id = $1 
             AND EXTRACT(YEAR FROM record_date) = $2 
             AND EXTRACT(MONTH FROM record_date) = $3
             GROUP BY record_date`,
            [userId, year, month]
        );
        
        const summary = {};
        result.rows.forEach(row => {
            // PostgreSQL의 TO_CHAR로 이미 YYYY-MM-DD 형식의 문자열로 반환됨
            const dateStr = String(row.record_date).split('T')[0];
            
            summary[dateStr] = {
                hasRecord: true,
                count: parseInt(row.count),
                hasSchedule: row.has_schedule,
                hasTodo: row.has_todo
            };
        });
        
        return summary;
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 요약 조회 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 기록 상세 조회
 */
async function getRecordById(userId, recordId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT * FROM elmo_calendar_records 
             WHERE id = $1 AND user_id = $2`,
            [recordId, userId]
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 상세 조회 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 기록 업데이트
 */
async function updateCalendarRecord(userId, recordId, updates) {
    const { text_content, image_url, video_url } = updates;
    
    const client = await pool.connect();
    try {
        const setParts = [];
        const values = [];
        let paramIndex = 1;
        
        if (text_content !== undefined) {
            setParts.push(`text_content = $${paramIndex++}`);
            values.push(text_content);
        }
        if (image_url !== undefined) {
            setParts.push(`image_url = $${paramIndex++}`);
            values.push(image_url);
        }
        if (video_url !== undefined) {
            setParts.push(`video_url = $${paramIndex++}`);
            values.push(video_url);
        }
        
        if (setParts.length === 0) {
            // 업데이트할 내용이 없으면 현재 레코드 반환
            return await getRecordById(userId, recordId);
        }
        
        setParts.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(userId, recordId);
        
        const result = await client.query(
            `UPDATE elmo_calendar_records 
             SET ${setParts.join(', ')}
             WHERE user_id = $${paramIndex++} AND id = $${paramIndex++}
             RETURNING *`,
            values
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 업데이트 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * 기록 삭제
 */
async function deleteRecord(userId, recordId) {
    const client = await pool.connect();
    try {
        const result = await client.query(
            `DELETE FROM elmo_calendar_records 
             WHERE id = $1 AND user_id = $2 
             RETURNING *`,
            [recordId, userId]
        );
        
        return result.rows[0] || null;
    } catch (error) {
        console.error('[Elmo Calendar Records DB] 삭제 오류:', error);
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    initializeDatabase,
    addCalendarRecord,
    getRecordsByDate,
    getRecordsSummaryByMonth,
    getRecordById,
    updateCalendarRecord,
    deleteRecord
};
