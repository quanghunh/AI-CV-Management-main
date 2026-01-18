import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function createUserWithAuth({
  email,
  password,
  fullName,
  roleId,
  status = 'active'
}: {
  email: string
  password: string
  fullName: string
  roleId: number
  status?: string
}) {
  try {
    console.log('🚀 Creating user in auth.users...')

    // Bước 1: Tạo user trong auth.users bằng Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Tự động confirm email
      user_metadata: {
        full_name: fullName
      }
    })

    if (authError) {
      console.error('❌ Auth creation error:', authError)
      throw new Error(authError.message)
    }

    if (!authData.user) {
      throw new Error('No user returned from auth creation')
    }

    console.log('✅ Auth user created:', authData.user.id)

    // Bước 2: Tạo profile trong cv_profiles
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('cv_profiles')
      .insert({
        id: authData.user.id,
        auth_user_id: authData.user.id,
        email: email,
        full_name: fullName,
        status: status,
        synced: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ Profile creation error:', profileError)
      // Rollback: Xóa auth user nếu tạo profile thất bại
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      throw new Error(profileError.message)
    }

    console.log('✅ Profile created:', profileData)

    // Bước 3: Gán vai trò
    const { error: roleError } = await supabaseAdmin
      .from('cv_user_roles')
      .insert({
        user_id: authData.user.id,
        role_id: roleId,
        created_at: new Date().toISOString()
      })

    if (roleError) {
      console.error('❌ Role assignment error:', roleError)
      throw new Error(roleError.message)
    }

    console.log('✅ Role assigned')

    // Bước 4: Log activity
    try {
      await supabaseAdmin
        .from('activity_logs')
        .insert({
          user_id: authData.user.id,
          user_name: fullName,
          action: 'CREATE_USER',
          details: `Admin tạo tài khoản: ${fullName} (${email})`,
          created_at: new Date().toISOString()
        })
    } catch (logError) {
      console.log('⚠️ Activity log failed (non-critical):', logError)
    }

    return {
      success: true,
      userId: authData.user.id,
      email: email
    }

  } catch (error: any) {
    console.error('❌ Create user failed:', error)
    return {
      success: false,
      error: error.message || 'Unknown error'
    }
  }
}
