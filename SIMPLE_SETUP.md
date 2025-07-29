# 🚀 Ultra-Simple Aeries Setup

## Just 3 Things Needed!

You only need:
1. **District Code:** `romoland`
2. **Base URL:** `https://aeries.romoland.k12.ca.us/api`
3. **Certificate:** One SSL certificate file

## ⚡ 2-Minute Setup

### Step 1: Environment Variables (30 seconds)
```bash
# Create .env.local with just these 3 lines:
echo "AERIES_API_BASE_URL=https://aeries.romoland.k12.ca.us/api" >> .env.local
echo "AERIES_DISTRICT_CODE=romoland" >> .env.local
echo "AERIES_CERTIFICATE_PATH=/certs/aeries-client.crt" >> .env.local
```

### Step 2: Place Certificate (30 seconds)
```bash
# Create certificate directory
sudo mkdir -p /certs && sudo chmod 700 /certs

# Copy your certificate (get from Vince Butler)
cp your-certificate.crt /certs/aeries-client.crt
chmod 600 /certs/aeries-client.crt
```

### Step 3: Test It (30 seconds)
```bash
# Start the app
npm run dev

# Test the connection
curl http://localhost:3000/api/aeries/test
```

## ✅ That's It!

If you see `"connected": true`, you're ready to go!

## 🧪 Quick Tests

### Test Connection
```bash
curl "http://localhost:3000/api/aeries/test?test=connection"
```

### Test Schools
```bash
curl "http://localhost:3000/api/aeries/test?test=schools"
```

### Test Attendance
```bash
curl "http://localhost:3000/api/aeries/test?test=attendance&date=2024-08-15"
```

## 📝 Usage Examples

### Get Attendance for One Day
```typescript
import { getSimpleAeriesClient } from '@/lib/aeries/simple-aeries-client';

const client = await getSimpleAeriesClient();
const attendance = await client.getAttendanceByDateRange('2024-08-15', '2024-08-15');

console.log(`Found ${attendance.data.length} records`);
```

### Process Multiple Days
```typescript
import { processAttendanceWeek } from '@/examples/simple-aeries-usage';

const result = await processAttendanceWeek('2024-08-15', '2024-08-21');
console.log(`Processed ${result.totalProcessed} records`);
```

## 🔧 Optional Settings

You can add these to `.env.local` if needed:

```bash
# Optional - these have smart defaults
AERIES_BATCH_SIZE=100
AERIES_RATE_LIMIT_PER_MINUTE=60
AERIES_SYNC_ENABLED=true
AERIES_ATTENDANCE_START_DATE=2024-08-15
AERIES_ATTENDANCE_END_DATE=2025-06-12
```

## 📞 Get Certificate from Vince Butler

**Email:** vbutler@romoland.k12.ca.us  
**Message:**
```
Hi Vince,

I need the SSL certificate for Aeries API access for the AP attendance 
recovery tool. Can you provide the certificate file?

Base URL: https://aeries.romoland.k12.ca.us/api
District: romoland

Thanks!
```

## 🎯 What You Get

- ✅ **Certificate-only authentication** (no API key needed)
- ✅ **Automatic retry logic**
- ✅ **Rate limiting protection**
- ✅ **Simple batch processing**
- ✅ **Error handling**
- ✅ **Connection health checks**

## 🚨 Common Issues

### "Certificate not found"
```bash
# Check if certificate exists
ls -la /certs/aeries-client.crt

# Fix permissions if needed
chmod 600 /certs/aeries-client.crt
```

### "Connection refused"
```bash
# Test basic connectivity
curl -I https://aeries.romoland.k12.ca.us

# Check environment variables
printenv | grep AERIES
```

### "ENOTFOUND" error
- Check if `AERIES_API_BASE_URL` is correct
- Ensure you have internet connectivity
- Verify the Aeries server is running

## 🎉 Success!

If everything works, you'll see:
```json
{
  "success": true,
  "test": "connection",
  "result": {
    "connected": true,
    "message": "Connection successful"
  }
}
```

Now you can sync attendance data from Aug 15, 2024 to June 12, 2025 with just these simple functions!

## 📖 Full Examples

Check `examples/simple-aeries-usage.ts` for complete copy-paste examples including:
- Connection testing
- Getting schools
- Processing attendance
- Batch operations
- Database syncing

**Total setup time: 2 minutes** ⚡