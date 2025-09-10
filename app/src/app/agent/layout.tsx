'use client'

import { RoleGuard } from '@/components/RoleGuard'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, Users, Kanban } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()

  const navigation = [
    { name: 'Leads', href: '/agent/dashboard', icon: Users },
    { name: 'Applications', href: '/agent/applications', icon: Kanban },
  ]

  return (
    <RoleGuard allowedRoles={['agent']}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-blue-900">
                  Incred Followup - Agent
                </h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-600">
                  Welcome, {profile?.name}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={signOut}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Collapsible Sidebar */}
          <nav className="group w-16 hover:w-64 bg-white shadow-sm min-h-screen transition-all duration-300 ease-in-out">
            <div className="p-4">
              <ul className="space-y-2">
                {navigation.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${
                          isActive
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        }`}
                        title={item.name}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        <span className="whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-hidden">
                          {item.name}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          </nav>

          {/* Main content */}
          <main className="flex-1 overflow-x-auto">
            {children}
          </main>
        </div>
      </div>
    </RoleGuard>
  )
}
