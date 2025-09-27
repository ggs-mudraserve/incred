'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

const setupEnabled =
  process.env.NEXT_PUBLIC_ENABLE_SETUP === 'true' || process.env.NODE_ENV !== 'production'

export default function SetupPage() {
  const [loading, setLoading] = useState(false)
  const [adminData, setAdminData] = useState({
    name: 'Admin User',
    email: 'admin@incred.com',
    password: 'admin123'
  })
  const [agentData, setAgentData] = useState({
    name: 'Test Agent',
    email: 'agent@incred.com',
    password: 'agent123'
  })
  const router = useRouter()

  useEffect(() => {
    if (!setupEnabled) {
      router.replace('/login')
    }
  }, [router])

  const createUser = async (userData: typeof adminData, role: 'admin' | 'agent') => {
    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            name: userData.name,
            role: role
          }
        }
      })

      if (authError) {
        console.error('Error creating user:', authError)
        toast.error(`Failed to create ${role}: ` + authError.message)
        return false
      }

      if (authData.user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authData.user.id,
            email: userData.email,
            name: userData.name,
            role: role
          })

        if (profileError) {
          console.error('Error creating profile:', profileError)
          toast.error(`Failed to create ${role} profile`)
          return false
        }

        toast.success(`${role} user created successfully`)
        return true
      }
      return false
    } catch (error) {
      console.error('Error creating user:', error)
      toast.error(`Failed to create ${role}`)
      return false
    }
  }

  const setupApplication = async () => {
    setLoading(true)
    
    try {
      // Create admin user
      const adminCreated = await createUser(adminData, 'admin')
      if (!adminCreated) {
        setLoading(false)
        return
      }

      // Create agent user
      const agentCreated = await createUser(agentData, 'agent')
      if (!agentCreated) {
        setLoading(false)
        return
      }

      // Create some sample leads for the agent
      const { data: agentProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', agentData.email)
        .single()

      if (agentProfile) {
        const sampleLeads = [
          {
            app_no: 'APP001',
            mobile_no: '9876543210',
            name: 'John Doe',
            amount: 100000,
            status: 'cash salary',
            agent_id: agentProfile.id
          },
          {
            app_no: 'APP002',
            mobile_no: '9876543211',
            name: 'Jane Smith',
            amount: 150000,
            status: 'banking received',
            agent_id: agentProfile.id
          },
          {
            app_no: 'APP003',
            mobile_no: '9876543212',
            name: 'Bob Johnson',
            amount: 200000,
            status: 'self employed',
            agent_id: agentProfile.id
          }
        ]

        const { error: leadsError } = await supabase
          .from('leads')
          .insert(sampleLeads)

        if (leadsError) {
          console.error('Error creating sample leads:', leadsError)
          toast.error('Failed to create sample leads')
        } else {
          toast.success('Sample leads created')
        }
      }

      toast.success('Application setup completed!')
      setTimeout(() => {
        router.push('/login')
      }, 2000)

    } catch (error) {
      console.error('Setup error:', error)
      toast.error('Setup failed')
    } finally {
      setLoading(false)
    }
  }

  if (!setupEnabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-xl">Setup Disabled</CardTitle>
            <CardDescription>
              Application setup is only available during local development or when
              `NEXT_PUBLIC_ENABLE_SETUP` is explicitly set to `true`.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-blue-900">
            Incred Followup Setup
          </CardTitle>
          <CardDescription>
            Initialize the application with test users and data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Admin User */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Admin User</h3>
              <div>
                <Label htmlFor="admin-name">Name</Label>
                <Input
                  id="admin-name"
                  value={adminData.name}
                  onChange={(e) => setAdminData({ ...adminData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminData.email}
                  onChange={(e) => setAdminData({ ...adminData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminData.password}
                  onChange={(e) => setAdminData({ ...adminData, password: e.target.value })}
                />
              </div>
            </div>

            {/* Agent User */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Agent User</h3>
              <div>
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  value={agentData.name}
                  onChange={(e) => setAgentData({ ...agentData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="agent-email">Email</Label>
                <Input
                  id="agent-email"
                  type="email"
                  value={agentData.email}
                  onChange={(e) => setAgentData({ ...agentData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="agent-password">Password</Label>
                <Input
                  id="agent-password"
                  type="password"
                  value={agentData.password}
                  onChange={(e) => setAgentData({ ...agentData, password: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="text-center">
            <Button 
              onClick={setupApplication} 
              disabled={loading}
              className="w-full md:w-auto px-8"
            >
              {loading ? 'Setting up...' : 'Setup Application'}
            </Button>
          </div>

          <div className="text-sm text-gray-600 text-center">
            <p>This will create:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Admin user with full access</li>
              <li>Agent user with limited access</li>
              <li>Sample leads for testing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
