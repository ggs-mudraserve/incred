'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { supabase } from '@/lib/supabase'
import { Download } from 'lucide-react'

interface DashboardStats {
  dailyStats: Array<{
    date: string
    open_leads: number
    close_leads: number
  }>
  agentStats: Array<{
    agent_name: string
    open_leads: number
    close_leads: number
  }>
  dailyDisbursals: Array<{
    date: string
    agent_name: string
    total_disbursed: number
  }>
  monthlyDisbursals: Array<{
    month: string
    agent_name: string
    total_disbursed: number
  }>
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    dailyStats: [],
    agentStats: [],
    dailyDisbursals: [],
    monthlyDisbursals: []
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)
      
      // Fetch daily open vs close leads (last 30 days)
      const { data: dailyData } = await supabase
        .from('leads')
        .select('uploaded_at, final_status')
        .gte('uploaded_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

      // Process daily stats
      const dailyStatsMap = new Map()
      dailyData?.forEach(lead => {
        const date = new Date(lead.uploaded_at).toISOString().split('T')[0]
        if (!dailyStatsMap.has(date)) {
          dailyStatsMap.set(date, { date, open_leads: 0, close_leads: 0 })
        }
        const stats = dailyStatsMap.get(date)
        if (lead.final_status === 'open') {
          stats.open_leads++
        } else {
          stats.close_leads++
        }
      })

      // Fetch agent-wise stats
      const { data: agentData } = await supabase
        .from('leads')
        .select(`
          final_status,
          profiles!leads_agent_id_fkey(name)
        `)

      // Process agent stats
      const agentStatsMap = new Map()
      agentData?.forEach(lead => {
        const agentName = lead.profiles?.name || 'Unknown'
        if (!agentStatsMap.has(agentName)) {
          agentStatsMap.set(agentName, { agent_name: agentName, open_leads: 0, close_leads: 0 })
        }
        const stats = agentStatsMap.get(agentName)
        if (lead.final_status === 'open') {
          stats.open_leads++
        } else {
          stats.close_leads++
        }
      })

      // Fetch disbursal data
      const { data: disbursalData } = await supabase
        .from('applications')
        .select(`
          disbursed_amount,
          created_at,
          leads!applications_lead_id_fkey(
            profiles!leads_agent_id_fkey(name)
          )
        `)
        .eq('stage', 'Disbursed')
        .not('disbursed_amount', 'is', null)

      // Process daily disbursals
      const dailyDisbursalMap = new Map()
      const monthlyDisbursalMap = new Map()
      
      disbursalData?.forEach(app => {
        const date = new Date(app.created_at).toISOString().split('T')[0]
        const month = new Date(app.created_at).toISOString().substring(0, 7)
        const agentName = app.leads?.profiles?.name || 'Unknown'
        const amount = app.disbursed_amount || 0

        // Daily disbursals
        const dailyKey = `${date}-${agentName}`
        if (!dailyDisbursalMap.has(dailyKey)) {
          dailyDisbursalMap.set(dailyKey, { date, agent_name: agentName, total_disbursed: 0 })
        }
        dailyDisbursalMap.get(dailyKey).total_disbursed += amount

        // Monthly disbursals
        const monthlyKey = `${month}-${agentName}`
        if (!monthlyDisbursalMap.has(monthlyKey)) {
          monthlyDisbursalMap.set(monthlyKey, { month, agent_name: agentName, total_disbursed: 0 })
        }
        monthlyDisbursalMap.get(monthlyKey).total_disbursed += amount
      })

      setStats({
        dailyStats: Array.from(dailyStatsMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
        agentStats: Array.from(agentStatsMap.values()),
        dailyDisbursals: Array.from(dailyDisbursalMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
        monthlyDisbursals: Array.from(monthlyDisbursalMap.values()).sort((a, b) => b.month.localeCompare(a.month))
      })
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return
    
    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => row[header]).join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of leads and applications performance</p>
      </div>

      {/* Daily Open vs Close Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daily Open vs Close Leads</CardTitle>
            <CardDescription>Last 30 days performance</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(stats.dailyStats, 'daily-leads.csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Open Leads</TableHead>
                <TableHead>Close Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.dailyStats.map((stat) => (
                <TableRow key={stat.date}>
                  <TableCell>{new Date(stat.date).toLocaleDateString()}</TableCell>
                  <TableCell>{stat.open_leads}</TableCell>
                  <TableCell>{stat.close_leads}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Agent-wise Open vs Close Leads */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Agent-wise Open vs Close Leads</CardTitle>
            <CardDescription>Performance by agent</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(stats.agentStats, 'agent-leads.csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Open Leads</TableHead>
                <TableHead>Close Leads</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.agentStats.map((stat) => (
                <TableRow key={stat.agent_name}>
                  <TableCell>{stat.agent_name}</TableCell>
                  <TableCell>{stat.open_leads}</TableCell>
                  <TableCell>{stat.close_leads}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Daily Disbursals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Daily Disbursal Totals</CardTitle>
            <CardDescription>Daily disbursed amounts by agent</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(stats.dailyDisbursals, 'daily-disbursals.csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Total Disbursed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.dailyDisbursals.map((stat, index) => (
                <TableRow key={index}>
                  <TableCell>{new Date(stat.date).toLocaleDateString()}</TableCell>
                  <TableCell>{stat.agent_name}</TableCell>
                  <TableCell>₹{stat.total_disbursed.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Monthly Disbursals */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Monthly Disbursal Totals</CardTitle>
            <CardDescription>Monthly disbursed amounts by agent</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(stats.monthlyDisbursals, 'monthly-disbursals.csv')}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Total Disbursed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.monthlyDisbursals.map((stat, index) => (
                <TableRow key={index}>
                  <TableCell>{stat.month}</TableCell>
                  <TableCell>{stat.agent_name}</TableCell>
                  <TableCell>₹{stat.total_disbursed.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
