// 앱 유저 API 호출 유틸리티

const API_BASE = '/api';

/**
 * API 요청 헬퍼
 */
async function request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    
    // DELETE 요청일 때는 Content-Type 헤더를 설정하지 않음 (body가 없으므로)
    const headers = {};
    if (options.method !== 'DELETE') {
        headers['Content-Type'] = 'application/json';
    }
    
    // options.headers가 있으면 병합 (DELETE 메서드에서도 사용자가 명시적으로 헤더를 보낼 수 있음)
    Object.assign(headers, options.headers);
    
    const config = {
        headers,
        ...options
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    try {
        const response = await fetch(url, config);
        const data = await response.json();
        
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
 * GET 요청
 */
export async function get(endpoint) {
    return request(endpoint, { method: 'GET' });
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
 * 운동기록 목록 조회
 */
export async function getWorkoutRecords(appUserId, filters = {}) {
    // 트레이너 전환 모드인 경우 빈 배열 반환
    if (appUserId && appUserId.startsWith('trainer-')) {
        return [];
    }
    
    const params = new URLSearchParams({ app_user_id: appUserId });
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    
    return get(`/workout-records?${params.toString()}`);
}

/**
 * 운동기록 단일 조회
 */
export async function getWorkoutRecordById(id, appUserId) {
    return get(`/workout-records/${id}?app_user_id=${appUserId}`);
}

/**
 * 운동기록 추가
 */
export async function addWorkoutRecord(data) {
    return post('/workout-records', data);
}

/**
 * 운동기록 수정
 */
export async function updateWorkoutRecord(id, data) {
    return patch(`/workout-records/${id}`, data);
}

/**
 * 운동기록 삭제
 */
export async function deleteWorkoutRecord(id, appUserId) {
    return del(`/workout-records/${id}?app_user_id=${appUserId}`);
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
 * 운동기록 완료 상태 업데이트 (시간 운동용)
 */
export async function updateWorkoutRecordCompleted(id, appUserId, isCompleted) {
    return patch(`/workout-records/${id}/completed`, {
        app_user_id: appUserId,
        is_completed: isCompleted
    });
}

/**
 * 세트 완료 상태 업데이트
 */
export async function updateWorkoutSetCompleted(recordId, setId, appUserId, isCompleted) {
    return patch(`/workout-records/${recordId}/sets/${setId}/completed`, {
        app_user_id: appUserId,
        is_completed: isCompleted
    });
}

/**
 * 운동종류 목록 조회
 */
export async function getWorkoutTypes() {
    return get('/workout-types');
}

// ========== 즐겨찾기 운동 API ==========

/**
 * 즐겨찾기 운동 목록 조회
 */
export async function getFavoriteWorkouts(appUserId) {
    return get(`/favorite-workouts?app_user_id=${appUserId}`);
}

/**
 * 즐겨찾기 운동 추가
 */
export async function addFavoriteWorkout(appUserId, workoutTypeId) {
    return post('/favorite-workouts', {
        app_user_id: appUserId,
        workout_type_id: workoutTypeId
    });
}

/**
 * 즐겨찾기 운동 삭제
 */
export async function removeFavoriteWorkout(appUserId, workoutTypeId) {
    // URLSearchParams를 사용하여 안전하게 URL 인코딩
    const params = new URLSearchParams({
        app_user_id: appUserId,
        workout_type_id: workoutTypeId
    });
    return del(`/favorite-workouts?${params.toString()}`);
}

/**
 * 즐겨찾기 운동 여부 확인
 */
export async function isFavoriteWorkout(appUserId, workoutTypeId) {
    return get(`/favorite-workouts/check?app_user_id=${appUserId}&workout_type_id=${workoutTypeId}`);
}

// ========== 사용자 설정 API ==========

/**
 * 사용자 설정 조회
 */
export async function getUserSettings(appUserId) {
    return get(`/user-settings?app_user_id=${appUserId}`);
}

/**
 * 사용자 설정 업데이트
 */
export async function updateUserSettings(appUserId, updates) {
    return patch('/user-settings', {
        app_user_id: appUserId,
        ...updates
    });
}
