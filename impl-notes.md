At it's core, this project is about managing tasks.
Tasks can be isolated, or linked to a project/competition.

Tasks: Creation
Viewing
Updating
Approving
Completing
Archiving/Deleting

====== TASK LISTS/PAGES =======

Tasks lists:
  All tasks
  Archived tasks
  My tasks
  Team tasks

=== VIEWS/FILTERING ===

"views" -> a preset of filters that are not shown in the bar
  Will also have associated display settings which are displayed

Task task page will be based on a first 'view'
  Additional views linked to the task page can be created and displayed in the top bar
  Views can also be linked to the sidebar ("Move to sidebar")
    This will unlink them from the task page
  View buttons will have a hover card

Each page has a button in the top left which is the 'home' button
  This button will clear any applied views, and reset view settings and any applied filters

Filtering strategy
- Needs to meet each of the following criteria
[SHARED]        - - Not Archived/top level conditons
[PER_PAGE]      - - Meets page filtering as a whole (which may include some and/or sets)
[SHARED]        - - Meets view filtering as a whole (which may include some and/or sets)
[SHARED]        - - Meets filters in bar as a whole (which has a match mode setting (and/or), may include triage settings etc.)
- We may consider moving some of the filtering to the DB/service level