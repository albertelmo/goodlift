// 앱 유저 API 호출 유틸리티

const API_BASE = '/api';

// ========== 캐시 시스템 ==========

/**
 * 간단한 메모리 캐시 구현
 */
const cache = {
    data: new Map(),
    
    /**
     * 캐시 키 생성
     */
    getKey(endpoint, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .map(key => `${key}=${params[key]}`)
            .join('&');
        return `${endpoint}${sortedParams ? '?' + sortedParams : ''}`;
    },
    
    /**
     * 캐시에서 데이터 가져오기
     */
    get(key) {
        const cached = this.data.get(key);
        if (!cached) return null;
        
        // TTL 확인
        if (cached.expiresAt && Date.now() > cached.expiresAt) {
            this.data.delete(key);
            return null;
        }
        
        return cached.data;
    },
    
    /**
     * 캐시에 데이터 저장
     */
    set(key, data, ttl = null) {
        const expiresAt = ttl ? Date.now() + ttl : null;
        this.data.set(key, { data, expiresAt });
    },
    
    /**
     * 캐시 무효화 (패턴 매칭)
     */
    invalidate(pattern) {
        if (typeof pattern === 'string') {
            // 정확한 키 매칭
            this.data.delete(pattern);
        } else if (pattern instanceof RegExp) {
            // 정규식 패턴 매칭
            for (const key of this.data.keys()) {
                if (pattern.test(key)) {
                    this.data.delete(key);
                }
            }
        } else if (typeof pattern === 'function') {
            // 함수로 필터링
            for (const key of this.data.keys()) {
                if (pattern(key)) {
                    this.data.delete(key);
                }
            }
        }
    },
    
    /**
     * 모든 캐시 클리어
     */
    clear() {
        this.data.clear();
    },
    
    /**
     * 만료된 캐시 정리
     */
    cleanup() {
        const now = Date.now();
        for (const [key, cached] of this.data.entries()) {
            if (cached.expiresAt && now > cached.expiresAt) {
                this.data.delete(key);
            }
        }
    }
};

// 주기적으로 만료된 캐시 정리 (5분마다)
setInterval(() => {
    cache.cleanup();
}, 5 * 60 * 1000);

/**
 * API 요청 헬퍼
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // DELETE 요청일 때는 Content-Type 헤더를 설정하지 않음 (body가 없으므로)
    const headers = {};
    
    // FormData인 경우 Content-Type을 설정하지 않음 (브라우저가 자동으로 boundary 포함하여 설정)
    const isFormData = options.body instanceof FormData;
    
    if (options.method !== 'DELETE' && !isFormData) {
        headers['Content-Type'] = 'application/json';
    }
    
    // options.headers가 있으면 병합 (DELETE 메서드에서도 사용자가 명시적으로 헤더를 보낼 수 있음)
    Object.assign(headers, options.headers);
    
    const config = {
        headers,
        credentials: 'include', // 쿠키 포함
        ...options
    };

    // FormData가 아닌 객체만 JSON.stringify
    if (config.body && typeof config.body === 'object' && !isFormData) {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        
        // 응답 본문을 텍스트로 먼저 읽어서 확인
        const text = await response.text();
        
        // 빈 응답 체크
        if (!text || text.trim() === '') {
            throw new Error(`서버에서 빈 응답을 받았습니다. (${response.status} ${response.statusText})`);
        }
        
        let data;
        
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error('[API] JSON 파싱 실패:', {
                url,
                status: response.status,
                statusText: response.statusText,
                responseText: text.substring(0, 500),
                parseError: parseError.message
            });
            throw new Error(`서버 응답 파싱 실패: ${parseError.message}. 응답: ${text.substring(0, 100)}`);
        }
        
        if (!response.ok) {
            throw new Error(data.error || data.message || '요청 처리 중 오류가 발생했습니다.');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

/**
 * GET 요청 (캐싱 지원)
 */
export async function get(endpoint, options = {}) {
    const { useCache = false, ttl = null, cacheKey = null } = options;
    
    // 캐시 키 생성
    const key = cacheKey || cache.getKey(endpoint);
    
    // 캐시에서 가져오기
    if (useCache) {
        const cached = cache.get(key);
        if (cached !== null) {
            return cached;
        }
    }
    
    // API 호출
    const data = await request(endpoint, { method: 'GET' });
    
    // 캐시에 저장
    if (useCache) {
        cache.set(key, data, ttl);
    }
    
    return data;
}

/**
 * POST 요청
 */
export async function post(endpoint, data) {
    return request(endpoint, {
        method: 'POST',
        body: data
    });
}

/**
 * 앱 유저 접속 핑 (활성 통계용)
 */
export async function postAppUserPing(appUserId) {
    if (!appUserId) return null;
    return post('/app-user/ping', { app_user_id: appUserId });
}

/**
 * PATCH 요청
 */
export async function patch(endpoint, data) {
    return request(endpoint, {
        method: 'PATCH',
        body: data
    });
}

/**
 * DELETE 요청
 */
export async function del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
}

// ========== 운동기록 API ==========

/**
 * 운동기록 목록 조회 (캐싱 적용)
 */
export async function getWorkoutRecords(appUserId, filters = {}) {
    // 트레이너 전환 모드인 경우 빈 배열 반환
    if (appUserId && appUserId.startsWith('trainer-')) {
        return [];
    }
    
    const params = new URLSearchParams({ app_user_id: appUserId });
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    
    const endpoint = `/workout-records?${params.toString()}`;
    
    // 캐시 키 생성 (필터 포함)
    const cacheKey = cache.getKey('/workout-records', {
        app_user_id: appUserId,
        start_date: filters.startDate || '',
        end_date: filters.endDate || ''
    });
    
    // 캐시 사용 (30초 TTL)
    return get(endpoint, { 
        useCache: true, 
        ttl: 30 * 1000, // 30초
        cacheKey 
    });
}

/**
 * 운동기록 단일 조회
 */
export async function getWorkoutRecordById(id, appUserId) {
    // 캐시를 사용하지 않음 (항상 최신 데이터 조회)
    return get(`/workout-records/${id}?app_user_id=${appUserId}`, { useCache: false });
}

/**
 * 운동기록 추가 (캐시 무효화 포함)
 */
export async function addWorkoutRecord(data) {
    const actorAppUserId = data?.actor_app_user_id || localStorage.getItem('appUserId');
    const body = actorAppUserId ? { ...data, actor_app_user_id: actorAppUserId } : data;
    
    // 트레이너 정보는 서버에서 자동으로 확인하여 처리
    const result = await post('/workout-records', body);
    
    // 해당 사용자의 운동기록 캐시 무효화 (일반 조회 + 캘린더 조회)
    if (data.app_user_id) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${data.app_user_id}`));
    }
    
    return result;
}

/**
 * 운동기록 일괄 추가 (캐시 무효화 포함)
 * 트레이너 정보는 서버에서 자동으로 확인하여 처리
 */
export async function addWorkoutRecordsBatch(appUserId, workoutRecordsArray, currentUser = null) {
    // 트레이너가 회원에게 접속한 상태인지 확인
    const connectedMemberAppUserId = localStorage.getItem('connectedMemberAppUserId');
    
    // currentUser에서 트레이너 정보 추출
    const currentUsername = currentUser?.username || null;
    const currentUserName = currentUser?.name || null;
    const isTrainer = currentUser?.isTrainer === true;
    
    const body = {
        app_user_id: appUserId,
        workout_records: workoutRecordsArray
    };
    
    const actorAppUserId = currentUser?.id || localStorage.getItem('appUserId');
    if (actorAppUserId) {
        body.actor_app_user_id = actorAppUserId;
    }
    
    // 트레이너가 회원에게 접속한 상태인 경우 trainer_username 전달
    if (connectedMemberAppUserId && connectedMemberAppUserId === appUserId && currentUsername && isTrainer) {
        body.trainer_username = currentUsername;
        body.trainer_name = currentUserName || currentUsername;
    }
    
    const result = await post('/workout-records/batch', body);
    
    // 해당 사용자의 운동기록 캐시 무효화 (일반 조회 + 캘린더 조회)
    if (appUserId) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * 운동기록 수정 (캐시 무효화 포함)
 */
export async function updateWorkoutRecord(id, data) {
    const result = await patch(`/workout-records/${id}`, data);
    
    // 해당 사용자의 운동기록 캐시 무효화 (일반 조회 + 캘린더 조회)
    if (data.app_user_id) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${data.app_user_id}`));
    }
    
    return result;
}

/**
 * 운동기록 삭제 (캐시 무효화 포함)
 */
export async function deleteWorkoutRecord(id, appUserId) {
    const result = await del(`/workout-records/${id}?app_user_id=${appUserId}`);
    
    // 해당 사용자의 운동기록 캐시 무효화
    if (appUserId) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * 운동기록 통계 조회
 */
export async function getWorkoutStats(appUserId, startDate, endDate) {
    const params = new URLSearchParams({
        app_user_id: appUserId,
        start_date: startDate,
        end_date: endDate
    });
    return get(`/workout-records/stats?${params.toString()}`);
}

/**
 * 캘린더용 운동기록 조회 (경량 - 날짜별 완료 여부만)
 */
export async function getWorkoutRecordsForCalendar(appUserId, startDate = null, endDate = null) {
    // 트레이너 전환 모드인 경우 빈 객체 반환
    if (appUserId && appUserId.startsWith('trainer-')) {
        return {};
    }
    
    const params = new URLSearchParams({ app_user_id: appUserId });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const endpoint = `/workout-records/calendar?${params.toString()}`;
    const cacheKey = cache.getKey('/workout-records/calendar', {
        app_user_id: appUserId,
        start_date: startDate || '',
        end_date: endDate || ''
    });
    
    // 캐시 사용 (1분 TTL)
    return get(endpoint, { 
        useCache: true, 
        ttl: 60 * 1000, // 1분
        cacheKey 
    });
}

/**
 * 운동기록 완료 상태 업데이트 (시간 운동용, 캐시 무효화 포함)
 */
export async function updateWorkoutRecordCompleted(id, appUserId, isCompleted) {
    const result = await patch(`/workout-records/${id}/completed`, {
        app_user_id: appUserId,
        is_completed: isCompleted
    });
    
    // 해당 사용자의 운동기록 캐시 무효화
    if (appUserId) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * 세트 완료 상태 업데이트 (캐시 무효화 포함)
 */
export async function updateWorkoutSetCompleted(recordId, setId, appUserId, isCompleted) {
    const result = await patch(`/workout-records/${recordId}/sets/${setId}/completed`, {
        app_user_id: appUserId,
        is_completed: isCompleted
    });
    
    // 해당 사용자의 운동기록 캐시 무효화
    if (appUserId) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * ========== 식단기록 API ==========
 */

/**
 * 식단기록 목록 조회
 */
export async function getDietRecords(appUserId, filters = {}) {
    if (!appUserId) {
        throw new Error('앱 유저 ID가 필요합니다.');
    }
    
    // 트레이너 전환 모드인 경우 빈 배열 반환
    if (appUserId.startsWith('trainer-')) {
        return [];
    }
    
    const params = new URLSearchParams({ app_user_id: appUserId });
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    
    const endpoint = `/diet-records?${params.toString()}`;
    
    // 캐시 키 생성 (필터 포함)
    const cacheKey = cache.getKey('/diet-records', {
        app_user_id: appUserId,
        start_date: filters.startDate || '',
        end_date: filters.endDate || '',
        page: filters.page || '',
        limit: filters.limit || ''
    });
    
    // 캐시 사용 (30초 TTL)
    return get(endpoint, { 
        useCache: true, 
        ttl: 30 * 1000, // 30초
        cacheKey 
    });
}

/**
 * 식단기록 단일 조회
 */
export async function getDietRecordById(id, appUserId) {
    return get(`/diet-records/${id}?app_user_id=${appUserId}`);
}

/**
 * 식단기록 추가 (이미지 업로드 지원)
 */
export async function addDietRecord(formData) {
    const actorAppUserId = localStorage.getItem('appUserId');
    if (actorAppUserId && !formData.get('actor_app_user_id')) {
        formData.append('actor_app_user_id', actorAppUserId);
    }
    const actorUsername = localStorage.getItem('appUsername');
    if (actorUsername && !formData.get('actor_username')) {
        formData.append('actor_username', actorUsername);
    }
    const result = await postFormData('/diet-records', formData);
    
    // 해당 사용자의 식단기록 캐시 무효화
    const appUserId = formData.get('app_user_id');
    if (appUserId) {
        cache.invalidate(key => key.includes(`/diet-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * 식단기록 수정 (이미지 업로드 지원)
 */
export async function updateDietRecord(id, formData) {
    const result = await patchFormData(`/diet-records/${id}`, formData);
    
    // 해당 사용자의 식단기록 캐시 무효화
    const appUserId = formData.get('app_user_id');
    if (appUserId) {
        cache.invalidate(key => key.includes(`/diet-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * 식단 평가 업데이트
 */
export async function updateDietRecordEvaluation(id, data) {
    const result = await patch(`/diet-records/${id}/evaluation`, data);
    
    // 해당 사용자의 식단기록 캐시 무효화
    if (result?.app_user_id) {
        cache.invalidate(key => key.includes(`/diet-records`) && key.includes(`app_user_id=${result.app_user_id}`));
    }
    
    return result;
}

/**
 * 식단기록 삭제 (캐시 무효화 포함)
 */
export async function deleteDietRecord(id, appUserId) {
    const result = await del(`/diet-records/${id}?app_user_id=${appUserId}`);
    
    // 해당 사용자의 식단기록 캐시 무효화
    if (appUserId) {
        cache.invalidate(key => key.includes(`/diet-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * 캘린더용 식단기록 조회 (경량 - 날짜별 존재 여부만)
 */
export async function getDietRecordsForCalendar(appUserId, startDate = null, endDate = null) {
    // 트레이너 전환 모드인 경우 빈 객체 반환
    if (appUserId && appUserId.startsWith('trainer-')) {
        return {};
    }
    
    const params = new URLSearchParams({ app_user_id: appUserId });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const endpoint = `/diet-records/calendar?${params.toString()}`;
    const cacheKey = cache.getKey('/diet-records/calendar', {
        app_user_id: appUserId,
        start_date: startDate || '',
        end_date: endDate || ''
    });
    
    // 캐시 사용 (1분 TTL)
    return get(endpoint, { 
        useCache: true, 
        ttl: 60 * 1000, // 1분
        cacheKey 
    });
}

/**
 * 식단 코멘트 추가
 */
export async function addDietComment(dietRecordId, commentData, appUserId = null) {
    // app_user_id는 commentData에서 가져오거나 별도 파라미터로 받음
    const app_user_id = appUserId || commentData.app_user_id;
    const result = await post(`/diet-records/${dietRecordId}/comments?app_user_id=${app_user_id}`, {
        commenter_type: commentData.commenter_type,
        commenter_id: commentData.commenter_id,
        commenter_name: commentData.commenter_name,
        comment_text: commentData.comment_text
    });
    
    // 해당 사용자의 식단기록 캐시 무효화 (코멘트 개수 변경)
    if (app_user_id) {
        cache.invalidate(key => key.includes(`/diet-records`) && key.includes(`app_user_id=${app_user_id}`));
    }
    
    return result;
}

/**
 * 식단 코멘트 수정
 */
export async function updateDietComment(dietRecordId, commentId, commentData) {
    const result = await patch(`/diet-records/${dietRecordId}/comments/${commentId}`, {
        commenter_type: commentData.commenter_type,
        commenter_id: commentData.commenter_id,
        comment_text: commentData.comment_text
    });
    
    return result;
}

/**
 * 식단 코멘트 삭제
 */
export async function deleteDietComment(dietRecordId, commentId, commenterType, commenterId, appUserId) {
    const result = await del(`/diet-records/${dietRecordId}/comments/${commentId}?commenter_type=${commenterType}&commenter_id=${commenterId}`);
    
    // 해당 사용자의 식단기록 캐시 무효화
    if (appUserId) {
        cache.invalidate(key => key.includes(`/diet-records`) && key.includes(`app_user_id=${appUserId}`));
    }
    
    return result;
}

/**
 * FormData 전송 헬퍼 (POST)
 */
async function postFormData(endpoint, formData) {
    // FormData는 request 함수에서 자동으로 처리됨 (Content-Type 헤더를 설정하지 않음)
    return request(endpoint, {
        method: 'POST',
        body: formData
    });
}

/**
 * FormData 전송 헬퍼 (PATCH)
 */
async function patchFormData(endpoint, formData) {
    // FormData는 request 함수에서 자동으로 처리됨 (Content-Type 헤더를 설정하지 않음)
    return request(endpoint, {
        method: 'PATCH',
        body: formData
    });
}

/**
 * 운동종류 목록 조회 (캐싱 적용 - 변경 빈도 낮음)
 */
export async function getWorkoutTypes() {
    // 캐시 사용 (5분 TTL - 운동종류는 자주 변경되지 않음)
    return get('/workout-types', { 
        useCache: true, 
        ttl: 5 * 60 * 1000 // 5분
    });
}

// ========== 즐겨찾기 운동 API ==========

/**
 * 즐겨찾기 운동 목록 조회 (캐싱 적용)
 */
export async function getFavoriteWorkouts(appUserId) {
    const endpoint = `/favorite-workouts?app_user_id=${appUserId}`;
    const cacheKey = cache.getKey('/favorite-workouts', { app_user_id: appUserId });
    
    // 캐시 사용 (1분 TTL)
    return get(endpoint, { 
        useCache: true, 
        ttl: 60 * 1000, // 1분
        cacheKey 
    });
}

/**
 * 즐겨찾기 운동 추가 (캐시 무효화 포함)
 */
export async function addFavoriteWorkout(appUserId, workoutTypeId) {
    const result = await post('/favorite-workouts', {
        app_user_id: appUserId,
        workout_type_id: workoutTypeId
    });
    
    // 즐겨찾기 캐시 무효화
    cache.invalidate(key => key.includes(`/favorite-workouts`) && key.includes(`app_user_id=${appUserId}`));
    
    return result;
}

/**
 * 즐겨찾기 운동 삭제 (캐시 무효화 포함)
 */
export async function removeFavoriteWorkout(appUserId, workoutTypeId) {
    // URLSearchParams를 사용하여 안전하게 URL 인코딩
    const params = new URLSearchParams({
        app_user_id: appUserId,
        workout_type_id: workoutTypeId
    });
    const result = await del(`/favorite-workouts?${params.toString()}`);
    
    // 즐겨찾기 캐시 무효화
    cache.invalidate(key => key.includes(`/favorite-workouts`) && key.includes(`app_user_id=${appUserId}`));
    
    return result;
}

/**
 * 즐겨찾기 운동 여부 확인
 */
export async function isFavoriteWorkout(appUserId, workoutTypeId) {
    return get(`/favorite-workouts/check?app_user_id=${appUserId}&workout_type_id=${workoutTypeId}`);
}

// ========== 사용자 설정 API ==========

/**
 * 사용자 설정 조회 (캐싱 적용)
 */
export async function getUserSettings(appUserId) {
    const endpoint = `/user-settings?app_user_id=${appUserId}`;
    const cacheKey = cache.getKey('/user-settings', { app_user_id: appUserId });
    
    // 캐시 사용 (1분 TTL)
    return get(endpoint, { 
        useCache: true, 
        ttl: 60 * 1000, // 1분
        cacheKey 
    });
}

/**
 * 사용자 설정 업데이트 (캐시 무효화 포함)
 */
export async function updateUserSettings(appUserId, updates) {
    const result = await patch('/user-settings', {
        app_user_id: appUserId,
        ...updates
    });
    
    // 사용자 설정 캐시 무효화
    cache.invalidate(key => key.includes(`/user-settings`) && key.includes(`app_user_id=${appUserId}`));
    
    return result;
}

// ========== 앱 유저 정보 API ==========

/**
 * 앱 유저 목록 조회 (캐싱 지원)
 */
export async function getAppUsers(filters = {}) {
    const params = new URLSearchParams();
    if (filters.username) params.append('username', filters.username);
    
    const endpoint = `/app-users${params.toString() ? '?' + params.toString() : ''}`;
    const cacheKey = cache.getKey('/app-users', filters);
    
    // 캐시 사용 (1분 TTL - 자주 변경되지 않는 데이터)
    return get(endpoint, {
        useCache: true,
        ttl: 60 * 1000, // 1분
        cacheKey
    });
}

/**
 * 앱 유저 정보 수정 (캐시 무효화 포함)
 */
export async function updateAppUser(id, updates) {
    const result = await patch(`/app-users/${id}`, updates);
    
    // 앱 유저 목록 캐시 무효화
    cache.invalidate(key => key.includes('/app-users'));
    
    return result;
}

// ========== 캐시 관리 함수 ==========

/**
 * 캐시 무효화 (외부에서 사용 가능)
 * @param {string|RegExp|Function} pattern - 무효화할 캐시 키 패턴
 */
export function invalidateCache(pattern) {
    cache.invalidate(pattern);
}

/**
 * 모든 캐시 클리어
 */
export function clearCache() {
    cache.clear();
}

/**
 * 운동기록 캐시 무효화 (특정 사용자)
 */
export function invalidateWorkoutRecordsCache(appUserId) {
    if (appUserId) {
        cache.invalidate(key => key.includes(`/workout-records`) && key.includes(`app_user_id=${appUserId}`));
    } else {
        cache.invalidate(key => key.includes(`/workout-records`));
    }
}

/**
 * 즐겨찾기 캐시 무효화 (특정 사용자)
 */
export function invalidateFavoriteWorkoutsCache(appUserId) {
    if (appUserId) {
        cache.invalidate(key => key.includes(`/favorite-workouts`) && key.includes(`app_user_id=${appUserId}`));
    } else {
        cache.invalidate(key => key.includes(`/favorite-workouts`));
    }
}

/**
 * 사용자 설정 캐시 무효화 (특정 사용자)
 */
export function invalidateUserSettingsCache(appUserId) {
    if (appUserId) {
        cache.invalidate(key => key.includes(`/user-settings`) && key.includes(`app_user_id=${appUserId}`));
    } else {
        cache.invalidate(key => key.includes(`/user-settings`));
    }
}

// ========== 회원 활동 로그 API ==========

/**
 * 회원 활동 로그 조회
 */
export async function getMemberActivityLogs(appUserId, filters = {}) {
    const params = new URLSearchParams();
    params.append('app_user_id', appUserId);
    if (filters.unread_only) params.append('unread_only', 'true');
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const endpoint = `/member-activity-logs?${params.toString()}`;
    return get(endpoint);
}

/**
 * 회원 로그 읽음 처리
 */
export async function markMemberActivityLogAsRead(logId, appUserId) {
    return patch(`/member-activity-logs/${logId}/read`, {
        app_user_id: appUserId
    });
}

/**
 * 회원 전체 로그 읽음 처리
 */
export async function markAllMemberActivityLogsAsRead(appUserId) {
    return patch('/member-activity-logs/read-all', {
        app_user_id: appUserId
    });
}

// ========== 트레이너 활동 로그 API ==========

/**
 * 트레이너 활동 로그 조회
 */
export async function getTrainerActivityLogs(trainerUsername, filters = {}) {
    const params = new URLSearchParams();
    params.append('trainer_username', trainerUsername);
    if (filters.unread_only) params.append('unread_only', 'true');
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const endpoint = `/trainer-activity-logs?${params.toString()}`;
    return get(endpoint);
}

/**
 * 로그 읽음 처리
 */
export async function markActivityLogAsRead(logId, trainerUsername) {
    return patch(`/trainer-activity-logs/${logId}/read`, {
        trainer_username: trainerUsername
    });
}

/**
 * 전체 로그 읽음 처리
 */
export async function markAllActivityLogsAsRead(trainerUsername) {
    return await patch('/trainer-activity-logs/read-all', { trainer_username: trainerUsername });
}

// 운동기록 순서 변경
export async function reorderWorkoutRecords(appUserId, workoutDate, order) {
    return await patch('/workout-records/reorder', {
        app_user_id: appUserId,
        workout_date: workoutDate,
        order: order
    });
}
