'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, FileText, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function UploadLeadsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [agents, setAgents] = useState<{id: string, name: string}[]>([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load agents when component mounts
  useEffect(() => {
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const { data: agentsData, error } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'agent')
        .order('name')

      if (error) {
        console.error('Error loading agents:', error)
        toast.error('Failed to load agents')
        return
      }

      setAgents(agentsData || [])
    } catch (error) {
      console.error('Error loading agents:', error)
      toast.error('Failed to load agents')
    } finally {
      setLoadingAgents(false)
    }
  }

  const clearFileSelection = () => {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile)
      } else {
        toast.error('Please upload a CSV file')
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile)
      } else {
        toast.error('Please upload a CSV file')
      }
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file to upload')
      return
    }

    if (!selectedAgent) {
      toast.error('Please select an agent to assign the leads to')
      return
    }

    console.log('Starting upload process for file:', file.name, 'Size:', file.size, 'Type:', file.type)
    setUploading(true)
    try {
      // Read the CSV file with better error handling
      let text: string
      try {
        text = await file.text()
      } catch (fileError) {
        console.error('Error reading file with file.text():', fileError)
        // Fallback to FileReader API
        try {
          text = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = (e) => {
              if (e.target?.result) {
                resolve(e.target.result as string)
              } else {
                reject(new Error('Failed to read file content'))
              }
            }
            reader.onerror = () => reject(new Error('FileReader error'))
            reader.readAsText(file)
          })
        } catch (readerError) {
          console.error('Error reading file with FileReader:', readerError)
          toast.error('Failed to read the selected file. Please try selecting the file again.')
          clearFileSelection()
          return
        }
      }

      if (!text || text.trim().length === 0) {
        toast.error('The selected file appears to be empty.')
        return
      }

      const lines = text.split('\n').filter(line => line.trim().length > 0)
      if (lines.length < 2) {
        toast.error('The CSV file must contain at least a header row and one data row.')
        return
      }

      // Improved CSV parsing function
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = []
        let current = ''
        let inQuotes = false
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i]
          
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        result.push(current.trim())
        return result
      }

      const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim())
      console.log('CSV Headers:', headers)
      console.log('First few lines:', lines.slice(0, 3))
      
      // Validate required headers (only app_no and mobile_no are required)
      const requiredHeaders = ['app_no', 'mobile_no']
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h))

      if (missingHeaders.length > 0) {
        toast.error(`Missing required columns: ${missingHeaders.join(', ')}\nFound columns: ${headers.join(', ')}`)
        return
      }

      // Parse CSV data
      const leads = []
      const validColumns = ['app_no', 'name', 'mobile_no', 'amount'] // Only columns that exist in the database
      const errors: string[] = []

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const values = parseCSVLine(line).map(v => v.replace(/"/g, '').trim())
        const lead: Record<string, string | number | null> = {}

        // Only include columns that exist in the database
        headers.forEach((header, index) => {
          if (validColumns.includes(header) && index < values.length) {
            const value = values[index]
            lead[header] = value && value !== '' ? value : null
          }
        })

        console.log(`Row ${i + 1} parsed lead:`, lead)

        // Validate required fields (only app_no and mobile_no are required)
        if (!lead.app_no || lead.app_no === '') {
          errors.push(`Row ${i + 1}: app_no is required (got: "${lead.app_no}")`)
          continue
        }

        if (!lead.mobile_no || lead.mobile_no === '') {
          errors.push(`Row ${i + 1}: mobile_no is required (got: "${lead.mobile_no}")`)
          continue
        }

        // Validate mobile number (must be exactly 10 digits)
        const mobileStr = String(lead.mobile_no).replace(/\D/g, '') // Remove non-digits
        if (mobileStr.length !== 10) {
          errors.push(`Row ${i + 1}: mobile_no must be exactly 10 digits (got: "${lead.mobile_no}" -> "${mobileStr}")`)
          continue
        }
        lead.mobile_no = mobileStr

        // Validate and convert amount (optional field)
        if (lead.amount && lead.amount !== '') {
          const amount = parseFloat(String(lead.amount).replace(/[^0-9.-]/g, ''))
          if (isNaN(amount) || amount < 40000 || amount > 1500000) {
            errors.push(`Row ${i + 1}: amount must be between ₹40,000 and ₹15,00,000 (got: "${lead.amount}" -> ${amount})`)
            continue
          }
          lead.amount = amount
        } else {
          lead.amount = null // Allow null amounts
        }

        // Name is optional, so no validation needed (can be null or empty)

        // Add default values
        lead.final_status = 'open'
        lead.agent_id = selectedAgent
        lead.created_at = new Date().toISOString()
        lead.uploaded_at = new Date().toISOString()
        lead.updated_at = new Date().toISOString()

        leads.push(lead)
      }

      if (errors.length > 0) {
        console.log('All validation errors:', errors)
        toast.error(`Validation errors found:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`)
        return
      }

      if (leads.length === 0) {
        toast.error('No valid data found in CSV')
        return
      }

      console.log('Final leads to insert:', leads)

      // Check for existing records to avoid duplicates
      const appNos = leads.map(lead => lead.app_no).filter(Boolean)
      const mobileNos = leads.map(lead => lead.mobile_no).filter(Boolean)

      const { data: existingLeads } = await supabase
        .from('leads')
        .select('app_no, mobile_no')
        .or(`app_no.in.(${appNos.join(',')}),mobile_no.in.(${mobileNos.join(',')})`)

      const existingAppNos = new Set(existingLeads?.map(lead => lead.app_no) || [])
      const existingMobileNos = new Set(existingLeads?.map(lead => lead.mobile_no) || [])

      // Filter out duplicates
      const newLeads = leads.filter(lead => {
        const isDuplicateApp = existingAppNos.has(lead.app_no as string)
        const isDuplicateMobile = existingMobileNos.has(lead.mobile_no as string)
        return !isDuplicateApp && !isDuplicateMobile
      })

      const skippedCount = leads.length - newLeads.length

      if (newLeads.length === 0) {
        toast.error('All leads in the CSV already exist in the database (duplicate app_no or mobile_no)')
        return
      }

      // Insert only new leads into database
      const { error } = await supabase
        .from('leads')
        .insert(newLeads)

      if (error) {
        console.error('Error uploading leads:', error)
        if (error.code === '23514') {
          toast.error('Data validation failed. Please check mobile numbers and amounts.')
        } else {
          toast.error(`Failed to upload leads: ${error.message}`)
        }
      } else {
        let message = `Successfully uploaded ${newLeads.length} leads and assigned to ${agents.find(a => a.id === selectedAgent)?.name}`
        if (skippedCount > 0) {
          message += `. Skipped ${skippedCount} duplicate records.`
        }
        toast.success(message)
        clearFileSelection()
      }
    } catch (error) {
      console.error('Error processing file:', error)
      toast.error('Error processing file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload Leads</h1>
        <p className="text-gray-600">Upload CSV files to import new leads into the system</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>CSV File Upload</CardTitle>
            <CardDescription>
              Upload a CSV file containing lead information. Required columns: app_no, name, mobile_no, amount
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Agent Selection */}
            <div className="space-y-2">
              <Label htmlFor="agent-select">Assign leads to agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger id="agent-select">
                  <SelectValue placeholder={loadingAgents ? "Loading agents..." : "Select an agent"} />
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

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="mt-4">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <span className="text-lg font-medium text-gray-900">
                    Drop your CSV file here, or{' '}
                    <span className="text-blue-600 hover:text-blue-500">browse</span>
                  </span>
                </Label>
                <Input
                  ref={fileInputRef}
                  id="file-upload"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">CSV files only</p>
            </div>

            {file && (
              <div className="flex items-center space-x-2 p-3 bg-gray-50 rounded-lg">
                <FileText className="h-5 w-5 text-gray-500" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-sm text-gray-500">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}

            <Button 
              onClick={handleUpload} 
              disabled={!file || uploading || !selectedAgent || loadingAgents}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Leads'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CSV Format</CardTitle>
            <CardDescription>
              Your CSV file should have the following format:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 rounded-lg p-4">
              <pre className="text-sm text-gray-700">
{`app_no,name,mobile_no,amount
APP001,John Doe,9876543210,100000
APP002,Jane Smith,9876543211,200000`}
              </pre>
            </div>
            <div className="mt-4 space-y-2">
              <h4 className="font-medium text-gray-900">Required Columns:</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code className="bg-gray-100 px-1 rounded">app_no</code> - Application number (unique identifier)</li>
                <li><code className="bg-gray-100 px-1 rounded">name</code> - Full name of the lead</li>
                <li><code className="bg-gray-100 px-1 rounded">mobile_no</code> - 10-digit mobile number</li>
                <li><code className="bg-gray-100 px-1 rounded">amount</code> - Loan amount requested</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
