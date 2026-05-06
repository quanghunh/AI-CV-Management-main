

import { supabase } from '@/lib/supabaseClient'

export type CampaignTrigger =
  | 'interview_created'
  | 'interview_rescheduled'
  | 'interview_result_published'
  | 'candidate_status_changed'

export interface TriggerContext {
  candidateId?: string
  candidateEmail?: string
  candidateName?: string
  interviewId?: string
  interviewDate?: string
  interviewFormat?: string
  interviewLocation?: string
  jobTitle?: string
  interviewerName?: string
  result?: string
  rating?: number
  feedback?: string
  newStatus?: string
}

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

    .replace(/\{\{candidateName\}\}/g,     ctx.candidateName    || '')
    .replace(/\{\{candidate_name\}\}/g,    ctx.candidateName    || '')
    .replace(/\{\{candidate_email\}\}/g,   ctx.email            || '')

    .replace(/\{\{position\}\}/g,          ctx.jobTitle         || '')
    .replace(/\{\{job_title\}\}/g,         ctx.jobTitle         || '')
    .replace(/\{\{companyName\}\}/g,       ctx.companyName      || '')

    .replace(/\{\{interviewTime\}\}/g,     formatDate(ctx.interviewDate))
    .replace(/\{\{interview_date\}\}/g,    formatDate(ctx.interviewDate))
    .replace(/\{\{interviewType\}\}/g,     ctx.interviewFormat  || '')
    .replace(/\{\{interviewLocation\}\}/g, ctx.interviewLocation || '')
    .replace(/\{\{interviewerName\}\}/g,   ctx.interviewerName  || '')
    .replace(/\{\{interviewer_name\}\}/g,  ctx.interviewerName  || '')

    .replace(/\{\{result\}\}/g,            ctx.result           || '')
    .replace(/\{\{rating\}\}/g,            ctx.rating !== undefined ? String(ctx.rating) : '')
    .replace(/\{\{feedback\}\}/g,          ctx.feedback         || '')
    .replace(/\{\{new_status\}\}/g,        ctx.newStatus        || '')

    .replace(/\{\{confirmDeadline\}\}/g,   confirmDeadline)

    .replace(/\{\{hrName\}\}/g,            '')
    .replace(/\{\{contactEmail\}\}/g,      '')
    .replace(/\{\{contactPhone\}\}/g,      '')
}

async function getEmailSettings() {
  const { data } = await supabase
    .from('cv_email_settings')
    .select('resend_api_key, sending_email, sender_name')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

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

export async function fireCampaign(
  trigger: CampaignTrigger,
  ctx: TriggerContext
): Promise<void> {
  try {

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

    const settings = await getEmailSettings()
    if (!settings?.resend_api_key || !settings?.sending_email) {
      console.warn('[CampaignEngine] Email chưa được cấu hình – bỏ qua campaign')
      return
    }

    const companyProfile = await getCompanyProfile()

    const enrichedCtx = {
      ...ctx,
      candidateEmail,
      candidateName,
      email: candidateEmail,
      companyName: companyProfile.company_name,
    }

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
