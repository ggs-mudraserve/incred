'use client'

import { useState, useEffect } from 'react'
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
import { Search, Filter, Edit, UserPlus, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { supabase, LeadNote, StatusEnum, Constants } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

interface Lead {
  id: string
  app_no: string
  name: string
  mobile_no: string
  amount: number
  status: string | null
  final_status: string | null
  agent_id: string | null
  uploaded_at: string
  created_at: string
  updated_at: string
  agent?: {
    name: string
  }
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
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
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

  useEffect(() => {
    fetchLeads()
    fetchAgents()
  }, [])

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          agent:profiles!agent_id(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setLeads(data || [])
    } catch (error) {
      console.error('Error fetching leads:', error)
      toast.error('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }

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

  const handleAssignAgent = async (leadId: string, agentId: string) => {
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

  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update(updates)
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

  const updateLeadStatus = async (leadId: string, newStatus: StatusEnum) => {
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

  const fetchLeadNotes = async (leadId: string | number) => {
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)))
    } else {
      setSelectedLeads(new Set())
    }
  }

  const handleSelectLead = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedLeads)
    if (checked) {
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

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.mobile_no?.includes(searchTerm) ||
                         lead.app_no?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter
    const matchesFinalStatus = finalStatusFilter === 'all' || lead.final_status === finalStatusFilter
    const matchesAgent = agentFilter === 'all' || lead.agent_id === agentFilter

    // Date filtering
    let matchesDate = true
    if (fromDate || toDate) {
      const leadDate = new Date(lead.created_at)
      if (fromDate) {
        const from = new Date(fromDate)
        matchesDate = matchesDate && leadDate >= from
      }
      if (toDate) {
        const to = new Date(toDate)
        to.setHours(23, 59, 59, 999) // Include the entire end date
        matchesDate = matchesDate && leadDate <= to
      }
    }

    return matchesSearch && matchesStatus && matchesFinalStatus && matchesAgent && matchesDate
  }).sort((a, b) => {
    // Sort closed leads to the bottom
    if (a.final_status === 'close' && b.final_status === 'open') return 1
    if (a.final_status === 'open' && b.final_status === 'close') return -1
    // For leads with same final_status, sort by created_at (newest first)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })


  if (loading) {
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
              <CardTitle>All Leads</CardTitle>
              <CardDescription>
                View and manage all leads in the system with advanced filtering
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                <Select value={finalStatusFilter} onValueChange={setFinalStatusFilter}>
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
                <Select value={agentFilter} onValueChange={setAgentFilter}>
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
              {(statusFilter !== 'all' || finalStatusFilter !== 'all' || agentFilter !== 'all' || fromDate || toDate) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatusFilter('all')
                    setFinalStatusFilter('all')
                    setAgentFilter('all')
                    setFromDate('')
                    setToDate('')
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
                      checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                      onCheckedChange={handleSelectAll}
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
                {filteredLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedLeads.has(lead.id)}
                        onCheckedChange={(checked) => handleSelectLead(lead.id, checked as boolean)}
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
                          onClick={() => {
                            setSelectedLead(lead)
                            setIsEditDialogOpen(true)
                          }}
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
              </TableBody>
            </Table>
          </div>
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
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lead</DialogTitle>
            <DialogDescription>
              Update lead information
            </DialogDescription>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    defaultValue={selectedLead.name}
                    onChange={(e) => setSelectedLead({...selectedLead, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    defaultValue={selectedLead.phone}
                    onChange={(e) => setSelectedLead({...selectedLead, phone: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={selectedLead.email}
                  onChange={(e) => setSelectedLead({...selectedLead, email: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loan_amount">Loan Amount</Label>
                  <Input
                    id="loan_amount"
                    type="number"
                    defaultValue={selectedLead.loan_amount}
                    onChange={(e) => setSelectedLead({...selectedLead, loan_amount: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={selectedLead.status || ''}
                    onValueChange={(value) => setSelectedLead({...selectedLead, status: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
                      <SelectItem value="qualified">Qualified</SelectItem>
                      <SelectItem value="not_interested">Not Interested</SelectItem>
                      <SelectItem value="follow_up">Follow Up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  defaultValue={selectedLead.notes || ''}
                  onChange={(e) => setSelectedLead({...selectedLead, notes: e.target.value})}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleUpdateLead(selectedLead.id, selectedLead)}>
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
