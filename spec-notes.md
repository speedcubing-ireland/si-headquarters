██  ██ ██████ ▄████▄ ████▄  ▄█████▄ ██  ██ ▄████▄ █████▄  ██████ ██████ █████▄  ▄█████ 
██████ ██▄▄   ██▄▄██ ██  ██ ██ ▄ ██ ██  ██ ██▄▄██ ██▄▄██▄   ██   ██▄▄   ██▄▄██▄ ▀▀▀▄▄▄ 
██  ██ ██▄▄▄▄ ██  ██ ████▀  ▀█████▀ ▀████▀ ██  ██ ██   ██   ██   ██▄▄▄▄ ██   ██ █████▀ 
                                 ▀▀                                                    

This is the spec document for a project management suite to be used by Speedcubing Ireland CLG (SI).

At it's core this software is being designed to help streamline the company's operations and help add oversight where needed. We also aim to reduce the amount of things individual people have to keep track of.

As mentioned in the recruitment document, these are some of the things that I think about when looking at the jobs done for SI:
- What tools are used for this job?
- What teams are involved in this job?
- Are there standardised procedures on how to do it (including instructions)?
- Are we overly reliant on one particular person?
- Is this job being done inconsistently/wrong/with poor quality?
- Can we remove the need for this job?
- Can we make this job easier/quicker?
- What are the costs associated with this job (time and money)

Current issues identified with our operations:
- Events at comps not being planned in relation to others (e.g. pyraminx only in 2/5 comps)
- Certificates needing to be prompted to make
- Podium photos not being shared
- Gear list not being updated
- Delays in competition announcement (competitions left very close to finished)
- Knowledge sharing (such as venue bookings, layouts, formats)

===============================================================
FEATURES AND FUNCTIONALITY
===============================================================

Domains of Interest
- Competitions
- Finances?

Integration:
- WCA Account Login (For external organisers/easy login)
- GSuite Authentication (To check groups and roles)
- SI's WCA API Token + Refresh on backend for continued access
- Competition Planning Sheets
- Canva Designs

Feature Areas:
- Competition Planning

Competition Planning:
There should be close integration with google sheets, which is the primary way that we are currently planning competitions. Google sheets will continue to be used for:
- Budgeting
- Scheduling
- Check-in (offline benefits)

Comp Creation
  -> Interactive should create competition spreadsheet, certificate file, and maybe the WCA page
  -> Ability to add any comp the SI WCA has access to
  -> Organisers have access based on them being a listed organiser/manually approved
Tasks
  -> Task assignments and completion tracking, with dependent tasks
     - Customisable steps e.g. To Do, In-Progress, Blocked, Awaiting Review, Approved, Done
  -> Automated / manual task validation and approvals as needed
  -> Competition details tracking (leads, venue bookings, stations, size, etc.)
  -> Waiting list viewer
  -> Pre-comp emails maybe?
  -> Reminders
     - Able to add for individual tasks
     - Automatic recurring/timed (e.g. 2 weeks before reg open etc.)
     - Escalation based on deadlines (e.g. 1 week overdue email team lead then directors)
     - Integrated based on external events (e.g.. If pre-comp email not sent out by x)
     - Settings regarding channel, frequency (i.e. individual/grouped)
     - Maybe include in google calendar along with comps?
  -> Comp specific
     - Assign tasks to people/teams, and team members can claim
     - Details
Completion
  -> Show competitions until someone has validated that all needed tasks are done
  -> Backups possibly via PDFs should be made and inserted into relevent competition folder
Venue bookings
  -> Submission of venue invoices, marking as unpaid/deposit/paid with the relative amounts
Sponsors
  -> Linked portal for sponsor bidding
  -> Manage the frequent sponsor page (inc. providing login tokens + their resetting)
  -> Support for multiple auction frameworks (first/second price sealed bid and ebay style)
  -> Automated notification, completion, and invoice emails
  -> Maybe auto update/validate competition pages
Check In
  -> One click should populate the check-in sheet based on admin WCIF data (i.e. with DOB)
Scheduling
  -> One click should transfer the schedule to the competition page (and validate this)
  -> Easy selection of event comparison comps (with presets)
  -> Notification thresholds when schedule not matching actual registration numbers
  -> Unified cutoff management (i.e default + overrides or custom for the comp)
  -> Registration trends and forecasting
Teams and Overviews
  -> Team specific dashboards (can mark team specific tasks)
  -> See all competitions, registration status, events (from WCA/planning sheet)
  -> Populate main competition overview sheet
  -> Prompt relevent refunds for competitions (inc. waiting list and others)
  -> Ability to Integrate any specific workflow a team uses (such as a place to list instructions for doing things in a step by step manor)?
  -> Workload tracking (i.e. see who has what tasks, how long left etc.)
  -> Limiting pages or actions to specific teams/roles (including role hierarchy director > team lead > volunteer with ability to give specific people specific permissions)
Audit and Logging
  -> Logging actions, reminders and approvals

===============================================================
IMPLEMENTATION DETAILS
===============================================================
Tech Stack

Frontend:
- React via Next.js
- WCA/Google OAuth
- User token login (for external organisers or sponsors)

Backend:
- Next.js
- Google API Service Account?
- Turso SQLite Database
- Google Drive file storage
- Google Sheets Sync
- WCA API + Internal APIs

General:
- Typescript
- Biome

Unsure
- Bun/Node?
- Task/schedule job handler ? Queue
- Maybe a library for role management?
- UI Library - Shadcn? Aria? Chakra? Mantine?
- Tailwind? Depends on^
- PDF Generator (Backups, invoices) - Likely two solutions, one working with markdown
- Email sending
- Reminders - Maybe email, push, or discord?
- Testing
  - Maybe an E2E test for any WCA dependent integrations? likely issues will be found

===============================================================
[SOME ADDITIONAL NOTES]
===============================================================

So this is to flesh out what things are and how they will work.
What is the process of having a competition:

Venue and Dates

These either are suggested and are deemed workable, or are specifically sought out
Sometimes we look at the calendar and see what gaps there are
Sometimes we plan a load of competitions in rough areas
Some competitions are planned far in advance due to external restrictons (like university holidays)

IMPLICATIONS FOR PLANNING COMPETITIONS AND THIS SOFTWARE:

I presume this is a task that requires some level of multi-person input. It is likely best done in a planning meeting
The tools required to do this are a calendar with the weekends, and a way to mark weekends as potential candidates for comps or a way to mark specific comps as candidates for weekends.
This needs to factor in external events - bank holidays, internatonal comps, exams



Budget

Most of the time this is very basic - done with the venue cost and number of expected competitors
We have unknown costs, such as expenses - but these likely could be determined somewhat, or accurate averages used
We must be comfortable having competitions down the country making less money as otherwise we would never leave dublin...

IMPLICATIONS FOR PLANNING COMPETITIONS AND THIS SOFTWARE:

I presume we can use better estimates for profit/loss based on the venue cost, competitors, and average unknown costs
  These estimates should be data driven - e.g. looking at similar competitions and seeing how well they are regging etc.
We could have a system where if a competition is below the threshold then it needs approval?
^ Perhaps this should be done ona multi-comp basis, where if we have a number of unannounced low profit they need to be approved?
Though this is complex, given how we sometimes need to pay for deposits on venues
Also there should be a way to say in advance oh we will loose money on this, but should still be approved etc.
We could also use this as a way to do some estimated cash-flow analysis if we keep track of what budget items have been paid



Pinning Things Down

Venue bookings should be easy to keep together with the comp (same gdrive folder?) likely uploaded in a portal
Costs and payments should be tracked to ensure we know what is to be paid when (deposits etc.)
Furniture requirements should be determined and quotes recieved as part of the budget process, as this can be expensive


Sponsorship

Can start as soon as we know the dates, venue, general format (i.e. normal comp or not) and expected number of competitors
Ideally should be done seperately to allow for better competition between vendors
Online portal likely best for this, and can use a variety of bidding formats depending on the comp (i.e. special for champs)

1st/2nd price sealed bid, ebay style, english auction (the actual auction format, not the UKCA lol)


Should be able to know what comps people are vending at, for the comp page and for the pre-comp email


Scheduling

This should be done based on the format of the comp (i.e. normal, bld, fmc etc.)
Also done based on ensuring we are having a good mixture of events, rounds etc. between all the comps
^Want to ensure we don't leave any competiion very unattractive events wise, especially if its hard to get to
Scheduling time wise is based on the venue and format, but largely flexible and good to have variety



Existing Items on the Competition Checklist:
=== Pre Announcement ===

Schedule made and on WCA
Budget created
Venue confirmation sent to SI
Sponsorship process started

=== Post Announcement ===

Thread created on discord
Social media posts made
Certificates designed and ordered
Volunteers registered

=== Pre Comp ===

Schedule finalised for actual reg
Groups made/lanyards genned
WCA data sheet ready for check in
Waiting list refunded/emailed
Pre-comp email written

=== Post Comp ===

Report and expenses submitted
Podium photos posted

So there are multi-comp planning tasks

Calendar based
Availibility
International comps
What of our comps there are
Regions
What external organisers are doing what

Individual competition planning tasks

Venue booking
Budgets
Schedule
Sponsorship

Would require confirmed venue booking
Confirmed comp type schedule / capacity
Confirmed dates



Should have a way to have a passive comp (import from the WCA) or a non-comp event that we can attach tasks to



===============================================================
[ADDITIONAL NOTES]
===============================================================

MVP Description
Competitions = Projects
Users

Teams/Permissions - Via Better Auth Organization


Directors (everything)




Competitions




Social Media




Graphics




Finance
Assigning Leads - Lead Delegate, Competition Lead
Tasks - Can be grouped into phase
Phases:
Pre-Announcement
Post-Announcement
Pre-Competition
Post-Competition
Default tasks:
Pre Announcement [PRE-ANNOUNCEMENT]
Budget Approval
Venue Booking
Sponsorship
Post Announcement [ANNOUNCED - REG CLOSE]
Social Media Promotion
Certificates designed
Pre Comp [REG CLOSED]
Waiting list emailed and refunded
Pre-comp email sent
Check in sheet prepared
Post Comp [AFTER EVENT]
Podium photos
Budget closed out
Project updates - like status posts
Tasks = issues
Assigees (teams or people, or team -> person)
Priority
Status (Backlog, To-Do, In Progress, Blocked, Awaiting Review, Approved, Done)
Label (linked to default tasks)
Due Dates
Sub Tasks!
Title
Description
Comments
Notifications/Subscriptions
Views for types of tasks, status filters etc.
