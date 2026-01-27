# 트레이너 장부 CRUD 함수 구현 가이드

SU 장부에서 트레이너 장부의 추가/수정/삭제 기능을 구현하기 위한 가이드입니다.

## 구현 패턴

모든 함수는 다음 패턴을 따릅니다:

1. `trainerUsername` 파라미터를 받습니다
2. API 호출 시 body에 `trainer: trainerUsername` 포함
3. 저장/수정/삭제 후 `loadTrainerLedger(trainerSelect.value)` 호출하여 리로드

## 구현해야 할 함수들

### 고정지출
- `showTrainerFixedExpenseAddModal(trainerUsername)` - trainer-ledger.js의 `showFixedExpenseAddModal()` 참고
- `showTrainerFixedExpenseEditModal(id, trainerUsername)` - trainer-ledger.js의 `showFixedExpenseEditModal()` 참고
- `deleteTrainerFixedExpense(id, trainerUsername)` - API DELETE 호출

### 변동지출
- `showTrainerVariableExpenseAddModal(trainerUsername)` - trainer-ledger.js의 `showVariableExpenseAddModal()` 참고
- `showTrainerVariableExpenseEditModal(id, trainerUsername)` - trainer-ledger.js의 `showVariableExpenseEditModal()` 참고
- `deleteTrainerVariableExpense(id, trainerUsername)` - API DELETE 호출

### 급여
- `showTrainerSalaryAddModal(trainerUsername)` - trainer-ledger.js의 `showSalaryAddModal()` 참고
- `showTrainerSalaryEditModal(id, trainerUsername)` - trainer-ledger.js의 `showSalaryEditModal()` 참고
- `deleteTrainerSalary(id, trainerUsername)` - API DELETE 호출

## 주요 차이점

1. 모달 클래스명: `trainer-ledger-*` → `ledger-trainer-*`
2. API 호출 시 body에 `trainer: trainerUsername` 추가
3. 저장 후 `loadTrainerLedger(trainerSelect.value)` 호출
