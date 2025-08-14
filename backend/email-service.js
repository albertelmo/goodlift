const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fontkit = require('@pdf-lib/fontkit');

class EmailService {
    constructor() {
        this.transporter = null;
        this.initializeTransporter();
    }

    // 이메일 전송기 초기화
    initializeTransporter() {
        // 환경변수에서 이메일 설정 가져오기
        const emailConfig = {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        };

        this.transporter = nodemailer.createTransport(emailConfig);
    }



    // PDF 파일 읽기
    readPDFFile() {
        const pdfPath = path.join(__dirname, '../public/img/contract.pdf');
        try {
            if (fs.existsSync(pdfPath)) {
                return fs.readFileSync(pdfPath);
            } else {
                console.error('[EmailService] PDF 파일을 찾을 수 없습니다:', pdfPath);
                return null;
            }
        } catch (error) {
            console.error('[EmailService] PDF 파일 읽기 오류:', error);
            return null;
        }
    }

    // 계약서 이메일 전송
    async sendContractEmail(memberData, recipientEmail) {
        try {
            // PDF 생성
            const pdfBuffer = await this.generatePDF(memberData);
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipientEmail,
                subject: `[GoodLift] 피트니스 계약서 - ${memberData.name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #1976d2;">안녕하세요!</h2>
                        <p>GoodLift 피트니스 계약서를 첨부해드립니다.</p>
                        
                        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #333;">계약 정보</h3>
                            <p><strong>회원명:</strong> ${memberData.name}</p>
                            <p><strong>담당 트레이너:</strong> ${memberData.trainerName || memberData.trainer}</p>
                            <p><strong>등록일:</strong> ${memberData.regdate}</p>
                        </div>
                        
                        <p>첨부된 PDF 계약서를 확인해주시기 바랍니다.</p>
                        <br>
                        <p>감사합니다.</p>
                        <p><strong>GoodLift 피트니스</strong></p>
                    </div>
                `,
                attachments: [
                    {
                        filename: `GoodLift_계약서_${memberData.name}.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            };

            const result = await this.transporter.sendMail(mailOptions);
            return { success: true, messageId: result.messageId };
            
        } catch (error) {
            throw new Error('계약서 이메일 전송에 실패했습니다.');
        }
    }

    // 계약서 내용 생성
    generateContractContent(memberData) {
        try {
            const contractPath = path.join(__dirname, '../public/img/contract.txt');
            let contractTemplate = '';
            
            if (fs.existsSync(contractPath)) {
                contractTemplate = fs.readFileSync(contractPath, 'utf-8');
            } else {
                contractTemplate = this.getDefaultContractTemplate();
            }
            
            // 템플릿의 플레이스홀더를 실제 데이터로 교체
            const contractContent = contractTemplate
                .replace(/\{회원명\}/g, memberData.name || '')
                .replace(/\{담당트레이너\}/g, memberData.trainerName || memberData.trainer || '')
                .replace(/\{등록일\}/g, memberData.regdate || '');
            
            return contractContent;
            
        } catch (error) {
            return this.getDefaultContractTemplate()
                .replace(/\{회원명\}/g, memberData.name || '')
                .replace(/\{담당트레이너\}/g, memberData.trainerName || memberData.trainer || '')
                .replace(/\{등록일\}/g, memberData.regdate || '');
        }
    }

    // PDF 생성 (pdf-lib 사용)
    async generatePDF(memberData) {
        try {
            // PDF 문서 생성
            const pdfDoc = await PDFDocument.create();
            
            // 폰트킷 등록
            pdfDoc.registerFontkit(fontkit);
            
            // 한글 폰트 파일 임베드
            const fontBytes = fs.readFileSync(path.join(__dirname, 'fonts', 'NanumGothic.ttf'));
            const font = await pdfDoc.embedFont(fontBytes);
            
            // 페이지 추가
            const page = pdfDoc.addPage([595.28, 841.89]); // A4 크기
            const { width, height } = page.getSize();
            
            // 제목
            page.drawText('GoodLift 피트니스 계약서', {
                x: 50,
                y: height - 50,
                size: 24,
                font: font,
                color: rgb(0.1, 0.1, 0.1)
            });
            
            // 계약 정보
            let yPosition = height - 100;
            
            page.drawText(`회원명: ${memberData.name || 'N/A'}`, {
                x: 50,
                y: yPosition,
                size: 12,
                font: font,
                color: rgb(0.2, 0.2, 0.2)
            });
            
            yPosition -= 30;
            page.drawText(`담당 트레이너: ${memberData.trainerName || memberData.trainer || 'N/A'}`, {
                x: 50,
                y: yPosition,
                size: 12,
                font: font,
                color: rgb(0.2, 0.2, 0.2)
            });
            
            yPosition -= 30;
            page.drawText(`등록일: ${memberData.regdate || 'N/A'}`, {
                x: 50,
                y: yPosition,
                size: 12,
                font: font,
                color: rgb(0.2, 0.2, 0.2)
            });
            

            
            // 계약 내용
            yPosition -= 50;
            
            // contract.txt 파일에서 계약서 내용 읽기
            const contractPath = path.join(__dirname, '../public/img/contract.txt');
            let contractContent = '';
            
            if (fs.existsSync(contractPath)) {
                contractContent = fs.readFileSync(contractPath, 'utf-8');
            } else {
                contractContent = this.getDefaultContractTemplate();
            }
            
            // 계약서 내용에서 플레이스홀더 치환
            const processedContent = contractContent
                .replace(/\{회원명\}/g, memberData.name || '')
                .replace(/\{담당트레이너\}/g, memberData.trainerName || memberData.trainer || '')
                .replace(/\{등록일\}/g, memberData.regdate || '');
            
            const contractLines = processedContent.split('\n');
            
            for (const line of contractLines) {
                if (yPosition < 50) {
                    // 새 페이지 추가
                    const newPage = pdfDoc.addPage([595.28, 841.89]);
                    yPosition = height - 50;
                }
                
                page.drawText(line, {
                    x: 50,
                    y: yPosition,
                    size: 10,
                    font: font,
                    color: rgb(0.3, 0.3, 0.3)
                });
                
                yPosition -= 15;
            }
            
            // 서명 섹션 추가
            yPosition -= 30;
            page.drawText('서명:', {
                x: 50,
                y: yPosition,
                size: 12,
                font: font,
                color: rgb(0.2, 0.2, 0.2)
            });
            
            // 서명 이미지가 있으면 추가
            if (memberData.signatureData) {
                try {
                    // base64 이미지를 PDF에 임베드
                    const imageBytes = Buffer.from(memberData.signatureData.split(',')[1], 'base64');
                    const image = await pdfDoc.embedPng(imageBytes);
                    
                    const imageWidth = 150;
                    const imageHeight = (image.height * imageWidth) / image.width;
                    
                    page.drawImage(image, {
                        x: 50,
                        y: yPosition - imageHeight - 10,
                        width: imageWidth,
                        height: imageHeight
                    });
                } catch (error) {
                    // 서명 이미지 처리 실패 시 텍스트로 대체
                    page.drawText('서명됨', {
                        x: 50,
                        y: yPosition - 20,
                        size: 10,
                        font: font,
                        color: rgb(0.5, 0.5, 0.5)
                    });
                }
            } else {
                page.drawText('서명 없음', {
                    x: 50,
                    y: yPosition - 20,
                    size: 10,
                    font: font,
                    color: rgb(0.5, 0.5, 0.5)
                });
            }
            

            
            // PDF 바이트 배열로 변환
            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);
            
        } catch (error) {
            console.error('[EmailService] PDF 생성 오류:', error);
            throw new Error('PDF 생성에 실패했습니다.');
        }
    }

    // 계약서 HTML 생성
    generateContractHTML(memberData) {
        const contractContent = this.generateContractContent(memberData);
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Contract</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 3px solid #1976d2;
                    padding-bottom: 20px;
                }
                .header h1 {
                    color: #1976d2;
                    margin: 0;
                    font-size: 28px;
                    font-weight: bold;
                }
                .contract-info {
                    margin-bottom: 30px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 4px solid #1976d2;
                }
                .contract-info h2 {
                    margin-top: 0;
                    color: #1976d2;
                    font-size: 18px;
                }
                .info-row {
                    display: flex;
                    margin-bottom: 10px;
                }
                .info-label {
                    font-weight: bold;
                    width: 120px;
                    color: #555;
                }
                .info-value {
                    flex: 1;
                }
                .contract-content {
                    margin-bottom: 30px;
                    white-space: pre-line;
                    line-height: 1.8;
                }
                .signature-section {
                    margin-top: 40px;
                    border-top: 1px solid #ddd;
                    padding-top: 20px;
                }
                .signature-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .signature-box {
                    width: 200px;
                    height: 80px;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f9f9f9;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 14px;
                }
                @media print {
                    body { margin: 0; }
                }
            </style>
        </head>
        <body>
            <h1>Contract</h1>
            <p>Member: ${memberData.name}</p>
            <p>Trainer: ${memberData.trainer}</p>
            <p>Date: ${memberData.regdate}</p>
            <p>Content: ${contractContent}</p>
        </body>
        </html>
        `;
    }

    // 기본 계약서 템플릿
    getDefaultContractTemplate() {
        return `계약 내용:

1. 서비스 내용
   - 개인 트레이닝(PT) 서비스 제공
   - 맞춤형 운동 프로그램 설계 및 지도
   - 정기적인 체력 측정 및 피드백

2. 회원의 의무
   - 지정된 트레이너와 함께 PT 세션 진행
   - 세션은 사전 예약을 통해 진행
   - 결석 시 최소 24시간 전 연락
   - 계약 기간 동안 정기적인 운동 참여

3. 트레이너의 의무
   - 회원의 목표에 맞는 맞춤형 프로그램 제공
   - 안전하고 효과적인 운동 지도
   - 정기적인 진행 상황 피드백

4. 계약 기간
   - 계약 시작일: {등록일}
   - 계약 종료일: 세션 완료 시까지

5. 기타 사항
   - 계약서 내용 변경 시 사전 협의
   - 분쟁 발생 시 상호 협의를 통해 해결
   - 본 계약서는 계약 당사자 간의 합의에 의거 작성됨`;
    }

    // 이메일 설정 테스트
    async testEmailConnection() {
        try {
            await this.transporter.verify();
            return { success: true, message: '이메일 설정이 정상입니다.' };
        } catch (error) {
            return { success: false, message: '이메일 설정에 문제가 있습니다.' };
        }
    }
}

module.exports = new EmailService(); 