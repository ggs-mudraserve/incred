'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase, Lead, StatusEnum, Constants } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Search, Download, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

export default function AgentDashboard() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 25

  useEffect(() => {
    if (profile) {
      fetchLeads()
    }
  }, [profile, currentPage, searchTerm, statusFilter, fromDate, toDate])

  const fetchLeads = async () => {
    if (!profile) return

    try {
      setLoading(true)
      
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('agent_id', profile.id)
        .order('uploaded_at', { ascending: false })
        .range((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage - 1)

      // Apply search filter
      if (searchTerm) {
        query = query.or(`app_no.ilike.%${searchTerm}%,mobile_no.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%`)
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply date filters
      if (fromDate) {
        query = query.gte('created_at', fromDate)
      }
      if (toDate) {
        // Add 23:59:59 to include the entire end date
        const endDate = new Date(toDate)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }

      const { data, error, count } = await query

      if (error) {
        console.error('Error fetching leads:', error)
        toast.error('Failed to fetch leads')
      } else {
        setLeads(data || [])
        setTotalCount(count || 0)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
      toast.error('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }

  const updateLeadStatus = async (leadId: number, newStatus: StatusEnum) => {
    try {
      // Define statuses that should set final_status to 'close'
      const closeStatuses = ['cash salary', 'self employed', 'NI', 'ring more than 3 days', 'salary low', 'cibil issue']

      // Determine final_status based on the new status
      let finalStatus = 'open'
      if (closeStatuses.includes(newStatus)) {
        finalStatus = 'close'
      }

      // Update the lead with new status and final_status
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          final_status: finalStatus
        })
        .eq('id', leadId)

      if (updateError) {
        console.error('Error updating lead status:', updateError)
        toast.error('Failed to update lead status')
        return
      }

      // If status is 'banking received', create a new application
      if (newStatus === 'banking received') {
        // First, get the lead details
        const { data: leadData, error: leadError } = await supabase
          .from('leads')
          .select('*')
          .eq('id', leadId)
          .single()

        if (leadError) {
          console.error('Error fetching lead data:', leadError)
          toast.error('Failed to fetch lead data for application creation')
          return
        }

        // Create a new application
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .insert({
            lead_id: leadId,
            loan_amount: leadData.amount || 0,
            stage: 'UnderReview',
            agent_id: leadData.agent_id
          })
          .select()

        if (appError) {
          console.error('Error creating application:', appError)
          toast.error('Failed to create application: ' + appError.message)
          return
        }

        toast.success('Lead status updated and application created successfully')
      } else {
        toast.success('Lead status updated successfully')
      }

      fetchLeads() // Refresh the data
    } catch (error) {
      console.error('Error updating lead status:', error)
      toast.error('Failed to update lead status')
    }
  }

  const updateLeadAmount = async (leadId: number, newAmount: number) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ amount: newAmount })
        .eq('id', leadId)

      if (error) {
        console.error('Error updating lead amount:', error)
        toast.error('Failed to update lead amount')
      } else {
        toast.success('Lead amount updated successfully')
        fetchLeads() // Refresh the data
      }
    } catch (error) {
      console.error('Error updating lead amount:', error)
      toast.error('Failed to update lead amount')
    }
  }

  const exportToCSV = () => {
    if (leads.length === 0) return
    
    const headers = ['App No', 'Name', 'Mobile', 'Amount', 'Status', 'Final Status', 'Uploaded At']
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => [
        lead.app_no,
        lead.name || '',
        lead.mobile_no,
        lead.amount || '',
        lead.status || '',
        lead.final_status,
        new Date(lead.uploaded_at).toLocaleDateString()
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-leads.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const totalPages = Math.ceil(totalCount / itemsPerPage)

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
        <h1 className="text-2xl font-bold text-gray-900">My Leads</h1>
        <p className="text-gray-600">Manage your assigned leads</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* First Row: Search and Status */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by app no, mobile, or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm text-gray-600">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {Constants.public.Enums.status_enum.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Second Row: Date Filters and Export */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div>
                <Label className="text-sm text-gray-600">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>

              {/* Clear Filters Button */}
              {(statusFilter !== 'all' || fromDate || toDate) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('all')
                    setFromDate('')
                    setToDate('')
                  }}
                >
                  Clear Filters
                </Button>
              )}

              <Button onClick={exportToCSV} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Leads ({totalCount})</CardTitle>
              <CardDescription>
                Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} leads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Final Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.app_no}</TableCell>
                  <TableCell>{lead.name || '-'}</TableCell>
                  <TableCell>{lead.mobile_no}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={lead.amount || ''}
                      onChange={(e) => {
                        const newAmount = parseFloat(e.target.value)
                        if (!isNaN(newAmount) && newAmount >= 40000 && newAmount <= 1500000) {
                          updateLeadAmount(lead.id, newAmount)
                        }
                      }}
                      className="w-24"
                      min="40000"
                      max="1500000"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.status || undefined}
                      onValueChange={(value) => updateLeadStatus(lead.id, value as StatusEnum)}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {Constants.public.Enums.status_enum.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lead.final_status === 'open' ? 'default' : 'secondary'}>
                      {lead.final_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
