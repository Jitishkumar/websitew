# Account Verification System

## Database Changes

### New SQL Migration

A new SQL migration file has been created: `add_phone_column_and_username_policy.sql`. This file contains two important changes:

1. **Adding a phone column to the profiles table**
   - This addresses the error: "column profiles.phone does not exist"
   - The column is defined as `text` type

2. **Creating a policy to prevent username changes after verification**
   - Implements a trigger function `prevent_username_change_if_verified()`
   - Adds a trigger `prevent_verified_username_change` on the profiles table
   - This ensures that once an account is verified, the username cannot be changed

## How to Apply the Migration

### Option 1: Using Supabase CLI (if configured)

```bash
npx supabase db push
```

### Option 2: Manual Application via Supabase Dashboard

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `add_phone_column_and_username_policy.sql`
4. Paste into the SQL Editor and run the query

## Code Changes

1. **VerifyAccountScreen.js**
   - Modified to handle the missing phone column until the SQL migration is applied
   - Updated to save the phone number to the profiles table during verification

## Verification Process

The account verification process remains the same:

1. User enters their real name and phone number
2. User uploads two government-issued ID documents
3. User makes a ₹70 payment via Razorpay
4. The system stores all information and payment details
5. Admin manually reviews and approves the verification
6. Once approved, a red verification badge appears next to the username

## Username Change Policy

After a user's account is verified (when their record in the verified_accounts table has verified = true):
- The username cannot be changed
- Any attempt to update the username will raise an exception
- This ensures the integrity of verified accounts