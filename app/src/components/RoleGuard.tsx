'use client'

import { useAuth } from '@/contexts/AuthContext'
import { UserRole } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

interface RoleGuardProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
  fallbackPath?: string
}

export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallbackPath = '/login' 
}: RoleGuardProps) {
  const { profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!profile) {
        router.push('/login')
        return
      }

      if (!allowedRoles.includes(profile.role)) {
        router.push(fallbackPath)
        return
      }
    }
  }, [profile, loading, allowedRoles, fallbackPath, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!profile || !allowedRoles.includes(profile.role)) {
    return null
  }

  return <>{children}</>
}
