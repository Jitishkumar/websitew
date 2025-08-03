# Verification Badge Fix and Expiration Implementation

## Issue

The verification badge (red checkmark) was not displaying on the ProfileScreen and UserProfileScreen even when the `verified` boolean was set to true in the Supabase database. Additionally, there was a requirement to automatically remove the verification badge after one month.

## Root Causes

1. **Missing Verification Status Check**: The ProfileScreen was not querying the `verified_accounts` table to check the verification status.

2. **Missing UI Elements**: The ProfileScreen did not have the UI elements to display the verification badge next to the username.

3. **Missing Row Level Security (RLS)**: The `verified_accounts` table might not have had proper RLS policies, potentially preventing users from accessing verification data.

4. **No Expiration Mechanism**: There was no mechanism to automatically expire verification status after one month.

## Solutions

### 1. Fixed Verification Status Check in ProfileScreen

Added code to query the `verified_accounts` table and set the `isVerified` flag in the user profile:

```javascript
// Check if user is verified
const { data: verifiedData, error: verifiedError } = await supabase
  .from('verified_accounts')
  .select('verified')
  .eq('id', user.id)
  .maybeSingle();
  
if (verifiedError) {
  console.error('Error checking verification status:', verifiedError);
}

console.log('Verification status:', verifiedData?.verified);

// Set isVerified flag in user profile
setUserProfile({
  ...newData,
  avatar_url: avatarUrl,
  cover_url: coverUrl,
  isVerified: verifiedData?.verified || false
});
```

### 2. Added UI Elements to Display Verification Badge

Added a container view and the verification badge icon next to the username:

```javascript
<View style={styles.usernameContainer}>
  <Text style={styles.username}>@{userProfile?.username || 'username'}</Text>
  {userProfile?.isVerified && (
    <Ionicons name="checkmark-circle" size={20} color="#ff0000" style={styles.verifiedBadge} />
  )}
</View>
```

Added the necessary styles:

```javascript
usernameContainer: {
  flexDirection: 'row',
  alignItems: 'center',
  marginBottom: 10,
},
verifiedBadge: {
  marginLeft: 5,
},
```

### 3. Added RLS Policies for verified_accounts Table

Created SQL scripts to add proper RLS policies to the `verified_accounts` table:

```sql
-- Enable Row Level Security for verified_accounts table
ALTER TABLE public.verified_accounts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view their own verification status
CREATE POLICY "Users can view their own verification status"
  ON public.verified_accounts
  FOR SELECT
  USING (auth.uid() = id);

-- Create policy to allow users to view other users' verification status
CREATE POLICY "Users can view other users' verification status"
  ON public.verified_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy to allow users to insert their own verification data
CREATE POLICY "Users can insert their own verification data"
  ON public.verified_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policy to allow users to update their own verification data
CREATE POLICY "Users can update their own verification data"
  ON public.verified_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
```

### 4. Implemented Verification Expiration Mechanism

Created SQL functions and triggers to automatically expire verification status after one month:

```sql
-- Create function to automatically expire verification after one month
CREATE OR REPLACE FUNCTION expire_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- If the record is being updated and verified is being set to true
  IF TG_OP = 'UPDATE' AND NEW.verified = TRUE AND (OLD.verified IS NULL OR OLD.verified = FALSE) THEN
    -- Set updated_at to current time
    NEW.updated_at = timezone('utc'::text, now());
  END IF;
  
  -- If the record is verified and was updated more than one month ago, set verified to false
  IF NEW.verified = TRUE AND NEW.updated_at < (timezone('utc'::text, now()) - interval '1 month') THEN
    NEW.verified = FALSE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to run expire_verification function before insert or update
CREATE TRIGGER expire_verification_trigger
  BEFORE INSERT OR UPDATE ON public.verified_accounts
  FOR EACH ROW
  EXECUTE FUNCTION expire_verification();

-- Create function to check and expire verifications daily
CREATE OR REPLACE FUNCTION check_expired_verifications()
RETURNS void AS $$
BEGIN
  UPDATE public.verified_accounts
  SET verified = FALSE
  WHERE verified = TRUE AND updated_at < (timezone('utc'::text, now()) - interval '1 month');
  
  RETURN;
END;
$$ LANGUAGE plpgsql;
```

## Testing and Debugging

Created a SQL script (`test_verification_status.sql`) to help test and debug verification status issues:

1. Check if the `verified_accounts` table exists and has the correct structure
2. Check if RLS is enabled on the `verified_accounts` table
3. Check existing RLS policies on the `verified_accounts` table
4. Check if there are any records in the `verified_accounts` table
5. Check if there are any verified accounts
6. For a specific user, check if they have a record in the `verified_accounts` table
7. For testing, manually set a user's verification status to true
8. If a user doesn't have a record in the `verified_accounts` table, insert one

## Implementation Steps

1. Run the `fix_verification_badge.sql` script in the Supabase SQL Editor to add RLS policies and implement the expiration mechanism.
2. Deploy the updated ProfileScreen.js and UserProfileScreen.js files to display the verification badge.
3. Use the `test_verification_status.sql` script to test and debug any remaining issues.

## Notes

- The expiration mechanism requires the `updated_at` column to be properly maintained, which is handled by the existing `update_verified_accounts_updated_at()` function and trigger.
- For the daily check of expired verifications, you may need to set up a scheduled function or cron job depending on your hosting environment.