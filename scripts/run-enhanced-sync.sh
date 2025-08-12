#!/bin/bash

# =====================================================
# Enhanced Attendance Sync Runner
# =====================================================
#
# Usage:
#   ./run-enhanced-sync.sh                    # Full school year sync
#   ./run-enhanced-sync.sh -s 2024-08-15 -e 2024-12-31  # Custom date range
#   ./run-enhanced-sync.sh -S 001             # Specific school
#   ./run-enhanced-sync.sh -r checkpoint-123  # Resume from checkpoint
#   ./run-enhanced-sync.sh -d                 # Dry run
#
# Options:
#   -s START_DATE    Start date (YYYY-MM-DD)
#   -e END_DATE      End date (YYYY-MM-DD)
#   -S SCHOOL_CODE   School code to sync (can be used multiple times)
#   -b BATCH_SIZE    Batch size (default: 500)
#   -c CHUNK_DAYS    Days per chunk (default: 30)
#   -r CHECKPOINT    Resume from checkpoint ID
#   -d               Dry run mode
#   -v               Verbose output
#   -h               Show help
#
# =====================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
FULL_SYNC=true
START_DATE=""
END_DATE=""
SCHOOLS=()
BATCH_SIZE="500"
CHUNK_DAYS="30"
CHECKPOINT=""
DRY_RUN=""
VERBOSE=""
SAVE_CHECKPOINT=""

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s START_DATE    Start date (YYYY-MM-DD)"
    echo "  -e END_DATE      End date (YYYY-MM-DD)"
    echo "  -S SCHOOL_CODE   School code to sync (can be used multiple times)"
    echo "  -b BATCH_SIZE    Batch size (default: 500)"
    echo "  -c CHUNK_DAYS    Days per chunk (default: 30)"
    echo "  -r CHECKPOINT    Resume from checkpoint ID"
    echo "  -d               Dry run mode"
    echo "  -v               Verbose output"
    echo "  -p               Save checkpoint on completion"
    echo "  -h               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                       # Full school year sync"
    echo "  $0 -s 2024-08-15 -e 2024-12-31         # First semester"
    echo "  $0 -S RMS -S RHS                        # Specific schools"
    echo "  $0 -r checkpoint-1234567890             # Resume from checkpoint"
    exit 1
}

# Parse command line arguments
while getopts "s:e:S:b:c:r:dvph" opt; do
    case $opt in
        s)
            START_DATE="$OPTARG"
            FULL_SYNC=false
            ;;
        e)
            END_DATE="$OPTARG"
            FULL_SYNC=false
            ;;
        S)
            SCHOOLS+=("$OPTARG")
            ;;
        b)
            BATCH_SIZE="$OPTARG"
            ;;
        c)
            CHUNK_DAYS="$OPTARG"
            ;;
        r)
            CHECKPOINT="$OPTARG"
            FULL_SYNC=false
            ;;
        d)
            DRY_RUN="--dry-run"
            ;;
        v)
            VERBOSE="--verbose"
            ;;
        p)
            SAVE_CHECKPOINT="--save-checkpoint"
            ;;
        h)
            show_usage
            ;;
        \?)
            echo -e "${RED}Invalid option: -$OPTARG${NC}" >&2
            show_usage
            ;;
    esac
done

# Validate date range if provided
if [ -n "$START_DATE" ] && [ -z "$END_DATE" ]; then
    echo -e "${RED}Error: End date (-e) is required when start date (-s) is specified${NC}"
    exit 1
fi

if [ -z "$START_DATE" ] && [ -n "$END_DATE" ]; then
    echo -e "${RED}Error: Start date (-s) is required when end date (-e) is specified${NC}"
    exit 1
fi

# Change to project directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../ap-tool-v1"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    pnpm install
fi

# Build TypeScript if needed
if [ ! -d "dist" ] || [ "src/scripts/run-attendance-sync.ts" -nt "dist/scripts/run-attendance-sync.js" ]; then
    echo -e "${YELLOW}Building TypeScript files...${NC}"
    pnpm build
fi

# Load environment variables
if [ -f ".env.local" ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo -e "${RED}Error: .env.local file not found${NC}"
    echo "Please create .env.local with your configuration"
    exit 1
fi

# Verify required environment variables
required_vars=(
    "AERIES_API_BASE_URL"
    "AERIES_API_KEY"
    "NEXT_PUBLIC_SUPABASE_URL"
    "SUPABASE_SERVICE_ROLE_KEY"
)

missing_vars=()
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
    echo -e "${RED}Error: Missing required environment variables:${NC}"
    printf '%s\n' "${missing_vars[@]}"
    exit 1
fi

# Build command
CMD="node dist/scripts/run-attendance-sync.js"

# Add options
if [ -n "$CHECKPOINT" ]; then
    CMD="$CMD --resume $CHECKPOINT"
elif [ "$FULL_SYNC" = true ]; then
    CMD="$CMD --full"
else
    CMD="$CMD --start $START_DATE --end $END_DATE"
fi

# Add school codes
for school in "${SCHOOLS[@]}"; do
    CMD="$CMD --school $school"
done

# Add other options
CMD="$CMD --batch-size $BATCH_SIZE --chunk-days $CHUNK_DAYS"

if [ -n "$DRY_RUN" ]; then
    CMD="$CMD $DRY_RUN"
fi

if [ -n "$VERBOSE" ]; then
    CMD="$CMD $VERBOSE"
fi

if [ -n "$SAVE_CHECKPOINT" ]; then
    CMD="$CMD $SAVE_CHECKPOINT"
fi

# Display sync configuration
echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}AP Tool V1 - Enhanced Attendance Sync${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

if [ -n "$CHECKPOINT" ]; then
    echo -e "Mode: ${GREEN}Resume from checkpoint${NC}"
    echo -e "Checkpoint: ${CHECKPOINT}"
elif [ "$FULL_SYNC" = true ]; then
    echo -e "Mode: ${GREEN}Full school year sync${NC}"
    echo -e "Date Range: 2024-08-15 to 2025-06-12"
else
    echo -e "Mode: ${GREEN}Custom date range${NC}"
    echo -e "Date Range: ${START_DATE} to ${END_DATE}"
fi

if [ ${#SCHOOLS[@]} -gt 0 ]; then
    echo -e "Schools: ${SCHOOLS[*]}"
else
    echo -e "Schools: All active schools"
fi

echo -e "Batch Size: ${BATCH_SIZE}"
echo -e "Chunk Days: ${CHUNK_DAYS}"

if [ -n "$DRY_RUN" ]; then
    echo -e "Mode: ${YELLOW}DRY RUN (no data will be saved)${NC}"
fi

echo ""
echo -e "${BLUE}==========================================${NC}"
echo ""

# Confirm before proceeding (unless in non-interactive mode)
if [ -t 0 ] && [ -z "$CI" ]; then
    read -p "Continue with sync? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Sync cancelled by user${NC}"
        exit 0
    fi
fi

# Execute the sync
echo ""
echo -e "${GREEN}Starting sync...${NC}"
echo ""

# Create log directory
LOG_DIR="$SCRIPT_DIR/../logs"
mkdir -p "$LOG_DIR"

# Generate log filename
LOG_FILE="$LOG_DIR/attendance-sync-$(date +%Y%m%d-%H%M%S).log"

# Run the command with logging
if [ -n "$VERBOSE" ]; then
    # In verbose mode, show output and log
    $CMD 2>&1 | tee "$LOG_FILE"
else
    # In normal mode, show output but also log
    $CMD 2>&1 | tee "$LOG_FILE"
fi

# Check exit status
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Sync completed successfully!${NC}"
    echo -e "Log file: ${LOG_FILE}"
else
    echo ""
    echo -e "${RED}✗ Sync failed!${NC}"
    echo -e "Check log file for details: ${LOG_FILE}"
    exit 1
fi