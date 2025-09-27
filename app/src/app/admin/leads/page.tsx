'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckedState } from '@radix-ui/react-checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Filter, Edit, UserPlus, MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react'
import { supabase, LeadNote, StatusEnum, Constants } from '@/lib/supabase'
import type { Lead as SupabaseLead } from '@/lib/supabase'
import { deriveFinalStatus, SORT_LEADS_BY_STATUS_AND_CREATED_AT } from '@/lib/lead-helpers'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

type LeadUpdateColumns = 'app_no' | 'name' | 'mobile_no' | 'amount' | 'status' | 'final_status' | 'agent_id'

type Lead = SupabaseLead & {
  agent?: {
    name: string
  }
  email?: string | null
  notes?: string | null
}

interface Agent {
  id: string
  name: string
}

interface LeadNoteWithAuthor extends LeadNote {
  author?: {
    name: string
  }
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [finalStatusFilter, setFinalStatusFilter] = useState('all')
  const [agentFilter, setAgentFilter] = useState('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [leadNotes, setLeadNotes] = useState<LeadNoteWithAuthor[]>([])
  const [newNote, setNewNote] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set())
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newLead, setNewLead] = useState({
    app_no: '',
    name: '',
    mobile_no: '',
    amount: 0
  })
  const [creating, setCreating] = useState(false)
  const { user } = useAuth()
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingEditLead, setLoadingEditLead] = useState(false)
  const blankEditLeadForm = {
    name: '',
    mobile_no: '',
    email: '',
    amount: '',
    status: '',
    notes: ''
  }
  const [editLeadForm, setEditLeadForm] = useState(blankEditLeadForm)
  const itemsPerPage = 50

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(handler)
  }, [searchTerm])

  useEffect(() => {
    fetchAgents()
  }, [])

  const populateEditLeadForm = (lead: Lead) => {
    setEditLeadForm({
      name: lead.name ?? '',
      mobile_no: lead.mobile_no ?? '',
      email: lead.email ?? '',
      amount: lead.amount != null ? lead.amount.toString() : '',
      status: lead.status ?? '',
      notes: lead.notes ?? ''
    })
  }

  const handleOpenEditDialog = async (lead: Lead) => {
    setSelectedLead(lead)
    populateEditLeadForm(lead)
    setIsEditDialogOpen(true)

    try {
      setLoadingEditLead(true)
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead.id)
        .single()

      if (error) throw error
      if (data) {
        const mergedLead: Lead = { ...lead, ...data }
        setSelectedLead(mergedLead)
        populateEditLeadForm(mergedLead)
      }
    } catch (error) {
      console.error('Error fetching lead details:', error)
      toast.error('Failed to load lead details')
    } finally {
      setLoadingEditLead(false)
    }
  }

  const fetchLeads = useCallback(async (page = currentPage) => {
    try {
      setLoading(true)

      let query = supabase
        .from('leads')
        .select(`
          *,
          agent:profiles!agent_id(name)
        `, { count: 'exact' })

      if (debouncedSearchTerm) {
        query = query.or(`app_no.ilike.%${debouncedSearchTerm}%,mobile_no.ilike.%${debouncedSearchTerm}%,name.ilike.%${debouncedSearchTerm}%`)
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      if (finalStatusFilter !== 'all') {
        query = query.eq('final_status', finalStatusFilter)
      }

      if (agentFilter !== 'all') {
        query = query.eq('agent_id', agentFilter)
      }

      if (fromDate) {
        const startDate = new Date(fromDate)
        query = query.gte('created_at', startDate.toISOString())
      }

      if (toDate) {
        const endDate = new Date(toDate)
        endDate.setHours(23, 59, 59, 999)
        query = query.lte('created_at', endDate.toISOString())
      }

      query = query
        .order('created_at', { ascending: false })
        .range((page - 1) * itemsPerPage, page * itemsPerPage - 1)

      const { data, error, count } = await query

      if (error) throw error

      setTotalCount(count || 0)

      if (page > 1 && (!data || data.length === 0) && (count || 0) > 0) {
        setLeads([])
        setCurrentPage(prev => Math.max(prev - 1, 1))
        return
      }

      const sortedLeads = (data || []).sort(SORT_LEADS_BY_STATUS_AND_CREATED_AT)

      setLeads(sortedLeads)
    } catch (error) {
      console.error('Error fetching leads:', error)
      toast.error('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedSearchTerm, statusFilter, finalStatusFilter, agentFilter, fromDate, toDate, itemsPerPage])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  useEffect(() => {
    setSelectedLeads(prev => {
      const next = new Set<number>()
      leads.forEach(lead => {
        if (prev.has(lead.id)) {
          next.add(lead.id)
        }
      })

      if (next.size === prev.size) {
        let unchanged = true
        prev.forEach(id => {
          if (!next.has(id) && unchanged) {
            unchanged = false
          }
        })
        if (unchanged) {
          return prev
        }
      }

      return next
    })
  }, [leads])

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'agent')

      if (error) throw error
      setAgents(data || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const handleAssignAgent = async (leadId: number, agentId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ agent_id: agentId })
        .eq('id', leadId)

      if (error) throw error
      
      toast.success('Agent assigned successfully')
      fetchLeads()
      setIsAssignDialogOpen(false)
    } catch (error) {
      console.error('Error assigning agent:', error)
      toast.error('Failed to assign agent')
    }
  }

  const handleUpdateLead = async (leadId: number, updates: Partial<Lead>) => {
    try {
      const allowedKeys: LeadUpdateColumns[] = [
        'app_no',
        'name',
        'mobile_no',
        'amount',
        'status',
        'final_status',
        'agent_id'
      ]
      const normalized = updates as Partial<Record<LeadUpdateColumns, string | number | null>>
      const payload = allowedKeys.reduce((acc, key) => {
        const value = normalized[key]
        if (typeof value !== 'undefined') {
          acc[key] = value as Lead[typeof key]
        }
        return acc
      }, {} as Partial<Record<LeadUpdateColumns, string | number | null>>)

      if (Object.keys(payload).length === 0) {
        toast.error('No valid fields to update')
        return
      }

      const { error } = await supabase
        .from('leads')
        .update(payload)
        .eq('id', leadId)

      if (error) throw error
      
      toast.success('Lead updated successfully')
      fetchLeads()
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating lead:', error)
      toast.error('Failed to update lead')
    }
  }

  const updateLeadStatus = async (leadId: number, newStatus: StatusEnum) => {
    try {
      // Update the lead with new status and final_status
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          status: newStatus,
          final_status: deriveFinalStatus(newStatus)
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
        const { error: appError } = await supabase
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

  const fetchLeadNotes = async (leadId: number) => {
    try {
      setLoadingNotes(true)
      const { data, error } = await supabase
        .from('lead_notes')
        .select(`
          *,
          author:profiles(name)
        `)
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Supabase error details:', error)
        throw error
      }
      
      setLeadNotes(data || [])
    } catch (error) {
      console.error('Error fetching notes:', error)
      toast.error('Failed to fetch notes')
    } finally {
      setLoadingNotes(false)
    }
  }

  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No authenticated user')

      const { error } = await supabase
        .from('lead_notes')
        .insert({
          lead_id: selectedLead.id,
          author_id: user.id,
          note: newNote.trim()
        })

      if (error) throw error
      
      toast.success('Note added successfully')
      setNewNote('')
      fetchLeadNotes(selectedLead.id)
    } catch (error) {
      console.error('Error adding note:', error)
      toast.error('Failed to add note')
    }
  }

  const handleSelectAll = (checked: CheckedState) => {
    if (checked === 'indeterminate') {
      return
    }

    if (checked) {
      setSelectedLeads(new Set(leads.map(lead => lead.id)))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const handleSelectLead = (leadId: number, checked: CheckedState) => {
    const isChecked = checked === true
    const newSelected = new Set(selectedLeads)
    if (isChecked) {
      newSelected.add(leadId)
    } else {
      newSelected.delete(leadId)
    }
    setSelectedLeads(newSelected)
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return

    setBulkDeleting(true)
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', Array.from(selectedLeads))

      if (error) throw error
      
      toast.success(`Successfully deleted ${selectedLeads.size} leads`)
      setSelectedLeads(new Set())
      setShowBulkDeleteDialog(false)
      fetchLeads() // Refresh the data
    } catch (error) {
      console.error('Error deleting leads:', error)
      toast.error('Failed to delete leads')
    } finally {
      setBulkDeleting(false)
    }
  }

  const handleCreateLead = async () => {
    if (!user) {
      toast.error('User not authenticated')
      return
    }

    if (!newLead.app_no || !newLead.name || !newLead.mobile_no || !newLead.amount) {
      toast.error('Please fill in all required fields')
      return
    }

    if (newLead.mobile_no.length !== 10) {
      toast.error('Mobile number must be exactly 10 digits')
      return
    }

    if (newLead.amount < 40000 || newLead.amount > 1500000) {
      toast.error('Amount must be between ₹40,000 and ₹15,00,000')
      return
    }

    setCreating(true)
    try {
      const { error } = await supabase
        .from('leads')
        .insert({
          app_no: newLead.app_no,
          name: newLead.name,
          mobile_no: newLead.mobile_no,
          amount: newLead.amount,
          agent_id: user.id,
          final_status: 'open'
        })

      if (error) throw error
      
      toast.success('Lead created successfully')
      setNewLead({ app_no: '', name: '', mobile_no: '', amount: 0 })
      setIsCreateDialogOpen(false)
      fetchLeads()
    } catch (error: unknown) {
      console.error('Error creating lead:', error)
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505' && 'constraint' in error && error.constraint === 'leads_app_no_key') {
        toast.error('App number already exists. Please use a unique app number.')
      } else {
        toast.error('Failed to create lead')
      }
    } finally {
      setCreating(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage))
  const showingFrom = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1
  const showingTo = totalCount === 0 ? 0 : Math.min(currentPage * itemsPerPage, totalCount)
  const allVisibleSelected = leads.length > 0 && leads.every(lead => selectedLeads.has(lead.id))
  const someVisibleSelected = leads.some(lead => selectedLeads.has(lead.id))
  const headerCheckboxState: CheckedState = allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false
  const showPagination = totalPages > 1

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leads Management</h1>
        <p className="text-gray-600">Manage and assign leads to agents</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Leads ({totalCount})</CardTitle>
              <CardDescription>
                View and manage all leads in the system with advanced filtering.{' '}
                {totalCount > 0
                  ? `Showing ${showingFrom} to ${showingTo} of ${totalCount} leads`
                  : 'No leads match the current filters'}
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Lead
            </Button>
            {selectedLeads.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
                className="ml-4"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedLeads.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            {/* All Filters in One Row */}
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div>
                <Label className="text-sm text-gray-600">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="cash salary">Cash Salary</SelectItem>
                    <SelectItem value="self employed">Self Employed</SelectItem>
                    <SelectItem value="NI">NI</SelectItem>
                    <SelectItem value="ring more than 3 days">Ring More Than 3 Days</SelectItem>
                    <SelectItem value="salary low">Salary Low</SelectItem>
                    <SelectItem value="cibil issue">CIBIL Issue</SelectItem>
                    <SelectItem value="banking received">Banking Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-600">Final Status</Label>
                <Select
                  value={finalStatusFilter}
                  onValueChange={(value) => {
                    setFinalStatusFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-48">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by final status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Final Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="close">Close</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-600">Agent</Label>
                <Select
                  value={agentFilter}
                  onValueChange={(value) => {
                    setAgentFilter(value)
                    setCurrentPage(1)
                  }}
                >
                  <SelectTrigger className="w-48">
                    <UserPlus className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter by agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm text-gray-600">From Date</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-40"
                />
              </div>

              <div>
                <Label className="text-sm text-gray-600">To Date</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="w-40"
                />
              </div>

              {/* Clear Filters Button */}
              {(statusFilter !== 'all' || finalStatusFilter !== 'all' || agentFilter !== 'all' || fromDate || toDate || searchTerm || debouncedSearchTerm) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('all')
                    setFinalStatusFilter('all')
                    setAgentFilter('all')
                    setFromDate('')
                    setToDate('')
                    setSearchTerm('')
                    setDebouncedSearchTerm('')
                    setCurrentPage(1)
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={headerCheckboxState}
                      onCheckedChange={handleSelectAll}
                      disabled={leads.length === 0}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>App No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Final Status</TableHead>
                  <TableHead>Assigned Agent</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, checked)}
                        aria-label={`Select lead ${lead.app_no}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{lead.app_no}</TableCell>
                    <TableCell>{lead.name}</TableCell>
                    <TableCell>{lead.mobile_no}</TableCell>
                    <TableCell>₹{lead.amount?.toLocaleString()}</TableCell>
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
                      {lead.agent?.name || 'Unassigned'}
                    </TableCell>
                    <TableCell>
                      {new Date(lead.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead)
                            setSelectedAgentId(lead.agent_id || '')
                            setIsAssignDialogOpen(true)
                          }}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditDialog(lead)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead)
                            fetchLeadNotes(lead.id)
                            setIsNotesDialogOpen(true)
                          }}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-gray-500 py-6">
                      No leads found for the selected filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {showPagination && (
            <div className="flex justify-center space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Agent Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open)
        if (!open) {
          setSelectedAgentId('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Agent</DialogTitle>
            <DialogDescription>
              Assign an agent to {selectedLead?.name || 'this lead'}
              {selectedLead?.agent?.name && (
                <span className="block text-sm text-gray-500 mt-1">
                  Currently assigned to: {selectedLead.agent.name}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent">Select Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignDialogOpen(false)
                  setSelectedAgentId('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedLead && selectedAgentId) {
                    handleAssignAgent(selectedLead.id, selectedAgentId)
                    setSelectedAgentId('')
                  }
                }}
                disabled={!selectedAgentId}
              >
                Assign Agent
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) {
            setSelectedLead(null)
            setEditLeadForm(blankEditLeadForm)
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead information
            </DialogDescription>
          </DialogHeader>
          {loadingEditLead && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading lead details…</span>
            </div>
          )}
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={editLeadForm.name}
                    onChange={(e) =>
                      setEditLeadForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={editLeadForm.mobile_no}
                    onChange={(e) =>
                      setEditLeadForm((prev) => ({ ...prev, mobile_no: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editLeadForm.email}
                  onChange={(e) =>
                    setEditLeadForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loan_amount">Loan Amount</Label>
                  <Input
                    id="loan_amount"
                    type="number"
                    value={editLeadForm.amount}
                    onChange={(e) =>
                      setEditLeadForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={editLeadForm.status}
                    onValueChange={(value) =>
                      setEditLeadForm((prev) => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
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
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editLeadForm.notes}
                  onChange={(e) =>
                    setEditLeadForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    const amountValue = editLeadForm.amount.trim()
                    const parsedAmount = amountValue === '' ? null : Number(amountValue)

                    if (parsedAmount !== null && Number.isNaN(parsedAmount)) {
                      toast.error('Please enter a valid amount')
                      return
                    }

                    const payload: Partial<Lead> = {
                      name: editLeadForm.name,
                      mobile_no: editLeadForm.mobile_no,
                      amount: parsedAmount,
                      status: editLeadForm.status || null
                    }

                    if ('email' in selectedLead) {
                      payload.email = editLeadForm.email || null
                    }

                    if ('notes' in selectedLead) {
                      payload.notes = editLeadForm.notes || null
                    }

                    handleUpdateLead(selectedLead.id, payload)
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={isNotesDialogOpen} onOpenChange={setIsNotesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lead Notes</DialogTitle>
            <DialogDescription>
              Notes for {selectedLead?.name} ({selectedLead?.app_no})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Add Note Section */}
            <div className="space-y-2">
              <Label htmlFor="new-note">Add New Note</Label>
              <div className="flex space-x-2">
                <Textarea
                  id="new-note"
                  placeholder="Enter your note (max 500 characters)"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  maxLength={500}
                  rows={3}
                  className="flex-1"
                />
                <Button 
                  onClick={handleAddNote} 
                  disabled={!newNote.trim()}
                  className="self-start"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
              <div className="text-sm text-gray-500">
                {newNote.length}/500 characters
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-2">
              <Label>Notes History</Label>
              <div className="max-h-96 overflow-y-auto border rounded-lg">
                {loadingNotes ? (
                  <div className="p-4 text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                ) : leadNotes.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    No notes found for this lead
                  </div>
                ) : (
                  <div className="divide-y">
                    {leadNotes.map((note) => (
                      <div key={note.id} className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm text-blue-600">
                            {note.author?.name || 'Unknown User'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(note.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {note.note}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <Dialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Selected Leads</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedLeads.size} selected lead{selectedLeads.size !== 1 ? 's' : ''}? 
              This action cannot be undone and will also delete all associated notes and applications.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-6">
            <Button 
              variant="outline" 
              onClick={() => setShowBulkDeleteDialog(false)}
              disabled={bulkDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete {selectedLeads.size} Lead{selectedLeads.size !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Lead</DialogTitle>
            <DialogDescription>
              Add a new lead to the system. The lead will be assigned to you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="app_no">App Number *</Label>
              <Input
                id="app_no"
                placeholder="Enter unique app number"
                value={newLead.app_no}
                onChange={(e) => setNewLead({...newLead, app_no: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="Enter customer name"
                value={newLead.name}
                onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                required
              />
            </div>
            <div>
              <Label htmlFor="mobile_no">Mobile Number *</Label>
              <Input
                id="mobile_no"
                placeholder="10-digit mobile number"
                value={newLead.mobile_no}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setNewLead({...newLead, mobile_no: value})
                }}
                maxLength={10}
                required
              />
            </div>
            <div>
              <Label htmlFor="amount">Loan Amount *</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Amount between ₹40,000 - ₹15,00,000"
                value={newLead.amount || ''}
                onChange={(e) => setNewLead({...newLead, amount: Number(e.target.value)})}
                min="40000"
                max="1500000"
                required
              />
            </div>
            <div className="text-sm text-gray-500">
              * Required fields. Lead will be assigned to you automatically.
            </div>
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsCreateDialogOpen(false)
                  setNewLead({ app_no: '', name: '', mobile_no: '', amount: 0 })
                }}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleCreateLead}
                disabled={creating || !newLead.app_no || !newLead.name || !newLead.mobile_no || !newLead.amount}
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Lead
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
