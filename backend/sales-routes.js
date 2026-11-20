function registerSalesRoutes(app, { db, basePath, notify, upload, ExcelJS, fs, DATA_PATH, isAdminOrSu }) {
app.post(`${basePath}/upload-excel`, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: '파일을 선택해주세요.' });
        }

        // 파일 크기 검증 (10MB 제한)
        if (req.file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ message: '파일 크기는 10MB 이하여야 합니다.' });
        }

        // 엑셀 파일 읽기
        let workbook;
        try {
            workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);
            
            if (workbook.worksheets.length === 0) {
                return res.status(400).json({ message: '엑셀 파일에 시트가 없습니다.' });
            }
        } catch (excelError) {
            console.error('[API] 엑셀 파일 읽기 오류:', excelError);
            return res.status(400).json({ message: '엑셀 파일을 읽을 수 없습니다. 파일이 손상되었거나 지원하지 않는 형식입니다.' });
        }

        // 헬퍼 함수: 띄어쓰기 제거 후 비교
        const normalizeHeader = (header) => {
            if (!header) return '';
            return String(header).trim().replace(/\s+/g, ''); // 모든 공백 제거
        };

        // 시트 이름에서 연월 추출 (예: "25.01" -> "2025-01")
        const parseYearMonth = (sheetName) => {
            const match = String(sheetName).match(/^(\d{2})\.(\d{2})$/);
            if (!match) return null;
            const year = parseInt(match[1], 10);
            const month = match[2];
            // 2000년대 가정 (25 -> 2025)
            const fullYear = year < 50 ? 2000 + year : 1900 + year;
            return `${fullYear}-${month}`;
        };

        const allResults = [];
        let totalSaved = 0;
        let totalSkipped = 0;

        // 각 시트 처리
        for (const worksheet of workbook.worksheets) {
            const sheetName = worksheet.name.trim();
            const yearMonth = parseYearMonth(sheetName);
            
            if (!yearMonth) {
                console.log(`[API] 시트 "${sheetName}"의 연월 형식을 인식할 수 없습니다. (예: 25.01)`);
                totalSkipped++;
                continue;
            }

            // 최대 컬럼 수 확인
            let maxColumnCount = 0;
            worksheet.eachRow((row) => {
                row.eachCell((cell, colNumber) => {
                    if (colNumber > maxColumnCount) {
                        maxColumnCount = colNumber;
                    }
                });
            });

            // 모든 행 읽기
            const rows = [];
            worksheet.eachRow((row) => {
                const rowData = new Array(maxColumnCount).fill(null);
                row.eachCell((cell, colNumber) => {
                    rowData[colNumber - 1] = cell.value;
                });
                rows.push(rowData);
            });

            if (rows.length < 2) {
                console.log(`[API] 시트 "${sheetName}"에 데이터가 없습니다. (헤더 제외 최소 1개 행 필요)`);
                totalSkipped++;
                continue;
            }

            // 헤더 확인 (첫 번째 행)
            const headers = rows[0];
            if (!headers || headers.length === 0) {
                console.log(`[API] 시트 "${sheetName}"의 헤더를 읽을 수 없습니다.`);
                totalSkipped++;
                continue;
            }

            // 정규화된 헤더 맵 생성
            const normalizedHeaders = headers.map((h, idx) => ({
                original: String(h || '').trim(),
                normalized: normalizeHeader(h),
                index: idx
            }));

            // 컬럼 인덱스 찾기
            const findColumnIndex = (targetKeys) => {
                const normalizedTargets = Array.isArray(targetKeys) 
                    ? targetKeys.map(k => normalizeHeader(k))
                    : [normalizeHeader(targetKeys)];
                const found = normalizedHeaders.find(h => normalizedTargets.includes(h.normalized));
                return found ? found.index : -1;
            };

            // 필수 컬럼 찾기
            const dateIndex = findColumnIndex(['날짜', '일자', 'date']);
            const memberNameIndex = findColumnIndex(['회원명', '회원이름', '이름', 'membername', 'name']);
            const amountIndex = findColumnIndex(['금액', 'amount', '매출금액']);

            // 필수 컬럼 존재 여부 확인
            const missingColumns = [];
            if (dateIndex === -1) missingColumns.push('날짜');
            if (memberNameIndex === -1) missingColumns.push('회원명');
            if (amountIndex === -1) missingColumns.push('금액');

            if (missingColumns.length > 0) {
                console.log(`[API] 시트 "${sheetName}"에서 필수 컬럼을 찾을 수 없습니다: ${missingColumns.join(', ')}`);
                totalSkipped++;
                continue;
            }

            // 선택 컬럼 찾기
            const membershipIndex = findColumnIndex(['회원권', 'membership']);
            const paymentMethodIndex = findColumnIndex(['결제방법', '결제', 'paymentmethod', 'payment']);
            const notesIndex = findColumnIndex(['비고', 'notes', '메모', 'memo']);
            const isNewIndex = findColumnIndex(['신규', 'isnew', 'is_new']);

            // 데이터 처리 (헤더 제외)
            const salesToSave = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (row.length === 0 || row.every(cell => !cell)) continue; // 빈 행 스킵

                const dateValue = row[dateIndex];
                const memberName = String(row[memberNameIndex] || '').trim();
                const amountValue = row[amountIndex];

                // 필수 필드 검증
                if (!dateValue || !memberName || amountValue === null || amountValue === undefined) {
                    continue;
                }

                // 날짜 처리
                let dateStr;
                if (dateValue instanceof Date) {
                    // Date 객체인 경우
                    const year = dateValue.getFullYear();
                    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
                    const day = String(dateValue.getDate()).padStart(2, '0');
                    dateStr = `${year}-${month}-${day}`;
                } else {
                    // 문자열인 경우 (예: "2025-01-15" 또는 "2025/01/15")
                    const dateStrRaw = String(dateValue).trim();
                    // 다양한 날짜 형식 처리
                    if (dateStrRaw.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        dateStr = dateStrRaw;
                    } else if (dateStrRaw.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
                        dateStr = dateStrRaw.replace(/\//g, '-');
                    } else {
                        // Excel 날짜 숫자로 저장된 경우 처리 (선택사항)
                        try {
                            const excelDate = parseFloat(dateStrRaw);
                            if (!isNaN(excelDate)) {
                                // Excel 날짜는 1900-01-01부터의 일수
                                const baseDate = new Date(1900, 0, 1);
                                baseDate.setDate(baseDate.getDate() + excelDate - 2); // Excel은 1900-01-01을 1로 계산
                                const year = baseDate.getFullYear();
                                const month = String(baseDate.getMonth() + 1).padStart(2, '0');
                                const day = String(baseDate.getDate()).padStart(2, '0');
                                dateStr = `${year}-${month}-${day}`;
                            } else {
                                continue; // 날짜 형식을 인식할 수 없으면 스킵
                            }
                        } catch (e) {
                            continue; // 날짜 변환 실패 시 스킵
                        }
                    }
                }

                // 금액 처리
                let amount;
                if (typeof amountValue === 'number') {
                    amount = Math.round(amountValue);
                } else {
                    const amountStr = String(amountValue).trim().replace(/,/g, ''); // 쉼표 제거
                    amount = parseInt(amountStr, 10);
                    if (isNaN(amount)) {
                        continue; // 금액을 숫자로 변환할 수 없으면 스킵
                    }
                }

                // 선택 필드 처리
                const membership = membershipIndex !== -1 ? String(row[membershipIndex] || '').trim() : null;
                const paymentMethod = paymentMethodIndex !== -1 ? String(row[paymentMethodIndex] || '').trim() : null;
                const notes = notesIndex !== -1 ? String(row[notesIndex] || '').trim() : null;
                
                // 신규 여부 처리: "신규" 컬럼에 값이 있으면 true, 없으면 false
                let isNew = false;
                if (isNewIndex !== -1) {
                    const isNewValue = row[isNewIndex];
                    // 값이 있고, 빈 문자열이 아니면 true
                    if (isNewValue !== null && isNewValue !== undefined && String(isNewValue).trim() !== '') {
                        isNew = true;
                    }
                }

                salesToSave.push({
                    date: dateStr,
                    memberName: memberName,
                    isNew: isNew,
                    membership: membership || null,
                    paymentMethod: paymentMethod || null,
                    amount: amount,
                    notes: notes || ''
                });
            }

            // DB에 저장
            let savedCount = 0;
            for (const sale of salesToSave) {
                try {
                    await db.addSale(sale);
                    savedCount++;
                } catch (error) {
                    console.error(`[API] 매출 저장 오류 (시트: ${sheetName}, 회원: ${sale.memberName}):`, error);
                }
            }

            totalSaved += savedCount;
            allResults.push({
                sheetName: sheetName,
                yearMonth: yearMonth,
                savedCount: savedCount,
                totalRows: salesToSave.length
            });
        }

        res.json({
            message: `매출 엑셀 파일 업로드가 완료되었습니다.`,
            results: allResults,
            summary: {
                totalSheets: workbook.worksheets.length,
                processedSheets: allResults.length,
                skippedSheets: totalSkipped,
                totalSaved: totalSaved
            }
        });

    } catch (error) {
        console.error('[API] 매출 엑셀 파일 업로드 오류:', error);
        res.status(500).json({ message: '매출 엑셀 파일 업로드에 실패했습니다.' });
    }
});

// 월별 매출 목록 조회 API
app.get(`${basePath}/by-month`, async (req, res) => {
    try {
        const year = parseInt(req.query.year);
        
        if (!year || isNaN(year)) {
            return res.status(400).json({ message: '연도가 필요합니다.' });
        }
        
        const months = await db.getSalesByMonth(year);
        res.json({ months });
    } catch (error) {
        console.error('[API] 월별 매출 목록 조회 오류:', error);
        res.status(500).json({ message: '월별 매출 목록 조회에 실패했습니다.' });
    }
});

// 매출 내역 추가 API
app.post(basePath, async (req, res) => {
    try {
        const { date, memberName, isNew, membership, paymentMethod, amount, notes, currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        // 필수 필드 검증
        if (!date || !memberName || amount === undefined) {
            return res.status(400).json({ message: '날짜, 회원명, 금액은 필수 항목입니다.' });
        }
        
        const saleData = {
            date,
            memberName: memberName.trim(),
            isNew: isNew || false,
            membership: membership ? membership.trim() : null,
            paymentMethod: paymentMethod ? paymentMethod.trim() : null,
            amount: parseInt(amount) || 0,
            notes: notes ? notes.trim() : null
        };
        
        const sale = await db.addSale(saleData);
        notify({ action: 'create', sale });
        
        res.json({ 
            message: '매출 내역이 추가되었습니다.',
            sale
        });
    } catch (error) {
        console.error('[API] 매출 내역 추가 오류:', error);
        res.status(500).json({ message: '매출 내역 추가에 실패했습니다.' });
    }
});

// 월별 매출 상세 조회 API
app.get(basePath, async (req, res) => {
    try {
        const filters = {};
        
        // startDate와 endDate가 직접 제공되면 우선 사용
        if (req.query.startDate && req.query.endDate) {
            filters.startDate = req.query.startDate;
            filters.endDate = req.query.endDate;
        } else if (req.query.yearMonth) {
            // YYYY-MM 형식의 yearMonth를 startDate와 endDate로 변환
            const [year, month] = req.query.yearMonth.split('-');
            if (year && month) {
                filters.startDate = `${year}-${month}-01`;
                // 해당 월의 마지막 날 계산
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                filters.endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
            }
        }
        
        if (req.query.memberName) {
            // 공백 제거 후 빈 문자열이 아니면 필터에 추가
            const memberName = req.query.memberName.trim();
            if (memberName) {
                filters.memberName = memberName;
            }
        }
        
        const sales = await db.getSales(filters);
        
        // 요약 정보 계산
        const totalAmount = sales.reduce((sum, s) => sum + s.amount, 0);
        const summary = {
            totalAmount,
            count: sales.length
        };
        
        res.json({
            sales,
            total: sales.length,
            summary
        });
    } catch (error) {
        console.error('[API] 매출 조회 오류:', error);
        res.status(500).json({ message: '매출 조회에 실패했습니다.' });
    }
});

// 매출 내역 전체 삭제 API (관리자만 가능)
app.delete(`${basePath}/all`, async (req, res) => {
    try {
        const { currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자만 매출 데이터를 삭제할 수 있습니다.' });
        }
        
        const result = await db.deleteAllSales();
        
        res.json({ 
            message: '모든 매출 데이터가 삭제되었습니다.',
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error('[API] 매출 데이터 전체 삭제 오류:', error);
        res.status(500).json({ message: '매출 데이터 삭제에 실패했습니다.' });
    }
});

// 매출 내역 수정 API
app.patch(`${basePath}/:id`, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ message: '올바른 매출 ID를 입력해주세요.' });
        }
        
        const { currentUser, ...saleData } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        const updatedSale = await db.updateSale(id, saleData);
        notify({ action: 'update', sale: updatedSale });
        
        res.json({ 
            message: '매출 내역이 수정되었습니다.',
            sale: updatedSale
        });
    } catch (error) {
        console.error('[API] 매출 내역 수정 오류:', error);
        if (error.message === '매출 내역을 찾을 수 없습니다.') {
            res.status(404).json({ message: '매출 내역을 찾을 수 없습니다.' });
        } else if (error.message === '수정할 필드가 없습니다.') {
            res.status(400).json({ message: '수정할 필드가 없습니다.' });
        } else {
            res.status(500).json({ message: '매출 내역 수정에 실패했습니다.' });
        }
    }
});

// 매출 내역 삭제 API
app.delete(`${basePath}/:id`, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        
        if (isNaN(id)) {
            return res.status(400).json({ message: '올바른 매출 ID를 입력해주세요.' });
        }
        
        const { currentUser } = req.body;
        
        // 관리자 권한 확인
        let accounts = [];
        if (fs.existsSync(DATA_PATH)) {
            const raw = fs.readFileSync(DATA_PATH, 'utf-8');
            if (raw) accounts = JSON.parse(raw);
        }
        
        const currentUserAccount = accounts.find(acc => acc.username === currentUser);
        if (!isAdminOrSu(currentUserAccount)) {
            return res.status(403).json({ message: '관리자 권한이 필요합니다.' });
        }
        
        const deletedSale = await db.deleteSale(id);
        notify({ action: 'delete', sale: deletedSale });
        
        res.json({ message: '매출 내역이 삭제되었습니다.' });
    } catch (error) {
        console.error('[API] 매출 내역 삭제 오류:', error);
        if (error.message === '매출 내역을 찾을 수 없습니다.') {
            res.status(404).json({ message: '매출 내역을 찾을 수 없습니다.' });
        } else {
            res.status(500).json({ message: '매출 내역 삭제에 실패했습니다.' });
        }
    }
});

}

module.exports = { registerSalesRoutes };
