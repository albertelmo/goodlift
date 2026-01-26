# Elmo 서비스 계정 역할 설계

## 📋 개요

Elmo 서비스에서 계정을 SU(슈퍼 관리자)/관리자/일반유저로 구분하는 시스템을 설계합니다. 아직 권한에 따른 기능 구현은 하지 않고, 계정에 역할 필드만 추가합니다.

## 🎯 설계 원칙

1. **단순성**: 우선 역할 필드만 추가, 기능 구현은 추후
2. **자동 할당**: 첫 번째 생성 계정을 SU로 자동 설정
3. **확장성**: 향후 admin 역할 추가 가능하도록 설계
4. **하위 호환성**: 기존 사용자는 자동으로 'user' 역할 부여

## 📊 역할 정의

### 역할 종류
- **`su`**: 슈퍼 관리자 (최고 권한, 향후 시스템 관리 기능)
- **`admin`**: 관리자 (향후 일반 관리 기능)
- **`user`**: 일반 유저 (기본 권한, 개인 데이터 관리)

### 역할 계층
```
su (슈퍼 관리자)
  └─ admin (관리자)
      └─ user (일반 유저)
```

## 🗄️ 데이터베이스 설계

### 1. 테이블 수정: `elmo_users`

#### 추가할 컬럼
```sql
ALTER TABLE elmo_users 
ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' 
CHECK (role IN ('su', 'admin', 'user'));
```

#### 컬럼 설명
- **role**: 사용자 역할
  - 타입: `VARCHAR(20)`
  - 기본값: `'user'`
  - 제약조건: `'su'`, `'admin'`, `'user'` 중 하나만 허용
  - 인덱스: 필요 시 `idx_elmo_users_role` 생성

### 2. 마이그레이션 계획

#### 기존 사용자 처리
- 기존 사용자는 모두 `role = 'user'`로 설정
- 첫 번째 사용자(가장 오래된 `created_at`)는 `role = 'su'`로 변경

## 🛠️ 구현 계획

### Phase 1: 데이터베이스 스키마 수정

#### 1.1 테이블 마이그레이션 함수 추가
```javascript
// backend/elmo-users-db.js
async function migrateElmoUsersTable() {
  try {
    // role 컬럼 존재 여부 확인
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'elmo_users' 
        AND column_name = 'role'
    `;
    const checkResult = await pool.query(checkColumnQuery);
    
    if (checkResult.rows.length === 0) {
      // role 컬럼 추가
      await pool.query(`
        ALTER TABLE elmo_users 
        ADD COLUMN role VARCHAR(20) DEFAULT 'user' 
        CHECK (role IN ('su', 'admin', 'user'))
      `);
      
      // 기존 사용자 처리: 가장 오래된 사용자를 SU로 설정
      await pool.query(`
        UPDATE elmo_users 
        SET role = 'su' 
        WHERE id = (
          SELECT id 
          FROM elmo_users 
          ORDER BY created_at ASC 
          LIMIT 1
        )
      `);
      
      // 나머지 사용자는 'user'로 설정 (이미 DEFAULT이지만 명시적으로)
      await pool.query(`
        UPDATE elmo_users 
        SET role = 'user' 
        WHERE role IS NULL OR role = ''
      `);
      
      console.log('[Elmo DB] role 컬럼이 추가되었고, 첫 번째 사용자가 SU로 설정되었습니다.');
    }
  } catch (error) {
    console.error('[Elmo DB] 테이블 마이그레이션 오류:', error);
  }
}
```

#### 1.2 인덱스 추가 (선택사항)
```javascript
async function createElmoUsersRoleIndex() {
  try {
    const checkIndexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'elmo_users' 
        AND indexname = 'idx_elmo_users_role'
    `;
    const checkResult = await pool.query(checkIndexQuery);
    
    if (checkResult.rows.length === 0) {
      await pool.query(`CREATE INDEX idx_elmo_users_role ON elmo_users(role)`);
      console.log('[Elmo DB] idx_elmo_users_role 인덱스가 생성되었습니다.');
    }
  } catch (error) {
    console.error('[Elmo DB] role 인덱스 생성 오류:', error);
  }
}
```

### Phase 2: 회원가입 로직 수정

#### 2.1 첫 번째 계정 자동 SU 할당
```javascript
// backend/elmo-api-router.js
elmoApiRouter.post('/register', async (req, res) => {
    try {
        // ... 기존 검증 로직 ...
        
        // 전체 사용자 수 확인
        const userCountQuery = await elmoUsersDB.pool.query(
            'SELECT COUNT(*) as count FROM elmo_users'
        );
        const userCount = parseInt(userCountQuery.rows[0].count, 10);
        
        // 첫 번째 사용자면 SU, 아니면 user
        const role = userCount === 0 ? 'su' : 'user';
        
        // 사용자 추가
        const newUser = await elmoUsersDB.addElmoUser({
            username,
            password,
            name,
            email,
            role  // 역할 추가
        });
        
        // ... 기존 응답 로직 ...
    } catch (error) {
        // ... 기존 에러 처리 ...
    }
});
```

### Phase 3: DB 함수 수정

#### 3.1 addElmoUser 함수에 role 파라미터 추가
```javascript
// backend/elmo-users-db.js
const addElmoUser = async (userData) => {
  try {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(userData.password, saltRounds);
    
    const query = `
      INSERT INTO elmo_users (username, password_hash, name, email, is_active, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, name, email, is_active, role, created_at, updated_at
    `;
    const values = [
      userData.username,
      password_hash,
      userData.name,
      userData.email || null,
      userData.is_active !== undefined ? userData.is_active : true,
      userData.role || 'user'  // 기본값 'user'
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('[Elmo DB] 사용자 추가 오류:', error);
    throw error;
  }
};
```

#### 3.2 조회 함수에 role 포함
```javascript
// getElmoUserByUsername, getElmoUserById에 role 필드 추가
const query = `
  SELECT id, username, password_hash, name, email, is_active, role, created_at, updated_at, last_login_at
  FROM elmo_users 
  WHERE username = $1
`;
```

### Phase 4: 초기화 함수 수정

```javascript
// backend/elmo-users-db.js
const initializeDatabase = async () => {
  try {
    await createElmoUsersTable();
    await migrateElmoUsersTable();  // 마이그레이션 추가
    await createElmoUsersRoleIndex();  // 인덱스 추가 (선택사항)
    console.log('[PostgreSQL] Elmo 사용자 데이터베이스 초기화 완료');
  } catch (error) {
    console.error('[PostgreSQL] Elmo 사용자 데이터베이스 초기화 오류:', error);
  }
};
```

## 📝 변경 파일 목록

### 필수 변경 파일
1. `backend/elmo-users-db.js`
   - `migrateElmoUsersTable()` 함수 추가
   - `addElmoUser()` 함수에 `role` 파라미터 추가
   - 조회 함수에 `role` 필드 포함
   - `initializeDatabase()`에 마이그레이션 호출 추가

2. `backend/elmo-api-router.js`
   - 회원가입 API에서 첫 번째 계정을 SU로 설정하는 로직 추가

### 선택적 변경 파일
3. `backend/elmo-users-db.js`
   - `createElmoUsersRoleIndex()` 함수 추가 (성능 최적화)

## 🔍 구현 세부사항

### 첫 번째 계정 판별 로직

**방안 1: 사용자 수로 판별 (추천)**
```javascript
const userCount = await getElmoUserCount();
const role = userCount === 0 ? 'su' : 'user';
```
- 장점: 간단하고 명확
- 단점: 동시 가입 시 경쟁 조건 가능성 (낮음)

**방안 2: 트랜잭션으로 안전하게 처리**
```javascript
// 트랜잭션 내에서 사용자 수 확인 및 삽입
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  const countResult = await client.query('SELECT COUNT(*) as count FROM elmo_users');
  const userCount = parseInt(countResult.rows[0].count, 10);
  const role = userCount === 0 ? 'su' : 'user';
  
  // 사용자 삽입
  await client.query(/* INSERT 쿼리 */);
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 기존 사용자 마이그레이션

```javascript
// 가장 오래된 사용자를 SU로 설정
await pool.query(`
  UPDATE elmo_users 
  SET role = 'su' 
  WHERE id = (
    SELECT id 
    FROM elmo_users 
    ORDER BY created_at ASC 
    LIMIT 1
  )
  AND (role IS NULL OR role = '' OR role = 'user')
`);
```

## ⚠️ 주의사항

1. **동시 가입 방지**: 첫 번째 계정 판별 시 트랜잭션 사용 권장
2. **기존 데이터**: 마이그레이션 시 기존 사용자 처리 필수
3. **기본값**: 새 컬럼의 기본값은 'user'로 설정
4. **확장성**: 향후 'admin' 역할 추가 시에도 동일한 구조 사용

## 🚀 향후 확장 계획

### 권한 기반 기능 구현 (추후)
- SU 전용: 시스템 설정, 사용자 관리
- Admin 전용: 통계 조회, 데이터 관리
- User: 개인 캘린더 관리 (현재 기능)

### 역할 변경 기능 (추후)
- SU가 다른 사용자의 역할 변경 가능
- Admin은 User로만 변경 가능
- User는 자신의 역할 변경 불가

## ✅ 체크리스트

- [ ] `elmo_users` 테이블에 `role` 컬럼 추가
- [ ] 마이그레이션 함수 구현
- [ ] 회원가입 시 첫 번째 계정 SU 할당 로직
- [ ] `addElmoUser` 함수에 `role` 파라미터 추가
- [ ] 조회 함수에 `role` 필드 포함
- [ ] 기존 사용자 마이그레이션 (첫 번째 사용자 SU 설정)
- [ ] 인덱스 추가 (선택사항)
- [ ] 테스트 및 검증
