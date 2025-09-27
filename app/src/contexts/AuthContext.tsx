'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, Profile } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  initializing: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_FREE_ROUTES = ['/login', '/setup'] as const

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)
  const router = useRouter()

  const redirectToLogin = useCallback(
    (options?: { notify?: boolean }) => {
      const currentPath = window.location.pathname
      const onAuthFreeRoute = AUTH_FREE_ROUTES.some(route => currentPath.startsWith(route))

      if (!onAuthFreeRoute) {
        if (options?.notify) {
          toast.info('Your session ended. Please sign in again.')
        }
        router.replace('/login')
      }
    },
    [router]
  )

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error getting session:', error)
          setLoading(false)
          return
        }

        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
        setLoading(false)
      } finally {
        setInitializing(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.id)
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setLoading(false)
        setInitializing(false)
        redirectToLogin({ notify: true })
        return
      }

      if (session?.user) {
        await fetchProfile(session.user.id, { silent: event === 'TOKEN_REFRESHED' })
        return
      }

      setProfile(null)
      setLoading(false)
      setInitializing(false)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProfile = async (
    userId: string,
    { retryCount = 0, silent = false }: { retryCount?: number; silent?: boolean } = {}
  ) => {
    const shouldToggleLoading = !silent || profile === null || retryCount > 0

    if (shouldToggleLoading) {
      setLoading(true)
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)

        // If it's an auth error and we haven't retried, try to refresh the session
        if (error.code === 'PGRST301' && retryCount === 0) {
          console.log('Auth error detected, attempting to refresh session...')
          const { data: { session }, error: refreshError } = await supabase.auth.refreshSession()
          
          if (!refreshError && session) {
            return fetchProfile(userId, { retryCount: retryCount + 1, silent })
          }

          redirectToLogin({ notify: true })
          return
        }

        if (retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, 500 * (retryCount + 1)))
          return fetchProfile(userId, { retryCount: retryCount + 1, silent })
        }

        toast.error('Unable to load your profile. Please refresh or sign in again if the issue persists.')
        return
      }

      setProfile(data)
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      if (shouldToggleLoading) {
        setLoading(false)
      }
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    redirectToLogin()
  }

  useEffect(() => {
    // Ensure we redirect to login whenever no active session exists.
    if (!initializing && !session) {
      redirectToLogin()
    }
  }, [initializing, session, redirectToLogin])

  const value = {
    user,
    profile,
    session,
    loading,
    initializing,
    signIn,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
