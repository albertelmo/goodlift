const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

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
            // PDF 파일 읽기
            const pdfBuffer = this.readPDFFile();
            
            if (!pdfBuffer) {
                throw new Error('계약서 PDF 파일을 찾을 수 없습니다.');
            }
            
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipientEmail,
                subject: `[GoodLift] 피트니스 계약서`,
                html: `
                    <h2>안녕하세요!</h2>
                    <p>GoodLift 피트니스 계약서를 첨부해드립니다.</p>
                    <p>첨부된 계약서를 확인해주시기 바랍니다.</p>
                    <br>
                    <p>감사합니다.</p>
                    <p>GoodLift 피트니스</p>
                `,
                attachments: [
                    {
                        filename: `GoodLift_계약서.pdf`,
                        content: pdfBuffer,
                        contentType: 'application/pdf'
                    }
                ]
            };

            const result = await this.transporter.sendMail(mailOptions);
            return { success: true, messageId: result.messageId };
            
        } catch (error) {
            console.error('[EmailService] 계약서 이메일 전송 오류:', error);
            throw new Error('계약서 이메일 전송에 실패했습니다.');
        }
    }

    // 이메일 설정 테스트
    async testEmailConnection() {
        try {
            await this.transporter.verify();
            return { success: true, message: '이메일 설정이 정상입니다.' };
        } catch (error) {
            console.error('[EmailService] 이메일 설정 테스트 오류:', error);
            return { success: false, message: '이메일 설정에 문제가 있습니다.' };
        }
    }
}

module.exports = new EmailService(); 