'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Filter, Eye, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, useDroppable, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'

interface Application {
  id: string
  lead_id: string
  stage: string
  status: string
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
}

const statusColumns = {
  UnderReview: 'Under Review',
  Approved: 'Approved',
  Reject: 'Rejected',
  Disbursed: 'Disbursed'
} as const

type StageKey = keyof typeof statusColumns

const STAGE_META: Record<StageKey, { icon: string; badgeClass: string; borderClass: string }> = {
  UnderReview: {
    icon: '⏳',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    borderClass: 'border-t-yellow-200'
  },
  Approved: {
    icon: '✅',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    borderClass: 'border-t-green-200'
  },
  Disbursed: {
    icon: '💰',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    borderClass: 'border-t-emerald-200'
  },
  Reject: {
    icon: '❌',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
    borderClass: 'border-t-red-200'
  }
}

const DEFAULT_STAGE_META = {
  icon: '📄',
  badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  borderClass: 'border-t-gray-200'
}

const getStageMeta = (stage: string) => STAGE_META[stage as StageKey] ?? DEFAULT_STAGE_META

const PAGE_SIZE = 100

// Droppable Column Component
function DroppableColumn({ droppableId, stageKey, title, count, totalAmount, children }: {
  droppableId: string
  stageKey: StageKey
  title: string
  count: number
  totalAmount: number
  children: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })
  const meta = getStageMeta(stageKey)

  return (
    <Card 
      ref={setNodeRef}
      className={`h-full border-t-4 transition-all duration-200 ${meta.borderClass} ${
        isOver ? 'bg-blue-50 border-blue-300 shadow-lg scale-[1.02]' : ''
      }`}
    >
      <CardHeader className="pb-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
        <CardTitle className="flex items-center justify-between text-base font-semibold">
          <div className="flex items-center gap-2">
            <span className="text-lg">{meta.icon}</span>
            <span className="text-gray-800">{title}</span>
          </div>
          <Badge
            variant="secondary"
            className={`${meta.badgeClass} font-medium px-2 py-1`}
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
              <div className="text-4xl mb-2">{meta.icon}</div>
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
            👤 {application.agent?.name || 'You'}
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

export default function AgentApplicationsPage() {
  const { profile } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [maxRecords, setMaxRecords] = useState(PAGE_SIZE)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
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

  const fetchApplications = useCallback(
    async (options?: { skipLoader?: boolean }) => {
      if (!profile?.id) return

      try {
        if (!options?.skipLoader) {
          setLoading(true)
        }

        const { data, error, count } = await supabase
          .from('applications')
          .select(
            `*,
            lead:leads!lead_id(name, mobile_no)`,
            { count: 'exact' }
          )
          .eq('agent_id', profile.id)
          .order('created_at', { ascending: false })
          .range(0, Math.max(maxRecords - 1, 0))

        if (error) throw error

        const nextData = data || []
        setApplications(nextData)

        if (typeof count === 'number') {
          setHasMore(count > maxRecords)
        } else {
          setHasMore(nextData.length === maxRecords)
        }
      } catch (error) {
        console.error('Error fetching applications:', error)
        toast.error('Failed to fetch applications')
      } finally {
        if (!options?.skipLoader) {
          setLoading(false)
        }
      }
    },
    [maxRecords, profile?.id]
  )

  useEffect(() => {
    if (!profile?.id) return

    const skipLoader = maxRecords > PAGE_SIZE
    if (skipLoader) {
      setLoadingMore(true)
    }

    fetchApplications({ skipLoader }).finally(() => {
      if (skipLoader) {
        setLoadingMore(false)
      }
    })
  }, [profile?.id, maxRecords, fetchApplications])

  const handleUpdateApplication = async (applicationId: string, updates: Partial<Application>) => {
    try {
      // Only include database fields, exclude nested objects and computed fields
      const dbUpdates = {
        status: updates.status,
        stage: updates.stage,
        loan_amount: updates.loan_amount,
        interest_rate: updates.interest_rate,
        tenure_months: updates.tenure_months,
        monthly_emi: updates.monthly_emi,
        disbursed_amount: updates.disbursed_amount,
        disbursed_date: updates.disbursed_date,
        notes: updates.notes,
        updated_at: new Date().toISOString()
      }

      // Remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(dbUpdates).filter(([, value]) => value !== undefined)
      )

      // Update the applications table
      const { error } = await supabase
        .from('applications')
        .update(cleanUpdates)
        .eq('id', applicationId)

      if (error) throw error

      // Update lead name if it was changed
      if (updates.lead?.name !== undefined) {
        const selectedApp = applications.find(app => String(app.id) === String(applicationId))
        if (selectedApp && selectedApp.lead_id) {
          const { error: leadError } = await supabase
            .from('leads')
            .update({ name: updates.lead.name })
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
    
    // Extract application ID (remove 'app-' prefix)
    const applicationId = activeId.startsWith('app-') ? activeId.replace('app-', '') : activeId
    
    // Check if dropping on a droppable zone (stage) or another application
    if (!overId.startsWith('stage-')) {
      return
    }
    
    // Extract stage name from the droppable zone ID (remove 'stage-' prefix)
    const newStage = overId.replace('stage-', '')

    // Find the application being moved (handle both string and number IDs)
    const application = applications.find(app => String(app.id) === String(applicationId))
    if (!application) return

    // Don't update if it's the same stage
    if (application.stage === newStage) return

    // If moving to Disbursed stage, show disbursement dialog
    if (newStage === 'Disbursed') {
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
          ? { ...app, stage: newStage }
          : app
      )
    )

    try {
      const { error } = await supabase
        .from('applications')
        .update({ stage: newStage })
        .eq('id', applicationId)

      if (error) throw error

      toast.success('Application stage updated successfully')
    } catch (error) {
      console.error('Error updating application stage:', error)
      toast.error('Failed to update application stage')
      // Revert the optimistic update
      fetchApplications()
    }
  }

  const handleLoadMore = () => {
    if (loadingMore) return
    setLoadingMore(true)
    setMaxRecords(prev => prev + PAGE_SIZE)
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

  const normalizedSearch = useMemo(() => searchTerm.trim().toLowerCase(), [searchTerm])

  const filteredApplications = useMemo(() => {
    if (!normalizedSearch && statusFilter === 'all') {
      return applications
    }

    return applications.filter(app => {
      const searchMatch =
        !normalizedSearch ||
        app.lead?.name?.toLowerCase().includes(normalizedSearch) ||
        app.lead?.mobile_no?.includes(searchTerm.trim())

      const stageMatch = statusFilter === 'all' || app.stage === statusFilter

      return searchMatch && stageMatch
    })
  }, [applications, normalizedSearch, searchTerm, statusFilter])

  const groupedApplications = useMemo(() => {
    const grouping: Record<StageKey, Application[]> = {
      UnderReview: [],
      Approved: [],
      Reject: [],
      Disbursed: []
    }

    filteredApplications.forEach(app => {
      const rawStage = (app.stage || 'UnderReview') as string
      const key: StageKey = STAGE_META[rawStage as StageKey] ? (rawStage as StageKey) : 'UnderReview'
      grouping[key].push(app)
    })

    return grouping
  }, [filteredApplications])

  const stageTotals = useMemo(() => {
    return (Object.keys(statusColumns) as StageKey[]).reduce((acc, stage) => {
      const apps = groupedApplications[stage] || []
      const total = apps.reduce((sum, app) => {
        if (stage === 'Disbursed') {
          return sum + (app.disbursed_amount || 0)
        }
        return sum + (app.loan_amount || 0)
      }, 0)

      acc[stage] = total
      return acc
    }, {} as Record<StageKey, number>)
  }, [groupedApplications])

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
          <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
          <p className="text-gray-600 mt-1">Track and manage your assigned loan applications</p>
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
            {(Object.entries(statusColumns) as [StageKey, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Modern Kanban Board */}
      <div className="w-full overflow-x-auto">
        <DndContext 
          sensors={sensors} 
          collisionDetection={closestCenter}
          onDragStart={handleDragStart} 
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-6 min-w-full pb-4" style={{ minWidth: 'max-content' }}>
            {(Object.entries(statusColumns) as [StageKey, string][]).map(([status, title]) => (
              <div key={status} className="flex-1 min-w-80">
                <DroppableColumn
                  droppableId={`stage-${status}`}
                  stageKey={status}
                  title={title}
                  count={groupedApplications[status]?.length || 0}
                  totalAmount={stageTotals[status] || 0}
                >
                  <SortableContext
                    items={groupedApplications[status]?.map(app => `app-${app.id}`) || []}
                    strategy={verticalListSortingStrategy}
                  >
                    {groupedApplications[status]?.map((application) => (
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

      {hasMore && (
        <div className="flex justify-center">
          <Button onClick={handleLoadMore} variant="outline" disabled={loadingMore} className="flex items-center gap-2">
            {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
            {loadingMore ? 'Loading more applications…' : 'Load more applications'}
          </Button>
        </div>
      )}

      {/* Edit Application Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              View and update application information
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
                  <Label>Loan Amount</Label>
                  <Input value={`₹${selectedApplication.loan_amount.toLocaleString()}`} disabled />
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
                      {(Object.entries(statusColumns) as [StageKey, string][]).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedApplication.interest_rate && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Interest Rate</Label>
                    <Input value={`${selectedApplication.interest_rate}%`} disabled />
                  </div>
                  <div>
                    <Label>Tenure</Label>
                    <Input value={`${selectedApplication.tenure_months} months`} disabled />
                  </div>
                </div>
              )}

              {selectedApplication.monthly_emi && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Monthly EMI</Label>
                    <Input value={`₹${selectedApplication.monthly_emi.toLocaleString()}`} disabled />
                  </div>
                  {selectedApplication.disbursed_amount && (
                    <div>
                      <Label>Disbursed Amount</Label>
                      <Input value={`₹${selectedApplication.disbursed_amount.toLocaleString()}`} disabled />
                    </div>
                  )}
                </div>
              )}

              {selectedApplication.disbursed_date && (
                <div>
                  <Label>Disbursed Date</Label>
                  <Input value={new Date(selectedApplication.disbursed_date).toLocaleDateString()} disabled />
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
                  placeholder="Add notes about this application..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Close
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
