#!/bin/bash
# Validates data files after edits — warns on malformed CSV/JSON
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check data files
if [[ "$FILE_PATH" != *"public/data/"* ]]; then
  exit 0
fi

cd "/Users/sampi_wu/Downloads/Claude Code"

if [[ "$FILE_PATH" == *.json ]]; then
  # Validate JSON syntax
  if ! python3 -c "import json; json.load(open('$FILE_PATH'))" 2>/dev/null; then
    echo "DATA VALIDATION ERROR: $FILE_PATH is not valid JSON" >&2
  fi
fi

if [[ "$FILE_PATH" == *.csv ]]; then
  # Check CSV has header + at least 1 data row
  LINE_COUNT=$(wc -l < "$FILE_PATH" | tr -d ' ')
  if [ "$LINE_COUNT" -lt 2 ]; then
    echo "DATA VALIDATION WARNING: $FILE_PATH has only $LINE_COUNT line(s) — expected header + data rows" >&2
  fi

  # Check consistent column count
  HEADER_COLS=$(head -1 "$FILE_PATH" | awk -F',' '{print NF}')
  INCONSISTENT=$(awk -F',' -v expected="$HEADER_COLS" 'NR>1 && NF!=expected && NF>0 {print NR": expected "expected" cols, got "NF}' "$FILE_PATH" | head -5)
  if [ -n "$INCONSISTENT" ]; then
    echo "DATA VALIDATION WARNING: $FILE_PATH has inconsistent column counts:" >&2
    echo "$INCONSISTENT" >&2
  fi
fi

exit 0
