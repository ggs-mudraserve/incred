'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Filter, Eye, Edit, DollarSign } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  useSortable,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Application {
  id: string
  lead_id: string
  status: string
  stage: string
  loan_amount: number
  interest_rate?: number
  tenure_months?: number
  monthly_emi?: number
  disbursed_amount?: number
  disbursed_date?: string
  notes?: string
  created_at: string
  updated_at: string
  lead: {
    name: string
    mobile_no: string
  }
  agent?: {
    name: string
  }
}

const statusColumns = {
  'UnderReview': 'Under Review',
  'Approved': 'Approved',
  'Reject': 'Rejected',
  'Disbursed': 'Disbursed'
}

// Droppable Column Component
function DroppableColumn({ id, title, count, children }: {
  id: string
  title: string
  count: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'UnderReview': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Approved': return 'bg-green-100 text-green-800 border-green-200'
      case 'Disbursed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'Reject': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'UnderReview': return '⏳'
      case 'Approved': return '✅'
      case 'Disbursed': return '💰'
      case 'Reject': return '❌'
      default: return '📄'
    }
  }

  return (
    <Card className={`h-full border-t-4 ${getStageColor(id).split(' ').slice(-1)[0].replace('text-', 'border-t-')}`}>
      <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStageIcon(id)}</span>
            <span className="text-gray-800">{title}</span>
          </div>
          <Badge
            variant="secondary"
            className={`${getStageColor(id)} font-medium px-2 py-1`}
          >
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent
        ref={setNodeRef}
        className={`p-4 space-y-3 min-h-96 transition-colors ${
          isOver ? 'bg-blue-50 border-blue-200' : ''
        }`}
      >
        {children}
        {/* Empty state */}
        {count === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <div className="text-4xl mb-2">{getStageIcon(id)}</div>
            <div className="text-sm">No applications</div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Draggable Application Card Component
function DraggableApplicationCard({ application, onClick }: {
  application: Application,
  onClick: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: application.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200 border border-gray-200 hover:border-blue-300 bg-white"
      onClick={onClick}
    >
      <div className="space-y-2">
        {/* Line 1: Customer Name */}
        <div className="font-semibold text-gray-900 text-sm truncate">
          {application.lead?.name || 'Unknown Customer'}
        </div>

        {/* Line 2: Mobile Number */}
        <div className="text-sm text-gray-600 font-mono">
          📱 {application.lead?.mobile_no || 'No mobile'}
        </div>

        {/* Line 3: Agent Name */}
        <div className="text-sm text-blue-600 truncate">
          👤 {application.agent?.name || 'Unassigned'}
        </div>

        {/* Additional info in a subtle way */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <div className="text-xs font-medium text-green-600">
            ₹{application.loan_amount?.toLocaleString() || '0'}
          </div>
          <div className="text-xs text-gray-400">
            {new Date(application.created_at).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short'
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          lead:leads!lead_id(name, mobile_no),
          agent:profiles!agent_id(name)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setApplications(data || [])
    } catch (error) {
      console.error('Error fetching applications:', error)
      toast.error('Failed to fetch applications')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateApplication = async (applicationId: string, updates: Partial<Application>) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', applicationId)

      if (error) throw error

      toast.success('Application updated successfully')
      fetchApplications()
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating application:', error)
      toast.error('Failed to update application')
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const applicationId = active.id as string
    const newStage = over.id as string

    // Find the application being moved
    const application = applications.find(app => app.id === applicationId)
    if (!application || application.stage === newStage) return

    // Optimistically update the UI
    setApplications(prev =>
      prev.map(app =>
        app.id === applicationId
          ? { ...app, stage: newStage }
          : app
      )
    )

    // Update in database
    try {
      const { error } = await supabase
        .from('applications')
        .update({ stage: newStage, updated_at: new Date().toISOString() })
        .eq('id', applicationId)

      if (error) throw error

      toast.success(`Application moved to ${statusColumns[newStage as keyof typeof statusColumns]}`)
    } catch (error) {
      console.error('Error updating application stage:', error)
      toast.error('Failed to update application stage')
      // Revert the optimistic update
      fetchApplications()
    }
  }

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.lead?.mobile_no?.includes(searchTerm)
    const matchesStage = statusFilter === 'all' || app.stage === statusFilter
    return matchesSearch && matchesStage
  })

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'UnderReview': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'Approved': return 'bg-green-100 text-green-800 border-green-200'
      case 'Disbursed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
      case 'Reject': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'UnderReview': return '⏳'
      case 'Approved': return '✅'
      case 'Disbursed': return '💰'
      case 'Reject': return '❌'
      default: return '📄'
    }
  }

  const groupedApplications = Object.keys(statusColumns).reduce((acc, stage) => {
    acc[stage] = filteredApplications.filter(app => app.stage === stage)
    return acc
  }, {} as Record<string, Application[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-none space-y-6 p-6 min-h-screen bg-gray-50">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Applications Management</h1>
          <p className="text-gray-600 mt-1">Track and manage loan applications through the pipeline</p>
        </div>
        <div className="text-sm text-gray-500">
          Total: {applications.length} applications
        </div>
      </div>

      <div className="flex space-x-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusColumns).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Modern Kanban Board with Drag & Drop */}
      <div className="w-full overflow-x-auto">
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-6 min-w-full pb-4" style={{ minWidth: 'max-content' }}>
            {Object.entries(statusColumns).map(([stage, title]) => (
              <div key={stage} className="flex-1 min-w-80">
                <DroppableColumn
                  id={stage}
                  title={title}
                  count={groupedApplications[stage]?.length || 0}
                >
                  <SortableContext
                    items={groupedApplications[stage]?.map(app => app.id) || []}
                    strategy={verticalListSortingStrategy}
                  >
                    {groupedApplications[stage]?.map((application) => (
                      <DraggableApplicationCard
                        key={application.id}
                        application={application}
                        onClick={() => {
                          setSelectedApplication(application)
                          setIsEditDialogOpen(true)
                        }}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              </div>
            ))}
          </div>
          <DragOverlay>
            {activeId ? (
              <Card className="p-4 opacity-50 border border-gray-200 bg-white">
                <div className="space-y-2">
                  <div className="font-semibold text-gray-900 text-sm">Dragging...</div>
                  <div className="text-sm text-gray-600">📱 Moving application</div>
                </div>
              </Card>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Edit Application Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Application</DialogTitle>
            <DialogDescription>
              Update application details and status
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Customer Name</Label>
                  <Input value={selectedApplication.lead.name} disabled />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={selectedApplication.lead.mobile_no} disabled />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="loan_amount">Loan Amount</Label>
                  <Input
                    id="loan_amount"
                    type="number"
                    defaultValue={selectedApplication.loan_amount}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      loan_amount: Number(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="stage">Stage</Label>
                  <Select
                    value={selectedApplication.stage}
                    onValueChange={(value) => setSelectedApplication({
                      ...selectedApplication,
                      stage: value
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusColumns).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interest_rate">Interest Rate (%)</Label>
                  <Input
                    id="interest_rate"
                    type="number"
                    step="0.01"
                    defaultValue={selectedApplication.interest_rate}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      interest_rate: Number(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="tenure_months">Tenure (Months)</Label>
                  <Input
                    id="tenure_months"
                    type="number"
                    defaultValue={selectedApplication.tenure_months}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      tenure_months: Number(e.target.value)
                    })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="monthly_emi">Monthly EMI</Label>
                  <Input
                    id="monthly_emi"
                    type="number"
                    defaultValue={selectedApplication.monthly_emi}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      monthly_emi: Number(e.target.value)
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="disbursed_amount">Disbursed Amount</Label>
                  <Input
                    id="disbursed_amount"
                    type="number"
                    defaultValue={selectedApplication.disbursed_amount}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      disbursed_amount: Number(e.target.value)
                    })}
                  />
                </div>
              </div>

              {selectedApplication.stage === 'Disbursed' && (
                <div>
                  <Label htmlFor="disbursed_date">Disbursed Date</Label>
                  <Input
                    id="disbursed_date"
                    type="date"
                    defaultValue={selectedApplication.disbursed_date?.split('T')[0]}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      disbursed_date: e.target.value
                    })}
                  />
                </div>
              )}

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  defaultValue={selectedApplication.notes || ''}
                  onChange={(e) => setSelectedApplication({
                    ...selectedApplication,
                    notes: e.target.value
                  })}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => handleUpdateApplication(selectedApplication.id, selectedApplication)}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
