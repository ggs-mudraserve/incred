'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { supabase, Lead, LeadNote, StatusEnum, Constants } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Search, MessageSquare, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface LeadNoteWithAuthor extends LeadNote {
  author?: {
    name: string
  }
}

export default function AgentDashboard() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [finalStatusFilter, setFinalStatusFilter] = useState<string>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 25
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isNotesDialogOpen, setIsNotesDialogOpen] = useState(false)
  const [leadNotes, setLeadNotes] = useState<LeadNoteWithAuthor[]>([])
  const [newNote, setNewNote] = useState('')
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newLead, setNewLead] = useState({
    app_no: '',
    name: '',
    mobile_no: '',
    amount: 0
  })
  const [creating, setCreating] = useState(false)

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
      if (searchQuery) {
        query = query.or(`app_no.ilike.%${searchQuery}%,mobile_no.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`)
      }

      // Apply status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      // Apply final status filter
      if (finalStatusFilter !== 'all') {
        query = query.eq('final_status', finalStatusFilter)
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
        // Sort leads to put closed leads at bottom
        const sortedLeads = (data || []).sort((a, b) => {
          // Sort closed leads to the bottom
          if (a.final_status === 'close' && b.final_status === 'open') return 1
          if (a.final_status === 'open' && b.final_status === 'close') return -1
          // For leads with same final_status, sort by created_at (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
        setLeads(sortedLeads)
        setTotalCount(count || 0)
      }
    } catch (error) {
      console.error('Error fetching leads:', error)
      toast.error('Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (profile) {
      fetchLeads()
    }
  }, [profile, currentPage, searchQuery, statusFilter, finalStatusFilter, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = () => {
    setSearchQuery(searchTerm)
    setCurrentPage(1) // Reset to first page when searching
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
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

  const updateLeadName = async (leadId: number, newName: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ name: newName })
        .eq('id', leadId)

      if (error) {
        console.error('Error updating lead name:', error)
        toast.error('Failed to update lead name')
      } else {
        toast.success('Lead name updated successfully')
        fetchLeads() // Refresh the data
      }
    } catch (error) {
      console.error('Error updating lead name:', error)
      toast.error('Failed to update lead name')
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

  const handleCreateLead = async () => {
    if (!profile) {
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
          agent_id: profile.id,
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
          {/* All Filters in One Row */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-64">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    placeholder="Search by app no, mobile, or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleSearchKeyPress}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleSearch} variant="outline" size="default">
                  Search
                </Button>
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

            <div>
              <Label className="text-sm text-gray-600">Final Status</Label>
              <Select value={finalStatusFilter} onValueChange={setFinalStatusFilter}>
                <SelectTrigger className="w-48">
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
            {(statusFilter !== 'all' || finalStatusFilter !== 'all' || fromDate || toDate || searchQuery) && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all')
                  setFinalStatusFilter('all')
                  setFromDate('')
                  setToDate('')
                  setSearchTerm('')
                  setSearchQuery('')
                }}
              >
                Clear Filters
              </Button>
            )}

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
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create New Lead
            </Button>
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
                  <TableCell>
                    <Input
                      type="text"
                      defaultValue={lead.name || ''}
                      onBlur={(e) => {
                        const newName = e.target.value.trim()
                        if (newName.length >= 2 && newName !== lead.name) {
                          updateLeadName(lead.id, newName)
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          const newName = (e.target as HTMLInputElement).value.trim()
                          if (newName.length >= 2 && newName !== lead.name) {
                            updateLeadName(lead.id, newName)
                          }
                          ;(e.target as HTMLInputElement).blur()
                        }
                      }}
                      placeholder="Enter name"
                      className="w-32"
                    />
                  </TableCell>
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
