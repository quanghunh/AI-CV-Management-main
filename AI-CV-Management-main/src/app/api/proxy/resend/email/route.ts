// api/send-email.ts
import { Resend } from 'resend';

// Khởi tạo Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req: any, res: any) {
  // Cấu hình CORS để cho phép frontend gọi được API này
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Trong thực tế nên thay '*' bằng domain frontend của bạn
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Xử lý request OPTIONS (preflight check của trình duyệt)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, text, cc, from } = req.body;

    // Gửi email qua Resend
    const data = await resend.emails.send({
      from: from || 'Recruit AI <onboarding@resend.dev>',
      to: to,
      subject: subject,
      html: html,
      text: text,
      cc: cc
    });

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('Lỗi gửi mail:', error);
    return res.status(500).json({ error: error.message });
  }
}