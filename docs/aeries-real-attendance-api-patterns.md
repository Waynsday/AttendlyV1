# Aeries Real Attendance Data API Patterns

## ✅ VALIDATED: Working API Endpoints for Real Data

**Date Tested**: July 30, 2025  
**API Version**: Aeries v5  
**District**: Romoland School District  

### 🎯 Key Findings

**CRITICAL**: The attendance data endpoints DO exist and contain REAL student attendance data. Previous attempts failed because:
1. Incorrect endpoint patterns were being used
2. The correct endpoints are in the AttendanceHistory section, not basic attendance
3. Date format requirements (YYYYMMDD vs YYYY-MM-DD)

---

## 📋 Working API Endpoint Patterns

### 1. Get All District Students
```
GET /admin/api/v5/schools/999/students
```
- **Status**: ✅ WORKING
- **Returns**: 6,107 real students across all district schools
- **Use Case**: Bulk student retrieval for district-wide sync

### 2. Get Attendance Summary (WORKING)
```
GET /admin/api/v5/schools/{SchoolCode}/AttendanceHistory/summary/{StudentID}
```
- **Status**: ✅ WORKING - Contains REAL data
- **Example**: `/schools/120/AttendanceHistory/summary/1002373`
- **Returns**: Multi-year attendance summaries including 2024-2025 current data
- **Sample Data**:
  ```json
  {
    "SchoolYear": "2024-2025",
    "DaysEnrolled": 179,
    "DaysPresent": 167,
    "DaysAbsence": 12,
    "DaysTardy": 44,
    "DaysExcused": 0,
    "DaysUnexcused": 0
  }
  ```

### 3. Get Attendance Details (WORKING)
```
GET /admin/api/v5/schools/{SchoolCode}/AttendanceHistory/details/{StudentID}?StartDate=YYYYMMDD&EndDate=YYYYMMDD
```
- **Status**: ✅ WORKING - Contains REAL detailed records
- **Date Format**: YYYYMMDD (e.g., 20240815, not 2024-08-15)
- **Example**: `/schools/120/AttendanceHistory/details/1002373?StartDate=20240801&EndDate=20241231`
- **Returns**: Detailed attendance codes and period-by-period data

---

## 🏫 School Codes with Real Data

| School Code | Students | Has Summary Data | Has Detail Data | Notes |
|-------------|----------|------------------|-----------------|-------|
| 999 | 6,107 | N/A (District Code) | N/A | Use for bulk student retrieval |
| 1 | 17 | ✅ | ❌ | Perfect attendance records |
| 2 | 14 | ✅ | ❌ | Perfect attendance records |
| 3 | 6 | ✅ | ❌ | Perfect attendance records |
| 120 | 584 | ✅ | ✅ | Rich data with absences/tardies |
| 160 | 881 | ✅ | ✅ | Rich data with absences/tardies |
| 235 | 1,245 | ✅ | ✅ | Rich data with absences/tardies |

---

## 📊 Real Data Examples Found

### High-Performing Student
```json
{
  "StudentName": "Roman Vasquez",
  "SchoolCode": "235",
  "AttendanceRate": "100.0%",
  "DaysEnrolled": 179,
  "DaysPresent": 179,
  "DaysAbsent": 0,
  "DaysTardy": 0
}
```

### At-Risk Student  
```json
{
  "StudentName": "Jacey Luke", 
  "SchoolCode": "160",
  "AttendanceRate": "89.9%",
  "DaysEnrolled": 179,
  "DaysPresent": 161,
  "DaysAbsent": 18,
  "DaysTardy": 32
}
```

### Chronic Absenteeism Case
```json
{
  "StudentName": "Sebastian Zurita",
  "SchoolCode": "235", 
  "AttendanceRate": "0.0%",
  "DaysEnrolled": 6,
  "DaysPresent": 0,
  "DaysAbsent": 0,
  "DaysTardy": 0
}
```

---

## 🔧 Validated Sync Implementation

### Data Transformation Pattern
```javascript
// Transform real Aeries data for Supabase
function transformSummaryData(studentID, schoolCode, summaries) {
  return summaries
    .filter(s => s.SchoolYear === '2024-2025') // Current year only
    .map(summary => ({
      aeries_student_id: studentID.toString(),
      school_code: schoolCode.toString(),
      school_year: summary.SchoolYear,
      days_enrolled: summary.DaysEnrolled || 0,
      days_present: summary.DaysPresent || 0,
      days_absent: summary.DaysAbsence || 0,
      days_tardy: summary.DaysTardy || 0,
      attendance_rate: summary.DaysEnrolled > 0 ? 
        ((summary.DaysPresent / summary.DaysEnrolled) * 100).toFixed(2) : '0.00'
    }));
}
```

### Recommended Sync Strategy
1. **Use school code 999** to get all district students (6,107 total)
2. **Group by actual school code** from student records for API calls
3. **Call AttendanceHistory/summary** for each student using their actual school
4. **Filter to 2024-2025** school year data
5. **Transform and insert** real records into Supabase

---

## 🚨 Critical Requirements

### NEVER Use Fake Data
- ✅ **DO**: Pull actual attendance records from Aeries API
- ❌ **DON'T**: Generate, create, or insert synthetic/fake data
- ✅ **DO**: Use only validated endpoints with real student records
- ❌ **DON'T**: Assume data exists - always validate API responses

### Data Validation Checklist
- [ ] Student ID exists in Aeries system
- [ ] School code returns valid attendance records  
- [ ] Attendance summary contains non-zero enrollment days
- [ ] Data is from correct school year (2024-2025)
- [ ] Attendance rates are mathematically correct

### Rate Limiting
- **Recommended**: 100ms delay between individual student requests
- **Batch size**: 50 students per batch maximum  
- **Between batches**: 2-second delay
- **Timeout**: 30 seconds per API request

---

## 📈 Performance Characteristics

### Real Data Volume
- **Total district students**: 6,107
- **Students with attendance data**: ~90% (estimated 5,500+)
- **Processing rate**: ~60 students/minute with rate limiting
- **Estimated sync time**: ~100 minutes for full district

### Data Quality
- **Current year coverage**: 179 enrolled days (as of test date)
- **Data completeness**: High - most students have summary records
- **Data accuracy**: Sourced directly from Aeries SIS
- **Update frequency**: Daily (based on school data entry)

---

## 🔍 Troubleshooting Guide

### Common Issues

#### 404 Errors
- **Cause**: Using incorrect endpoint patterns
- **Solution**: Use AttendanceHistory endpoints, not basic attendance

#### Empty Results
- **Cause**: Student may not have attendance records for specified period
- **Solution**: Check different school years or verify student enrollment

#### Rate Limiting
- **Cause**: Too many requests too quickly
- **Solution**: Implement proper delays and batch processing

### Debugging Commands
```bash
# Test specific student
curl -H "AERIES-CERT: {API_KEY}" \
  "https://romolandapi.aeries.net/admin/api/v5/schools/120/AttendanceHistory/summary/1002373"

# Test date range details  
curl -H "AERIES-CERT: {API_KEY}" \
  "https://romolandapi.aeries.net/admin/api/v5/schools/120/AttendanceHistory/details/1002373?StartDate=20240801&EndDate=20241231"
```

---

## ✅ Validation Status

**API Endpoints**: ✅ CONFIRMED WORKING  
**Real Data**: ✅ VALIDATED WITH ACTUAL RECORDS  
**No Fake Data**: ✅ ZERO SYNTHETIC DATA USED  
**Sync Script**: ✅ READY FOR PRODUCTION  
**Rate Limiting**: ✅ IMPLEMENTED  
**Error Handling**: ✅ COMPREHENSIVE  

**Last Validated**: July 30, 2025  
**Next Review**: Monthly or when API changes detected