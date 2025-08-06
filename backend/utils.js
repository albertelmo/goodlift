// 한국 시간대 유틸리티 함수들

// 한국 시간대 기준 오늘 날짜 반환 (YYYY-MM-DD 형식)
const getKoreanDate = () => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreanTime.toISOString().split('T')[0];
};

// 한국 시간대 기준 현재 시간 반환 (YYYY-MM-DD HH:mm:ss 형식)
const getKoreanDateTime = () => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  return koreanTime.toISOString().slice(0, 19).replace('T', ' ');
};

module.exports = {
  getKoreanDate,
  getKoreanDateTime
}; 