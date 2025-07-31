const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const puppeteer = require('puppeteer');
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

    // 계약서 템플릿 생성
    generateContractTemplate(memberData) {
        // contract.txt 파일 읽기
        const contractPath = path.join(__dirname, '../public/img/contract.txt');
        let contractContent = '';
        
        try {
            contractContent = fs.readFileSync(contractPath, 'utf-8');
        } catch (error) {
            console.error('[EmailService] 계약서 파일 읽기 오류:', error);
            contractContent = '계약서 내용을 불러올 수 없습니다.';
        }

        const template = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>GoodLift 피트니스 계약서</title>
    <style>
        body { font-family: 'Malgun Gothic', sans-serif; margin: 40px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .contract-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
        .member-info { margin-bottom: 30px; border: 1px solid #ddd; padding: 20px; background-color: #f9f9f9; }
        .info-row { margin-bottom: 10px; }
        .label { font-weight: bold; display: inline-block; width: 120px; }
        .contract-content { margin-top: 30px; white-space: pre-line; }
        .signature { margin-top: 50px; border-top: 1px solid #000; padding-top: 20px; }
        .date { margin-top: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="contract-title">GoodLift 피트니스 계약서</h1>
    </div>

    <div class="contract-content">
        ${contractContent}
    </div>
</body>
</html>`;

        const compiledTemplate = handlebars.compile(template);
        return compiledTemplate(memberData);
    }

    // HTML을 PDF로 변환
    async generatePDF(htmlContent) {
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
            
            const pdf = await page.pdf({
                format: 'A4',
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                }
            });
            
            return pdf;
        } finally {
            await browser.close();
        }
    }

    // 계약서 이메일 전송
    async sendContractEmail(memberData, recipientEmail) {
        try {
            // 계약서 HTML 생성
            const htmlContent = this.generateContractTemplate(memberData);
            
            // PDF 생성
            const pdfBuffer = await this.generatePDF(htmlContent);
            
            // 이메일 전송
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: recipientEmail,
                subject: `[GoodLift] ${memberData.name}님의 피트니스 계약서`,
                html: `
                    <h2>안녕하세요, ${memberData.name}님!</h2>
                    <p>GoodLift 피트니스에 가입해주셔서 감사합니다.</p>
                    <p>첨부된 계약서를 확인해주시기 바랍니다.</p>
                    <br>
                    <p>감사합니다.</p>
                    <p>GoodLift 피트니스</p>
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