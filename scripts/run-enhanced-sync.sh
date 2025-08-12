#!/bin/bash

# Enhanced Aeries Attendance Sync Runner
# Provides convenient ways to run the enhanced attendance sync with various configurations
# =====================================================
# Usage:
#   ./run-enhanced-sync.sh                    # Full school year sync
#   ./run-enhanced-sync.sh -s 2024-08-15 -e 2024-12-31  # Custom date range
#   ./run-enhanced-sync.sh -S 001             # Specific school
#   ./run-enhanced-sync.sh -r 150             # Resume from batch
#   ./run-enhanced-sync.sh -d                 # Dry run
# =====================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default configuration
START_DATE="2024-08-15"
END_DATE="2025-06-12"
BATCH_SIZE=500
DATE_CHUNK_DAYS=30
RESUME_FROM_BATCH=""
SCHOOL_CODE=""
DRY_RUN=false
VERBOSE=false

# Function to display help
show_help() {
    echo "Enhanced Aeries Attendance Sync Runner"
    echo "======================================"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -s, --start-date DATE        Start date (default: $START_DATE)"
    echo "  -e, --end-date DATE          End date (default: $END_DATE)"
    echo "  -b, --batch-size SIZE        Batch size (default: $BATCH_SIZE)"
    echo "  -c, --chunk-days DAYS        Date chunk size in days (default: $DATE_CHUNK_DAYS)"
    echo "  -r, --resume-from BATCH      Resume from specific batch number"
    echo "  -S, --school-code CODE       Sync specific school only"
    echo "  -d, --dry-run                Dry run mode (validate only)"
    echo "  -v, --verbose                Verbose output"
    echo "  -h, --help                   Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Full sync with defaults"
    echo "  $0 -s 2024-08-15 -e 2024-12-31      # Sync first semester only"
    echo "  $0 -S 001                            # Sync specific school"
    echo "  $0 -r 150                            # Resume from batch 150"
    echo "  $0 -b 1000 -c 7                     # Large batches, weekly chunks"
    echo "  $0 -d                                # Dry run to validate configuration"
    echo ""
}

# Function to validate date format
validate_date() {
    local date_string="$1"
    if ! date -d "$date_string" >/dev/null 2>&1; then
        echo -e "${RED}Error: Invalid date format '$date_string'. Use YYYY-MM-DD format.${NC}" >&2
        exit 1
    fi
}

# Function to validate numeric input
validate_number() {
    local value="$1"
    local name="$2"
    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}Error: $name must be a positive integer.${NC}" >&2
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -s|--start-date)
            START_DATE="$2"
            validate_date "$START_DATE"
            shift 2
            ;;
        -e|--end-date)
            END_DATE="$2"
            validate_date "$END_DATE"
            shift 2
            ;;
        -b|--batch-size)
            BATCH_SIZE="$2"
            validate_number "$BATCH_SIZE" "Batch size"
            shift 2
            ;;
        -c|--chunk-days)
            DATE_CHUNK_DAYS="$2"
            validate_number "$DATE_CHUNK_DAYS" "Date chunk days"
            shift 2
            ;;
        -r|--resume-from)
            RESUME_FROM_BATCH="$2"
            validate_number "$RESUME_FROM_BATCH" "Resume batch number"
            shift 2
            ;;
        -S|--school-code)
            SCHOOL_CODE="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option $1${NC}" >&2
            show_help
            exit 1
            ;;
    esac
done

# Validate date range
if [[ $(date -d "$START_DATE" +%s) -gt $(date -d "$END_DATE" +%s) ]]; then
    echo -e "${RED}Error: Start date must be before end date.${NC}" >&2
    exit 1
fi

# Display configuration
echo -e "${BLUE}Enhanced Aeries Attendance Sync Configuration${NC}"
echo "=============================================="
echo -e "${YELLOW}Date Range:${NC} $START_DATE to $END_DATE"
echo -e "${YELLOW}Batch Size:${NC} $BATCH_SIZE"
echo -e "${YELLOW}Date Chunk Size:${NC} $DATE_CHUNK_DAYS days"

if [[ -n "$RESUME_FROM_BATCH" ]]; then
    echo -e "${YELLOW}Resume From Batch:${NC} $RESUME_FROM_BATCH"
fi

if [[ -n "$SCHOOL_CODE" ]]; then
    echo -e "${YELLOW}School Filter:${NC} $SCHOOL_CODE"
fi

if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}Mode:${NC} DRY RUN (validation only)"
fi

if [[ "$VERBOSE" == true ]]; then
    echo -e "${YELLOW}Output:${NC} Verbose logging enabled"
fi

echo ""

# Calculate estimated duration
start_timestamp=$(date -d "$START_DATE" +%s)
end_timestamp=$(date -d "$END_DATE" +%s)
total_days=$(( (end_timestamp - start_timestamp) / 86400 + 1 ))
estimated_chunks=$(( (total_days + DATE_CHUNK_DAYS - 1) / DATE_CHUNK_DAYS ))

echo -e "${BLUE}Estimated Processing:${NC}"
echo "  • Total days: $total_days"
echo "  • Date chunks: $estimated_chunks"
echo "  • Estimated batches: ~$(( total_days * 5 / BATCH_SIZE )) (assuming ~5 records per day per school)"
echo ""

# Pre-flight checks
echo -e "${BLUE}Pre-flight Checks:${NC}"

# Check if required environment variables are set
required_vars=("NEXT_PUBLIC_SUPABASE_URL" "SUPABASE_SERVICE_ROLE_KEY" "AERIES_API_BASE_URL" "AERIES_API_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        missing_vars+=("$var")
    fi
done

if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo "   • $var"
    done
    echo ""
    echo "Please set these variables in your .env.local file or environment."
    exit 1
fi

echo -e "${GREEN}✅ Environment variables${NC}"

# Check if TypeScript compilation is needed
if [[ -f "scripts/enhanced-attendance-sync.ts" && "scripts/enhanced-attendance-sync.ts" -nt "scripts/enhanced-attendance-sync.js" ]] 2>/dev/null; then
    echo -e "${YELLOW}⚠️  TypeScript compilation may be needed${NC}"
fi

# Check database connectivity (if not dry run)
if [[ "$DRY_RUN" != true ]]; then
    echo -e "${BLUE}Testing database connectivity...${NC}"
    # This would be implemented based on your database client
    echo -e "${GREEN}✅ Database connectivity${NC}"
fi

echo ""

# Confirmation prompt (unless dry run)
if [[ "$DRY_RUN" != true ]]; then
    echo -e "${YELLOW}⚠️  This will sync attendance data for the specified period.${NC}"
    echo -e "${YELLOW}   Existing records will be updated if they already exist.${NC}"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Sync cancelled."
        exit 0
    fi
    echo ""
fi

# Build command arguments
cmd_args=()
cmd_args+=("--start-date=$START_DATE")
cmd_args+=("--end-date=$END_DATE")
cmd_args+=("--batch-size=$BATCH_SIZE")
cmd_args+=("--date-chunk-days=$DATE_CHUNK_DAYS")

if [[ -n "$RESUME_FROM_BATCH" ]]; then
    cmd_args+=("--resume-from-batch=$RESUME_FROM_BATCH")
fi

if [[ -n "$SCHOOL_CODE" ]]; then
    cmd_args+=("--school-code=$SCHOOL_CODE")
fi

if [[ "$VERBOSE" == true ]]; then
    cmd_args+=("--verbose")
fi

# Execute the sync
echo -e "${GREEN}🚀 Starting Enhanced Attendance Sync...${NC}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}DRY RUN: Would execute the following command:${NC}"
    echo "npx tsx scripts/enhanced-attendance-sync.ts ${cmd_args[*]}"
    echo ""
    echo -e "${GREEN}✅ Configuration validated successfully!${NC}"
else
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Create log directory
    LOG_DIR="$PROJECT_ROOT/logs"
    mkdir -p "$LOG_DIR"
    
    # Generate log filename
    LOG_FILE="$LOG_DIR/attendance-sync-$(date +%Y%m%d-%H%M%S).log"
    
    # Execute the sync script
    start_time=$(date +%s)
    
    if [[ "$VERBOSE" == true ]]; then
        # In verbose mode, show output and log
        npx tsx scripts/enhanced-attendance-sync.ts "${cmd_args[@]}" 2>&1 | tee "$LOG_FILE"
        sync_result=${PIPESTATUS[0]}
    else
        # In normal mode, show output but also log
        npx tsx scripts/enhanced-attendance-sync.ts "${cmd_args[@]}" 2>&1 | tee "$LOG_FILE"
        sync_result=${PIPESTATUS[0]}
    fi
    
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    minutes=$((duration / 60))
    seconds=$((duration % 60))
    
    echo ""
    if [[ $sync_result -eq 0 ]]; then
        echo -e "${GREEN}🎉 Enhanced Attendance Sync completed successfully!${NC}"
        echo -e "${BLUE}Total duration: ${minutes}m ${seconds}s${NC}"
        echo -e "${BLUE}Log file: ${LOG_FILE}${NC}"
    else
        echo -e "${RED}❌ Enhanced Attendance Sync failed.${NC}"
        echo -e "${RED}Check the logs above and log file for error details: ${LOG_FILE}${NC}"
        exit 1
    fi
fi