# 변동지출 세금 Type 추가 설계

## 1. 개요
변동지출 내역 등록 시 세금 문서 유형(tax_type)을 선택할 수 있도록 기능을 추가합니다.

**중요**: 세금 type은 센터와 무관하게 동작합니다. 즉, 세금 type 선택은 센터 선택과 독립적이며, 모든 센터에서 동일한 세금 type 옵션을 사용합니다.

## 2. 데이터베이스 스키마 변경

### 2.1 변동지출 테이블 컬럼 추가
- **컬럼명**: `tax_type`
- **데이터 타입**: `VARCHAR(50)`
- **제약조건**: `NULL` 허용 (기존 데이터 호환성)
- **설명**: 세금 문서 유형을 저장

### 2.2 세금 Type 옵션
다음 중 하나의 값을 가집니다:
- `'tax_invoice_vat_included'` - 세금계산서 (부가세 포함)
- `'tax_invoice_vat_separate'` - 세금계산서 (부가세 별도)
- `'invoice_vat_included'` - 계산서 (부가세 포함)
- `'invoice_vat_separate'` - 계산서 (부가세 별도)
- `'receipt'` - 영수증
- `'other'` - 기타
- `NULL` - 미지정 (기존 데이터 호환)

### 2.3 마이그레이션 전략
- 기존 데이터는 `tax_type = NULL`로 유지
- 새로 추가되는 데이터부터 `tax_type` 선택 가능
- 마이그레이션 함수에서 컬럼 존재 여부 확인 후 추가

## 3. 백엔드 변경사항

### 3.1 `backend/ledger-db.js`

#### 3.1.1 테이블 생성 함수 수정
```javascript
// createVariableExpenseTable 함수 내부
CREATE TABLE variable_expenses (
  ...
  tax_type VARCHAR(50),
  ...
)
```

#### 3.1.2 마이그레이션 함수 수정
```javascript
// migrateVariableExpenseTable 함수 내부
const requiredColumns = {
  ...
  'tax_type': 'VARCHAR(50)',
  ...
}
```

#### 3.1.3 조회 함수 수정
```javascript
// getVariableExpenses 함수
SELECT id, center, month, date, item, amount, note, tax_type, created_at, updated_at
FROM variable_expenses
```

#### 3.1.4 추가 함수 수정
```javascript
// addVariableExpense 함수
INSERT INTO variable_expenses (center, month, date, item, amount, note, tax_type)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```

#### 3.1.5 수정 함수 수정
```javascript
// updateVariableExpense 함수
if (updates.taxType !== undefined) {
  fields.push(`tax_type = $${paramIndex++}`);
  values.push(updates.taxType);
}
```

### 3.2 `backend/server.js`

#### 3.2.1 변동지출 추가 API 수정
```javascript
app.post('/api/variable-expenses', async (req, res) => {
  const { center, month, date, item, amount, note, taxType } = req.body;
  // ...
  const expense = {
    center,
    month,
    date,
    item,
    amount: parseInt(amount) || 0,
    note: note || null,
    taxType: taxType || null
  };
  // ...
});
```

#### 3.2.2 변동지출 수정 API 수정
```javascript
app.patch('/api/variable-expenses/:id', async (req, res) => {
  // taxType 필드가 있으면 updates에 포함
  // ...
});
```

#### 3.2.3 이전월 데이터 복사 API 수정
```javascript
// POST /api/ledger/copy-previous-month
await ledgerDB.addVariableExpense({
  center: expense.center,
  month: toMonth,
  date: expense.date,
  item: expense.item,
  amount: expense.amount,
  note: expense.note,
  taxType: expense.tax_type || null
});
```

## 4. 프론트엔드 변경사항

### 4.1 `public/js/ledger.js`

#### 4.1.1 세금 Type 옵션 정의
```javascript
const TAX_TYPE_OPTIONS = [
  { value: 'tax_invoice_vat_included', label: '세금계산서 (부가세 포함)' },
  { value: 'tax_invoice_vat_separate', label: '세금계산서 (부가세 별도)' },
  { value: 'invoice_vat_included', label: '계산서 (부가세 포함)' },
  { value: 'invoice_vat_separate', label: '계산서 (부가세 별도)' },
  { value: 'receipt', label: '영수증' },
  { value: 'other', label: '기타' }
];
```

#### 4.1.2 변동지출 추가 모달 수정
```javascript
function showVariableExpenseAddModal() {
  // ...
  // 센터 선택 필드 다음에 세금 Type 필드 추가
  // 세금 Type은 센터와 무관하게 동작하므로 센터 선택과 독립적으로 배치
  <div>
    <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">세금 Type</label>
    <select id="ledger-variable-add-tax-type" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
      <option value="">선택 안함</option>
      ${TAX_TYPE_OPTIONS.map(opt => `<option value="${opt.value}">${opt.label}</option>`).join('')}
    </select>
    <div style="font-size:0.75rem;color:#666;margin-top:4px;">※ 센터와 무관하게 선택 가능</div>
  </div>
  // ...
}
```

#### 4.1.3 변동지출 수정 모달 수정
```javascript
function showVariableExpenseEditModal(expense) {
  // ...
  // 센터 선택 필드 다음에 세금 Type 필드 추가
  // 세금 Type은 센터와 무관하게 동작하므로 센터 선택과 독립적으로 배치
  <div>
    <label style="display:block;font-size:0.9rem;font-weight:600;color:#333;margin-bottom:6px;">세금 Type</label>
    <select id="ledger-variable-edit-tax-type" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;font-size:0.95rem;box-sizing:border-box;">
      <option value="">선택 안함</option>
      ${TAX_TYPE_OPTIONS.map(opt => `<option value="${opt.value}" ${expense.tax_type === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('')}
    </select>
    <div style="font-size:0.75rem;color:#666;margin-top:4px;">※ 센터와 무관하게 선택 가능</div>
  </div>
  // ...
}
```

#### 4.1.4 변동지출 추가 폼 제출 수정
```javascript
// 변동지출 추가 폼 제출 이벤트 리스너
const taxType = document.getElementById('ledger-variable-add-tax-type').value || null;
const expense = {
  center,
  month,
  date: date || null,
  item,
  amount: parseAmount(amountInput.value),
  note: note || null,
  taxType: taxType || null
};
```

#### 4.1.5 변동지출 수정 폼 제출 수정
```javascript
// 변동지출 수정 폼 제출 이벤트 리스너
const taxType = document.getElementById('ledger-variable-edit-tax-type').value || null;
const updates = {
  center,
  month,
  date: date || null,
  item,
  amount: parseAmount(amountInput.value),
  note: note || null,
  taxType: taxType || null
};
```

#### 4.1.6 변동지출 리스트 표시 수정
변동지출 리스트에 세금 Type 컬럼을 추가할지 결정 필요:
- 옵션 1: 리스트에 세금 Type 컬럼 추가 (테이블이 넓어짐)
- 옵션 2: 리스트에는 표시하지 않고, 상세보기/수정 모달에서만 표시 (현재 구조 유지)

**권장**: 옵션 2 (리스트는 간결하게 유지, 상세 정보는 모달에서 확인)

## 5. 구현 순서

1. **데이터베이스 마이그레이션**
   - `backend/ledger-db.js`의 `migrateVariableExpenseTable` 함수에 `tax_type` 컬럼 추가 로직 구현
   - 테이블 생성 함수에도 `tax_type` 컬럼 추가

2. **백엔드 API 수정**
   - `backend/ledger-db.js`의 CRUD 함수들에 `tax_type` 처리 추가
   - `backend/server.js`의 변동지출 API 엔드포인트에 `taxType` 필드 처리 추가
   - 이전월 데이터 복사 API에 `taxType` 복사 로직 추가

3. **프론트엔드 UI 수정**
   - `public/js/ledger.js`에 세금 Type 옵션 상수 정의
   - 변동지출 추가/수정 모달에 세금 Type 선택 필드 추가
   - 폼 제출 시 `taxType` 필드 포함

4. **테스트**
   - 변동지출 추가 시 세금 Type 선택 테스트
   - 변동지출 수정 시 세금 Type 변경 테스트
   - 이전월 데이터 복사 시 세금 Type 복사 테스트
   - 기존 데이터 조회 시 `tax_type = NULL` 처리 확인

## 6. 주의사항

1. **기존 데이터 호환성**: 기존 데이터는 `tax_type = NULL`이므로, UI에서 NULL 값을 "미지정" 또는 "선택 안함"으로 표시
2. **필수 여부**: 세금 Type은 선택 사항(optional)으로 구현 (기존 데이터 호환성)
3. **데이터 검증**: 백엔드에서 허용된 값만 저장하도록 검증 로직 추가 고려
4. **리스트 표시**: 변동지출 리스트에 세금 Type을 표시할지 여부는 사용자 요구사항에 따라 결정
5. **센터 독립성**: 세금 type은 센터와 무관하게 동작합니다. 센터 선택과 세금 type 선택은 완전히 독립적이며, 모든 센터에서 동일한 세금 type 옵션을 사용합니다.

## 7. 향후 확장 가능성

- 세금 Type별 통계/집계 기능
- 세금 Type별 필터링 기능
- 세금 Type별 보고서 생성
