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

// 한국 시간대 기준 현재 년월 반환 (YYYY-MM 형식)
const getKoreanYearMonth = () => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  const year = koreanTime.getFullYear();
  const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

// 한국 시간대 기준 오늘 날짜의 Date 객체 반환 (시간은 00:00:00으로 설정)
const getKoreanToday = () => {
  const now = new Date();
  const koreanTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  koreanTime.setHours(0, 0, 0, 0);
  return koreanTime;
};

// 한국 시간대 기준으로 날짜 문자열을 Date 객체로 변환
const parseKoreanDate = (dateString) => {
  const date = new Date(dateString);
  const koreanTime = new Date(date.getTime() + (9 * 60 * 60 * 1000)); // UTC+9
  koreanTime.setHours(0, 0, 0, 0);
  return koreanTime;
};

module.exports = {
  getKoreanDate,
  getKoreanDateTime,
  getKoreanYearMonth,
  getKoreanToday,
  parseKoreanDate
}; 