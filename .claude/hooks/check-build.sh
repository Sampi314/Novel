#!/bin/bash
# Runs Vite build check after JSX/JS edits and reports errors
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check on JS/JSX/JSON file edits
if [[ "$FILE_PATH" =~ \.(jsx?|json|css)$ ]]; then
  cd "/Users/sampi_wu/Downloads/Claude Code"
  OUTPUT=$(npx vite build --mode development 2>&1 | grep -E "error|Error|warning" | head -20)
  if [ -n "$OUTPUT" ]; then
    echo "Build issues detected:" >&2
    echo "$OUTPUT" >&2
    # Don't block (exit 0) — just surface the warnings to Claude
  fi
fi

exit 0
