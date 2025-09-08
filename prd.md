1. Overview

“Incred Followup” is a Supabase-backed loan lead management app. It serves Admins (who manage agents, upload CSVs, and oversee dashboards) and Agents (who work their assigned leads and applications). The app has:
	•	Supabase Auth with roles (admin, agent).
	•	Leads module (upload, assign, manage, status, notes).
	•	Applications module (Kanban pipeline).
	•	Admin dashboard (tables only).
	•	Clean, modern frontend (Next.js + Tailwind + shadcn/ui + Framer Motion).

⸻

2. Roles & Permissions

Admin
	•	Login with email + password.
	•	Create new agent users (enter name, email, password).
	•	Upload leads via CSV, assign to an agent.
	•	View/manage all leads and applications.
	•	See dashboards with Open vs Close counts and Disbursal totals.
	•	Reset an agent’s password.

Agent
	•	Login with email + password.
	•	See only their own leads and applications.
	•	Update status and notes inline.
	•	Use their own Kanban for applications.

⸻

3. Authentication
	•	Supabase Auth (email + password).
	•	No signup screen. Only Admin creates users.
	•	profiles table stores role (admin or agent).
	•	Admin-only tool to reset an agent’s password.

⸻

4. Leads Management

CSV Upload (Admin-only)
	•	Upload CSV with exact headers:
app_no, mobile_no, name, amount, status
	•	Rules:
	•	app_no: unique key (deduplication).
	•	If exists → update + reassign to selected agent + set uploaded_at=now.
	•	If new → insert fresh row with selected agent.
	•	If status blank in CSV → leave it blank.
	•	Mobile: must normalize to 10-digit Indian number.
	•	Amount: numeric only, min 40,000; max 1,500,000.
	•	Only one CSV upload at a time.

Leads Table (Agents & Admins)
	•	Columns: agent_name, uploaded_at, app_no, name, mobile_no, amount, status (dropdown), final_status (read-only badge), notes (quick-add + count).
	•	Inline editing:
	•	Status: dropdown (ENUM).
	•	Amount: numeric cell.
	•	Notes: opens inline composer (saves to notes table).
	•	final_status:
	•	Derived from status using rules:
	•	cash salary, self employed, NI, ring more than 3 days, salary low, cibil issue → close
	•	banking received → open, creates/updates Application (UnderReview).
	•	All others → open
	•	Updates automatically when status changes.
	•	Filters: agent_name, uploaded_at (date), amount (range), status.
	•	Search: app_no / mobile_no / name.
	•	Pagination: default 25 rows per page.
	•	Export: Download CSV of filtered table.

⸻

5. Notes
	•	Separate lead_notes table.
	•	Each note = row (note, created_at, author_id).
	•	Max 500 characters.
	•	Timeline view when opening notes (newest first).

⸻

6. Applications (Kanban)

Triggering Applications
	•	If lead status = banking received → create/update Application in stage UnderReview.
	•	Application moves across Kanban: UnderReview → Approved → Reject → Disbursed.
	•	If stage = Reject or Disbursed → linked lead is marked close.
	•	Stage = Disbursed requires disbursed_amount > 0.

Kanban UI
	•	Columns: UnderReview, Approved, Reject, Disbursed.
	•	Cards: show app_no, name, mobile_no, amount, agent name.
	•	Drag & drop between columns.
	•	On drop to Disbursed → modal to enter disbursed amount (mandatory).
	•	Admin can view All Agents or filter by a specific agent.
	•	Agents see only their own Kanban.
	•	Search: app_no / mobile_no / name.
	•	Export: Download CSV of Kanban view.

⸻

7. Admin Dashboard

Tables only (no charts)
	1.	Daily Open vs Close Leads
	•	Columns: Date | Open Leads | Close Leads
	•	Based on uploaded_at.
	•	Default filter: last 30 days.
	2.	Agent-wise Open vs Close Leads
	•	Columns: Agent | Open Leads | Close Leads
	•	Filterable by date range.
	3.	Disbursal Totals (Daily)
	•	Columns: Date | Agent | Total Disbursed
	4.	Disbursal Totals (Monthly)
	•	Columns: Month | Agent | Total Disbursed

	•	All tables have:
	•	Filters (date/agent).
	•	Totals row at bottom.
	•	Export to CSV.
	•	Timezone: Asia/Kolkata, 12-hour clock.

⸻

8. Branding & UI
	•	App name: Incred Followup.
	•	Logo: placeholder until provided.
	•	Theme: light mode, blue accents, subtle gradients.
	•	Micro-animations: hover, row fade-ins, dropdown springs.