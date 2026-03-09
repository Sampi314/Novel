#!/bin/bash
# Blocks accidental edits to sensitive files
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED=("package-lock.json" ".env" ".git/" "node_modules/")

for pattern in "${PROTECTED[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: Cannot edit $FILE_PATH (protected file)" >&2
    exit 2
  fi
done

exit 0
