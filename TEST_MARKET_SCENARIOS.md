# Market-Specific Distance Unit Tests

This document provides test scenarios for verifying that comparable sales distances display in the correct units for each market.

## Test Setup

To test these scenarios, you'll need to:
1. Create a property with address_components containing the appropriate `country_code`
2. Generate a report with comparable sales
3. View the report in the mobile app or download the PDF

## Market Test Cases

### 🇵🇭 Philippines (PH)
**Expected Unit**: Kilometers (km)

#### Sample Comparable Sales
```
Property: 456 Elm Street, Manila
Distance: 1.6 km away
Sale Price: ₱12,500,000

Property: 789 Maple Drive, Quezon City
Distance: 3.2 km away
Sale Price: ₱14,200,000
```

**Test Data**:
- Input: `distance_miles: 1` → Output: `1.6 km`
- Input: `distance_miles: 2` → Output: `3.2 km`
- Input: `distance_miles: 0.3` → Output: `0.5 km`

---

### 🇦🇺 Australia (AU)
**Expected Unit**: Kilometers (km)

#### Sample Comparable Sales
```
Property: 456 Elm Street, Sydney
Distance: 0.8 km away
Sale Price: A$1,250,000

Property: 789 Maple Drive, Melbourne
Distance: 2.4 km away
Sale Price: A$1,420,000
```

**Test Data**:
- Input: `distance_miles: 0.5` → Output: `0.8 km`
- Input: `distance_miles: 1.5` → Output: `2.4 km`
- Input: `distance_miles: 0.1` → Output: `0.2 km`

---

### 🇺🇸 United States (US)
**Expected Unit**: Miles (mi)

#### Sample Comparable Sales
```
Property: 456 Elm Street, San Francisco
Distance: 0.3 mi away
Sale Price: $850,000

Property: 789 Maple Drive, San Francisco
Distance: 1.2 mi away
Sale Price: $920,000
```

**Test Data**:
- Input: `distance_miles: 0.3` → Output: `0.3 mi`
- Input: `distance_miles: 1.2` → Output: `1.2 mi`
- Input: `distance_miles: 2.5` → Output: `2.5 mi`

---

### 🇬🇧 United Kingdom (GB)
**Expected Unit**: Miles (mi)

#### Sample Comparable Sales
```
Property: 456 Elm Street, London
Distance: 0.5 mi away
Sale Price: £850,000

Property: 789 Maple Drive, London
Distance: 1.5 mi away
Sale Price: £920,000
```

**Test Data**:
- Input: `distance_miles: 0.5` → Output: `0.5 mi`
- Input: `distance_miles: 1.5` → Output: `1.5 mi`
- Input: `distance_miles: 2.5` → Output: `2.5 mi`

---

### 🇸🇬 Singapore (SG)
**Expected Unit**: Kilometers (km)
**Note**: Singapore uses sqft for property size but km for distance

#### Sample Comparable Sales
```
Property: 456 Elm Street, Singapore
Distance: 0.8 km away
Sale Price: S$1,250,000

Property: 789 Maple Drive, Singapore
Distance: 2.4 km away
Sale Price: S$1,420,000
```

**Test Data**:
- Input: `distance_miles: 0.5` → Output: `0.8 km`
- Input: `distance_miles: 1.5` → Output: `2.4 km`
- Input: `distance_miles: 0.1` → Output: `0.2 km`

---

### 🇦🇪 United Arab Emirates (AE)
**Expected Unit**: Kilometers (km)
**Note**: UAE uses sqft for property size but km for distance

#### Sample Comparable Sales
```
Property: 456 Elm Street, Dubai
Distance: 1.6 km away
Sale Price: AED 4,500,000

Property: 789 Maple Drive, Dubai
Distance: 3.2 km away
Sale Price: AED 4,800,000
```

**Test Data**:
- Input: `distance_miles: 1` → Output: `1.6 km`
- Input: `distance_miles: 2` → Output: `3.2 km`
- Input: `distance_miles: 0.5` → Output: `0.8 km`

---

### 🇨🇦 Canada (CA)
**Expected Unit**: Kilometers (km)
**Note**: Canada uses sqft for property size but km for distance

#### Sample Comparable Sales
```
Property: 456 Elm Street, Toronto
Distance: 1.6 km away
Sale Price: C$850,000

Property: 789 Maple Drive, Toronto
Distance: 4.8 km away
Sale Price: C$920,000
```

**Test Data**:
- Input: `distance_miles: 1` → Output: `1.6 km`
- Input: `distance_miles: 3` → Output: `4.8 km`
- Input: `distance_miles: 0.5` → Output: `0.8 km`

---

### 🇩🇪 Germany (DE)
**Expected Unit**: Kilometers (km)

#### Sample Comparable Sales
```
Property: 456 Elm Street, Berlin
Distance: 1.6 km away
Sale Price: €850,000

Property: 789 Maple Drive, Berlin
Distance: 3.2 km away
Sale Price: €920,000
```

**Test Data**:
- Input: `distance_miles: 1` → Output: `1.6 km`
- Input: `distance_miles: 2` → Output: `3.2 km`
- Input: `distance_miles: 0.5` → Output: `0.8 km`

---

## UI Verification Checklist

### Mobile App (report-view.tsx)
For each market, verify:
- [ ] Comparable sales card shows correct distance unit
- [ ] Example: "1.6 km away" for PH, not "1.0 mi away"
- [ ] Formatting is "X.X [unit] away"

### PDF Report (backend/pdf.ts)
For each market, verify:
- [ ] PDF displays correct distance unit for comparables
- [ ] Example: "Distance: 1.6 km" for PH
- [ ] Distance matches what's shown in the mobile app

## Edge Cases to Test

1. **Very short distances**
   - 0.1 miles → 0.2 km (metric) or 0.1 mi (imperial)

2. **Very long distances**
   - 100 miles → 160.9 km (metric) or 100.0 mi (imperial)

3. **Rounding edge cases**
   - 1.234 miles → 2.0 km (PH) - rounds to 1 decimal

4. **Zero distance**
   - 0 miles → 0.0 km or 0.0 mi

5. **Missing country code**
   - Should default to km (global default)

## Test Execution Commands

```bash
# Run backend distance formatting tests
npm test -- backend/src/utils/formatDistance.test.ts

# Run mobile distance formatting tests
npm test -- mobile/config/marketConfig.test.ts

# Run manual mobile app test (requires dev server)
npm run start:mobile
# Then navigate to a property and generate a report for each market
```

## Regression Prevention

These test cases ensure that:
1. ✅ Non-US properties show distances in the correct metric unit
2. ✅ US/GB properties continue to show distances in miles
3. ✅ Mixed metric countries (CA, SG, AE) show correct distance units while maintaining size unit conventions
4. ✅ PDF reports match the mobile app display
5. ✅ Unknown countries default to km gracefully
