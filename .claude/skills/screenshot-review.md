# Screenshot Review Skill

Take a screenshot of the running map application and analyze its visual state.

## Steps

1. Get browser tab context using `tabs_context_mcp`
2. Navigate to `http://localhost:5173` (create a new tab if needed)
3. Wait for the page to load
4. Take a screenshot using `mcp__claude-in-chrome__computer` with action `screenshot`
5. Analyze the screenshot for:
   - Visual bugs (overlapping elements, cut-off text, misalignment)
   - Readability issues (too small text, poor contrast)
   - Layout problems (overcrowded areas, wasted space)
   - Missing visual elements that should be visible
   - Color harmony and aesthetic quality
6. Report findings with specific, actionable suggestions

## What to Look For

- **Map terrain**: Is the satellite-realistic style rendering correctly?
- **Labels**: Are location names readable at the current zoom?
- **UI panels**: Are overlays (legend, controls, timeline) properly positioned and styled?
- **Icons**: Are faction/location/fauna icons clear and well-sized?
- **Trade routes**: Are paths visible but not overwhelming?
- **Night mode**: If active, does the dark theme look good?
- **Overall impression**: Does it feel like a polished fantasy map?

## Output

Provide a brief visual assessment:
- 3-5 specific observations (good and bad)
- Priority-ranked suggestions for improvement
- Note any bugs or rendering issues

$ARGUMENTS
