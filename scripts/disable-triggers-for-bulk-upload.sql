-- =====================================================
-- DISABLE TRIGGERS FOR BULK UPLOAD
-- =====================================================
-- 
-- This script disables triggers during bulk upload for performance
-- Run this BEFORE the optimized upload script
--
-- Date: 2025-07-30
-- =====================================================

-- 1. Show current triggers
DO $$
DECLARE
  trigger_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 CURRENT TRIGGERS BEFORE DISABLE:';
  RAISE NOTICE '=====================================';
  
  FOR trigger_record IN 
    SELECT trigger_name, event_manipulation, action_timing
    FROM information_schema.triggers 
    WHERE event_object_table = 'iready_diagnostic_results'
  LOOP
    RAISE NOTICE '   • %: % %', trigger_record.trigger_name, trigger_record.action_timing, trigger_record.event_manipulation;
  END LOOP;
  RAISE NOTICE '';
END $$;

-- 2. Disable the summary update trigger
DROP TRIGGER IF EXISTS update_iready_summary_trigger ON iready_diagnostic_results;

-- 3. Verify triggers are disabled
DO $$
DECLARE
  trigger_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers 
  WHERE event_object_table = 'iready_diagnostic_results';
  
  RAISE NOTICE '';
  RAISE NOTICE '🚫 TRIGGERS DISABLED FOR BULK UPLOAD';
  RAISE NOTICE '=====================================';
  RAISE NOTICE '📊 Active triggers on iready_diagnostic_results: %', trigger_count;
  RAISE NOTICE '';
  
  IF trigger_count = 0 THEN
    RAISE NOTICE '✅ All triggers successfully disabled';
    RAISE NOTICE '🚀 Ready for high-performance bulk upload';
  ELSE
    RAISE NOTICE '⚠️  Some triggers may still be active';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '📝 NEXT STEPS:';
  RAISE NOTICE '   1. Run: node optimized-iready-upload.js';
  RAISE NOTICE '   2. Run: generate-summaries-after-upload.sql';
  RAISE NOTICE '   3. Run: re-enable-triggers.sql';
  RAISE NOTICE '';
END $$;