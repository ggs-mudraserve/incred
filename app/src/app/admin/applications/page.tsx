'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Filter, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
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
function DroppableColumn({ id, title, count, totalAmount, children }: {
  id: string
  title: string
  count: number
  totalAmount: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const stageKey = id.replace('stage-', '')

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
    <Card 
      ref={setNodeRef}
      className={`h-full border-t-4 transition-all duration-200 ${getStageColor(stageKey).split(' ').slice(-1)[0].replace('text-', 'border-t-')} ${
        isOver ? 'bg-blue-50 border-blue-300 shadow-lg scale-[1.02]' : ''
      }`}
    >
      <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getStageIcon(stageKey)}</span>
            <span className="text-gray-800">{title}</span>
          </div>
          <Badge
            variant="secondary"
            className={`${getStageColor(stageKey)} font-medium px-2 py-1`}
          >
            {count}
          </Badge>
        </CardTitle>
        {/* Total Amount Display */}
        <div className="text-sm text-gray-600 mt-2">
          <div className="flex items-center justify-between">
            <span>Total Amount:</span>
            <span className="font-medium text-green-700">
              ₹{totalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </CardHeader>
      <div className="p-4 space-y-3 min-h-96">
        <CardContent className="p-0">
          {children}
          {/* Empty state */}
          {count === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <div className="text-4xl mb-2">{getStageIcon(stageKey)}</div>
              <div className="text-sm">No applications</div>
              {isOver && (
                <div className="text-blue-600 text-sm font-medium mt-4 animate-bounce">
                  Drop application here
                </div>
              )}
            </div>
          )}
        </CardContent>
        {/* Visual feedback when dragging over */}
        {isOver && count > 0 && (
          <div className="text-center text-blue-600 text-sm font-medium py-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50 animate-pulse">
            Drop application here
          </div>
        )}
      </div>
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
  } = useSortable({ id: `app-${application.id}` })

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
      className="p-2 hover:shadow-md hover:scale-[1.01] transition-all duration-200 border border-gray-200 hover:border-blue-300 bg-white relative cursor-grab active:cursor-grabbing"
    >
      {/* View Details Button */}
      <div 
        className="absolute top-1 right-1 p-0.5 hover:bg-blue-100 rounded z-10"
        title="Click to view details"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <Eye className="w-3 h-3 text-blue-600" />
      </div>

      {/* Card Content */}
      <div className="space-y-1 pr-6">
        {/* Line 1: Customer Name */}
        <div className="font-medium text-gray-900 text-xs truncate">
          {application.lead?.name || 'Unknown Customer'}
        </div>

        {/* Line 2: Mobile & Amount in one line */}
        <div className="flex items-center justify-between text-xs">
          <div className="text-gray-600 font-mono truncate">
            📱 {application.lead?.mobile_no || 'No mobile'}
          </div>
          <div className="text-green-600 font-medium">
            ₹{application.loan_amount?.toLocaleString() || '0'}
          </div>
        </div>

        {/* Line 3: Agent & Date */}
        <div className="flex items-center justify-between text-xs">
          <div className="text-blue-600 truncate">
            👤 {application.agent?.name || 'Unassigned'}
          </div>
          <div className="text-gray-400">
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
  const [isDisbursementDialogOpen, setIsDisbursementDialogOpen] = useState(false)
  const [pendingDisbursement, setPendingDisbursement] = useState<{applicationId: string, application: Application} | null>(null)
  const [disbursedAmount, setDisbursedAmount] = useState('')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  )

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
      console.log('Fetched applications:', data)
      console.log('Application IDs:', data?.map(app => ({ id: app.id, type: typeof app.id })))
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
      // Filter out fields that don't belong to the applications table
      const { lead, agent: _unusedAgent, ...applicationUpdates } = updates
      
      // Update the applications table
      const { error } = await supabase
        .from('applications')
        .update({ ...applicationUpdates, updated_at: new Date().toISOString() })
        .eq('id', applicationId)

      if (error) throw error

      // Update lead name if it was changed
      if (lead?.name !== undefined) {
        const selectedApp = applications.find(app => String(app.id) === String(applicationId))
        if (selectedApp && selectedApp.lead_id) {
          const { error: leadError } = await supabase
            .from('leads')
            .update({ name: lead.name })
            .eq('id', selectedApp.lead_id)
          
          if (leadError) {
            console.error('Error updating lead name:', leadError)
            toast.error('Application updated but failed to update customer name')
          } else {
            toast.success('Application and customer name updated successfully')
          }
        }
      } else {
        toast.success('Application updated successfully')
      }

      fetchApplications()
      setIsEditDialogOpen(false)
    } catch (error) {
      console.error('Error updating application:', error)
      toast.error('Failed to update application')
    }
  }

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id)
    const applicationId = activeId.startsWith('app-') ? activeId.replace('app-', '') : activeId
    setActiveId(applicationId)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)
    
    console.log('Raw drag data - activeId:', activeId, 'overId:', overId, 'over object:', over)
    
    // Extract application ID (remove 'app-' prefix)
    const applicationId = activeId.startsWith('app-') ? activeId.replace('app-', '') : activeId

    // Determine which stage we should drop into.
    let targetStage: string | null = null

    if (overId.startsWith('stage-')) {
      targetStage = overId.replace('stage-', '')
    } else {
      const sortableContainerId = over.data?.current?.sortable?.containerId
      if (sortableContainerId && String(sortableContainerId).startsWith('stage-')) {
        targetStage = String(sortableContainerId).replace('stage-', '')
      } else if (overId.startsWith('app-')) {
        const overApplicationId = overId.replace('app-', '')
        const overApplication = applications.find(app => String(app.id) === String(overApplicationId))
        targetStage = overApplication?.stage ?? null
      }
    }

    if (!targetStage) {
      console.log('Unable to resolve drop stage, ignoring. OverId:', overId)
      return
    }
    
    console.log('Drag ended - activeId:', activeId, 'applicationId:', applicationId, 'overId:', overId, 'newStage:', targetStage)

    // Find the application being moved (handle both string and number IDs)
    const application = applications.find(app => String(app.id) === String(applicationId))
    console.log('Found application:', application, 'current stage:', application?.stage, 'new stage:', targetStage)
    console.log('Looking for ID:', applicationId, 'Available IDs:', applications.map(app => app.id))
    
    if (!application) {
      console.log('Application not found for ID:', applicationId)
      return
    }
    
    if (application.stage === targetStage) {
      console.log('Same stage, skipping update')
      return
    }

    // If moving to Disbursed stage, show disbursement dialog
    if (targetStage === 'Disbursed') {
      setPendingDisbursement({ applicationId, application })
      setDisbursedAmount(application.disbursed_amount?.toString() || application.loan_amount?.toString() || '')
      setIsDisbursementDialogOpen(true)
      return
    }

    // For other stages, update directly
    // Optimistically update the UI
    setApplications(prev =>
      prev.map(app =>
        String(app.id) === String(applicationId)
          ? { ...app, stage: targetStage }
          : app
      )
    )

    // Update in database
    try {
      const { error } = await supabase
        .from('applications')
        .update({ stage: targetStage, updated_at: new Date().toISOString() })
        .eq('id', applicationId)

      if (error) throw error

      toast.success(`Application moved to ${statusColumns[targetStage as keyof typeof statusColumns]}`)
    } catch (error) {
      console.error('Error updating application stage:', error)
      toast.error('Failed to update application stage')
      // Revert the optimistic update
      fetchApplications()
    }
  }

  const handleDisbursementConfirm = async () => {
    if (!pendingDisbursement || !disbursedAmount) {
      toast.error('Please enter a disbursed amount')
      return
    }

    const { applicationId } = pendingDisbursement
    const amount = parseFloat(disbursedAmount)

    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    try {
      const { error } = await supabase
        .from('applications')
        .update({
          stage: 'Disbursed',
          disbursed_amount: amount,
          disbursed_date: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) throw error

      toast.success('Application disbursed successfully')
      fetchApplications()
      setIsDisbursementDialogOpen(false)
      setPendingDisbursement(null)
      setDisbursedAmount('')
    } catch (error) {
      console.error('Error disbursing application:', error)
      toast.error('Failed to disburse application')
    }
  }

  const filteredApplications = applications.filter(app => {
    const matchesSearch = app.lead?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         app.lead?.mobile_no?.includes(searchTerm)
    const matchesStage = statusFilter === 'all' || app.stage === statusFilter
    return matchesSearch && matchesStage
  })

  const groupedApplications = Object.keys(statusColumns).reduce((acc, stage) => {
    acc[stage] = filteredApplications.filter(app => app.stage === stage)
    return acc
  }, {} as Record<string, Application[]>)

  // Calculate total amounts for each stage
  const stageTotals = Object.keys(statusColumns).reduce((acc, stage) => {
    const apps = groupedApplications[stage] || []
    if (stage === 'Disbursed') {
      // For disbursed stage, sum up disbursed amounts
      acc[stage] = apps.reduce((sum, app) => sum + (app.disbursed_amount || 0), 0)
    } else {
      // For other stages, sum up loan amounts
      acc[stage] = apps.reduce((sum, app) => sum + (app.loan_amount || 0), 0)
    }
    return acc
  }, {} as Record<string, number>)

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
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter}
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 min-w-full pb-4" style={{ minWidth: 'max-content' }}>
            {Object.entries(statusColumns).map(([stage, title]) => (
              <div key={stage} className="flex-1 min-w-80">
                <DroppableColumn
                  id={`stage-${stage}`}
                  title={title}
                  count={groupedApplications[stage]?.length || 0}
                  totalAmount={stageTotals[stage] || 0}
                >
                  <SortableContext
                    items={groupedApplications[stage]?.map(app => `app-${app.id}`) || []}
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
                  <Input 
                    value={selectedApplication.lead?.name || ''} 
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      lead: {
                        ...selectedApplication.lead,
                        name: e.target.value
                      }
                    })}
                  />
                </div>
                <div>
                  <Label>Mobile</Label>
                  <Input value={selectedApplication.lead?.mobile_no || ''} disabled />
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
                    defaultValue={selectedApplication.interest_rate || ''}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      interest_rate: Number(e.target.value) || undefined
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="tenure_months">Tenure (Months)</Label>
                  <Input
                    id="tenure_months"
                    type="number"
                    defaultValue={selectedApplication.tenure_months || ''}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      tenure_months: Number(e.target.value) || undefined
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
                    defaultValue={selectedApplication.monthly_emi || ''}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      monthly_emi: Number(e.target.value) || undefined
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="disbursed_amount">Disbursed Amount</Label>
                  <Input
                    id="disbursed_amount"
                    type="number"
                    defaultValue={selectedApplication.disbursed_amount || ''}
                    onChange={(e) => setSelectedApplication({
                      ...selectedApplication,
                      disbursed_amount: Number(e.target.value) || undefined
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
                    defaultValue={selectedApplication.disbursed_date?.split('T')[0] || ''}
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

      {/* Disbursement Dialog */}
      <Dialog open={isDisbursementDialogOpen} onOpenChange={setIsDisbursementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disburse Application</DialogTitle>
            <DialogDescription>
              Enter the disbursed amount for {pendingDisbursement?.application.lead?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Loan Amount</Label>
              <Input
                value={`₹${pendingDisbursement?.application.loan_amount?.toLocaleString()}`}
                disabled
              />
            </div>
            <div>
              <Label htmlFor="disbursed-amount">Disbursed Amount *</Label>
              <Input
                id="disbursed-amount"
                type="number"
                value={disbursedAmount}
                onChange={(e) => setDisbursedAmount(e.target.value)}
                placeholder="Enter disbursed amount"
                min="0"
                step="1000"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDisbursementDialogOpen(false)
                  setPendingDisbursement(null)
                  setDisbursedAmount('')
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleDisbursementConfirm}>
                Confirm Disbursement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
