// src/utils/campaignTriggerEngine.ts
// =========================================================
// Campaign Trigger Engine – Phương Án A (Frontend-driven)
// Import module này vào các trang để kích hoạt campaign.
// =========================================================

import { supabase } from '@/lib/supabaseClient'

export type CampaignTrigger =
  | 'interview_created'
  | 'interview_rescheduled'
  | 'interview_result_published'
  | 'candidate_status_changed'

export interface TriggerContext {
  candidateId?: string
  candidateEmail?: string     // Nếu đã có email sẵn thì truyền vào để khỏi query lại
  candidateName?: string
  interviewId?: string
  interviewDate?: string      // ISO string
  interviewFormat?: string    // 'Trực tiếp' | 'Online' | ...
  interviewLocation?: string  // Địa điểm / link
  jobTitle?: string           // Vị trí ứng tuyển (= position)
  interviewerName?: string
  result?: string             // 'Đạt' | 'Không đạt'
  rating?: number             // Điểm số đánh giá (1-5)
  feedback?: string           // Nhận xét của người phỏng vấn
  newStatus?: string          // Dùng cho candidate_status_changed
}

// -------------------------------------------------------
// Lấy thông tin công ty từ cv_company_profile
// -------------------------------------------------------
async function getCompanyProfile(): Promise<{ company_name: string; confirm_deadline?: string }> {
  try {
    const { data } = await supabase
      .from('cv_company_profile')
      .select('company_name')
      .single()
    return {
      company_name: data?.company_name || 'Công ty',
    }
  } catch {
    return { company_name: 'Công ty' }
  }
}

// -------------------------------------------------------
// Render template variables: thay {{variable}} bằng giá trị thực
//
// Biến hỗ trợ trong template:
//   {{candidateName}}       – Tên ứng viên
//   {{position}}            – Vị trí ứng tuyển
//   {{companyName}}         – Tên công ty (lấy từ Settings → Company)
//   {{interviewTime}}       – Ngày & giờ phỏng vấn (định dạng đẹp)
//   {{interviewType}}       – Hình thức (Online / Trực tiếp / ...)
//   {{interviewLocation}}   – Địa điểm hoặc link họp
//   {{interviewerName}}     – Người phỏng vấn
//   {{result}}              – Kết quả: 'Đạt' | 'Không đạt'
//   {{confirmDeadline}}     – Ngày deadline xác nhận (= ngày phỏng vấn - 1 ngày)
//   {{new_status}}          – Trạng thái mới (candidate_status_changed)
//
// Biến bị loại bỏ (xóa sạch khỏi nội dung):
//   {{hrName}}, {{contactEmail}}, {{contactPhone}}
// -------------------------------------------------------
function renderTemplate(
  text: string,
  ctx: TriggerContext & { email?: string; companyName?: string }
): string {
  const formatDate = (iso?: string) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleString('vi-VN', {
        weekday: 'long',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  // Tính confirmDeadline: 1 ngày trước ngày phỏng vấn
  const confirmDeadline = (() => {
    if (!ctx.interviewDate) return ''
    try {
      const d = new Date(ctx.interviewDate)
      d.setDate(d.getDate() - 1)
      return d.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' })
    } catch {
      return ''
    }
  })()

  return text
    // --- Biến ứng viên ---
    .replace(/\{\{candidateName\}\}/g,     ctx.candidateName    || '')
    .replace(/\{\{candidate_name\}\}/g,    ctx.candidateName    || '')  // alias cũ
    .replace(/\{\{candidate_email\}\}/g,   ctx.email            || '')

    // --- Biến vị trí & công ty ---
    .replace(/\{\{position\}\}/g,          ctx.jobTitle         || '')
    .replace(/\{\{job_title\}\}/g,         ctx.jobTitle         || '')  // alias cũ
    .replace(/\{\{companyName\}\}/g,       ctx.companyName      || '')

    // --- Biến phỏng vấn ---
    .replace(/\{\{interviewTime\}\}/g,     formatDate(ctx.interviewDate))
    .replace(/\{\{interview_date\}\}/g,    formatDate(ctx.interviewDate))  // alias cũ
    .replace(/\{\{interviewType\}\}/g,     ctx.interviewFormat  || '')
    .replace(/\{\{interviewLocation\}\}/g, ctx.interviewLocation || '')
    .replace(/\{\{interviewerName\}\}/g,   ctx.interviewerName  || '')
    .replace(/\{\{interviewer_name\}\}/g,  ctx.interviewerName  || '')  // alias cũ

    // --- Biến kết quả & đánh giá ---
    .replace(/\{\{result\}\}/g,            ctx.result           || '')
    .replace(/\{\{rating\}\}/g,            ctx.rating !== undefined ? String(ctx.rating) : '')
    .replace(/\{\{feedback\}\}/g,          ctx.feedback         || '')
    .replace(/\{\{new_status\}\}/g,        ctx.newStatus        || '')

    // --- Biến deadline ---
    .replace(/\{\{confirmDeadline\}\}/g,   confirmDeadline)

    // --- Loại bỏ hoàn toàn 3 biến không dùng nữa ---
    .replace(/\{\{hrName\}\}/g,            '')
    .replace(/\{\{contactEmail\}\}/g,      '')
    .replace(/\{\{contactPhone\}\}/g,      '')
}

// -------------------------------------------------------
// Lấy email settings (app password, sender email, sender name)
// -------------------------------------------------------
async function getEmailSettings() {
  const { data } = await supabase
    .from('cv_email_settings')
    .select('resend_api_key, sending_email, sender_name')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

// -------------------------------------------------------
// Ghi log vào cv_campaign_logs
// -------------------------------------------------------
async function writeLog(params: {
  campaignId: string
  campaignName: string
  candidateId?: string
  interviewId?: string
  emailSentTo?: string
  status: 'sent' | 'failed' | 'skipped'
  errorMessage?: string
}) {
  await supabase.from('cv_campaign_logs').insert([{
    campaign_id: params.campaignId,
    campaign_name: params.campaignName,
    candidate_id: params.candidateId || null,
    interview_id: params.interviewId || null,
    email_sent_to: params.emailSentTo || null,
    status: params.status,
    error_message: params.errorMessage || null,
    triggered_at: new Date().toISOString()
  }])
}

// -------------------------------------------------------
// Định dạng HTML cho email
// -------------------------------------------------------
function formatEmailHtml(body: string, subject: string): string {
  const safeContent = body.replace(/\n/g, '<br/>')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f7fa; color: #1f2937; line-height: 1.6; font-size: 16px; }
    .wrap { width: 100%; max-width: 640px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { padding: 32px 40px; border-bottom: 1px solid #e5e7eb; display: flex; align-items: center; gap: 16px; background: #f9fafb; }
    .logo { width: 48px; height: 48px; border-radius: 10px; background: linear-gradient(135deg, #3b82f6, #2563eb); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px; font-weight: 700; }
    .title { font-size: 20px; font-weight: 600; color: #111827; }
    .subtitle { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .content { padding: 40px; color: #374151; }
    .footer { padding: 24px 40px; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; text-align: center; background: #f9fafb; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">RA</div>
      <div>
        <div class="title">Recruit AI</div>
        <div class="subtitle">Hệ thống gửi email tuyển dụng chuyên nghiệp</div>
      </div>
    </div>
    <div class="content">${safeContent}</div>
    <div class="footer">
      Đây là email tự động từ Recruit AI. Vui lòng không trả lời email này.
    </div>
  </div>
</body>
</html>`
}

// -------------------------------------------------------
// HÀM CHÍNH: fire() – Gọi từ các trang khi sự kiện xảy ra
// -------------------------------------------------------
export async function fireCampaign(
  trigger: CampaignTrigger,
  ctx: TriggerContext
): Promise<void> {
  try {
    // 1. Lấy tất cả active campaign có trigger này
    const { data: campaigns, error: campaignError } = await supabase
      .from('cv_email_campaigns')
      .select(`
        id,
        name,
        template_id,
        delay_hours,
        cc_emails,
        conditions,
        cv_email_templates (
          id,
          subject,
          body
        )
      `)
      .eq('trigger', trigger)
      .eq('is_active', true)

    if (campaignError || !campaigns || campaigns.length === 0) {
      return
    }

    // 2. Resolve email & tên ứng viên (nếu chưa có)
    let candidateEmail = ctx.candidateEmail
    let candidateName = ctx.candidateName

    if ((!candidateEmail || !candidateName) && ctx.candidateId) {
      const { data: candidateData } = await supabase
        .from('cv_candidates')
        .select('email, full_name')
        .eq('id', ctx.candidateId)
        .single()

      if (candidateData) {
        candidateEmail = candidateData.email
        candidateName = candidateData.full_name
      }
    }

    if (!candidateEmail) {
      for (const campaign of campaigns) {
        await writeLog({
          campaignId: campaign.id,
          campaignName: campaign.name,
          candidateId: ctx.candidateId,
          interviewId: ctx.interviewId,
          status: 'skipped',
          errorMessage: 'Ứng viên không có email'
        })
      }
      return
    }

    // 3. Lấy email settings
    const settings = await getEmailSettings()
    if (!settings?.resend_api_key || !settings?.sending_email) {
      console.warn('[CampaignEngine] Email chưa được cấu hình – bỏ qua campaign')
      return
    }

    // 4. Lấy thông tin công ty từ Settings
    const companyProfile = await getCompanyProfile()

    // 5. Build enriched context
    const enrichedCtx = {
      ...ctx,
      candidateEmail,
      candidateName,
      email: candidateEmail,
      companyName: companyProfile.company_name,
    }

    // 6. Gửi email cho từng campaign
    for (const campaign of campaigns) {
      const template = (campaign as any).cv_email_templates
      if (!template) {
        await writeLog({
          campaignId: campaign.id,
          campaignName: campaign.name,
          candidateId: ctx.candidateId,
          interviewId: ctx.interviewId,
          emailSentTo: candidateEmail,
          status: 'skipped',
          errorMessage: 'Campaign không có template'
        })
        continue
      }

      // Kiểm tra điều kiện (conditions) – nếu campaign có constraint thì phải khớp
      const conditions = (campaign as any).conditions as Record<string, string> | null
      if (conditions && Object.keys(conditions).length > 0) {
        let matched = true
        if (conditions.result !== undefined && conditions.result !== '' && conditions.result !== ctx.result) {
          matched = false
        }
        if (conditions.new_status !== undefined && conditions.new_status !== '' && conditions.new_status !== ctx.newStatus) {
          matched = false
        }
        if (!matched) {
          console.log(`[CampaignEngine] ⏩ Bỏ qua (conditions không khớp): ${campaign.name} | cần result=${conditions.result}, nhận được result=${ctx.result}`)
          await writeLog({
            campaignId: campaign.id,
            campaignName: campaign.name,
            candidateId: ctx.candidateId,
            interviewId: ctx.interviewId,
            emailSentTo: candidateEmail,
            status: 'skipped',
            errorMessage: `Điều kiện không khớp: cần result=${conditions.result}, nhận được=${ctx.result}`
          })
          continue
        }
      }

      try {
        const renderedSubject = renderTemplate(template.subject, enrichedCtx)
        const renderedBody    = renderTemplate(template.body, enrichedCtx)
        const htmlBody        = formatEmailHtml(renderedBody, renderedSubject)

        const payload: any = {
          subject:      renderedSubject,
          body_html:    htmlBody,
          body_text:    renderedBody,
          to:           [candidateEmail],
          app_password: settings.resend_api_key.replace(/\s/g, ''),
          sender_email: settings.sending_email,
          sender_name:  settings.sender_name || 'Recruit AI'
        }

        if (campaign.cc_emails) {
          const ccList = campaign.cc_emails.split(',').map((s: string) => s.trim()).filter(Boolean)
          if (ccList.length) payload.cc = ccList
        }

        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
        const response = await fetch(`${API_URL}/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          throw new Error((err as any).detail || 'Failed to send')
        }

        // Ghi vào lịch sử email
        await supabase.from('cv_emails').insert([{
          candidate_id: ctx.candidateId || null,
          template_id:  template.id,
          subject:      renderedSubject,
          body:         renderedBody,
          composition_type: 'campaign',
          status:       'sent',
          sent_at:      new Date().toISOString()
        }])

        await writeLog({
          campaignId:   campaign.id,
          campaignName: campaign.name,
          candidateId:  ctx.candidateId,
          interviewId:  ctx.interviewId,
          emailSentTo:  candidateEmail,
          status:       'sent'
        })

        console.log(`[CampaignEngine] ✓ ${campaign.name} → ${candidateEmail}`)
      } catch (sendErr: any) {
        await writeLog({
          campaignId:   campaign.id,
          campaignName: campaign.name,
          candidateId:  ctx.candidateId,
          interviewId:  ctx.interviewId,
          emailSentTo:  candidateEmail,
          status:       'failed',
          errorMessage: sendErr?.message || String(sendErr)
        })
        console.error(`[CampaignEngine] ✗ Lỗi gửi: ${campaign.name}`, sendErr)
      }
    }
  } catch (err) {
    console.error('[CampaignEngine] Lỗi ngoài dự kiến:', err)
  }
}
