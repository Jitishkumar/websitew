# Donations Table Setup

## Overview
This document explains how to set up the donations table in your Supabase database, which is required for the donation functionality and the Wealthiest Donors screen to work properly.

## Error Description
If you see the following error when accessing the Wealthiest Donors screen:
```
Error fetching donors: {"code": "42P01", "details": null, "hint": null, "message": "relation \"public.donations\" does not exist"}
```

This means that the donations table has not been created in your Supabase database yet.

## How to Apply the Migration

### Option 1: Using the Supabase Dashboard
1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query
4. Copy the contents of the `donations.sql` file in this directory
5. Run the SQL query

### Option 2: Using the Supabase CLI
If you have the Supabase CLI installed, you can run:

```bash
supabase db push --db-url=YOUR_SUPABASE_DB_URL
```

## Table Structure
The donations table includes the following fields:
- `id`: UUID primary key
- `user_id`: UUID foreign key to auth.users
- `donor_name`: Text field for the donor's name
- `amount`: Decimal field for the donation amount
- `payment_id`: Text field for the payment reference
- `payment_verified`: Boolean field indicating if the payment has been verified (default: false)
- `created_at`: Timestamp for when the donation was made
- `updated_at`: Timestamp for when the donation was last updated

## Security
Row Level Security (RLS) is enabled with the following policies:
- Anyone can view verified donations only (for the wealthiest donors list)
- Users can only insert their own donations

## Payment Verification
When a user makes a donation, the `payment_verified` field is set to `false` by default. An admin must manually verify the payment by setting this field to `true` in the Supabase dashboard. Only verified donations will appear in the Wealthiest Donors screen.

## Performance
An index is created on the amount and created_at columns for faster sorting when retrieving the wealthiest donors.