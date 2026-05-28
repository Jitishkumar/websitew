# 🔧 Cloudinary Upload Preset Setup

## ❌ Current Error

```
ERROR  Error uploading to Cloudinary: [TypeError: Network request failed]
```

**Cause**: The upload preset `connect_app_preset` doesn't exist or isn't configured as unsigned in your Cloudinary dashboard.

## ✅ Solution: Create Unsigned Upload Preset

### Step 1: Go to Cloudinary Dashboard

1. Visit: https://cloudinary.com/console
2. Login to your account
3. Your cloud name is: **`dhsdpvrrc`**

### Step 2: Create Upload Preset

1. Go to **Settings** (gear icon) → **Upload**
2. Scroll down to **Upload presets** section
3. Click **Add upload preset**

### Step 3: Configure the Preset

**Preset name**: `connect_app_preset`

**Signing mode**: **Unsigned** (IMPORTANT!)

**Folder**: `flexx_app` (optional - organizes your uploads)

**Other settings** (optional):
- **Allowed formats**: jpg, png, jpeg
- **Max file size**: 10 MB
- **Transformation**: None (or add if you want to resize images)

### Step 4: Save

Click **Save** at the top right.

## 🧪 Test the Upload

After creating the preset:

1. Rebuild your app (if using local build)
2. Try uploading a verification document again
3. Check the logs - you should see:
   ```
   LOG  Uploading to Cloudinary API...
   LOG  Response status: 200
   LOG  Upload successful: https://res.cloudinary.com/...
   ```

## 🔍 Verify Preset Exists

To check if your preset is configured correctly:

1. Go to: https://cloudinary.com/console/settings/upload
2. Look for `connect_app_preset` in the list
3. Make sure **Signing mode** shows **Unsigned**

## 🐛 Troubleshooting

### Error: "Invalid upload preset"
**Solution**: The preset name doesn't match. Make sure it's exactly `connect_app_preset`

### Error: "Upload preset must be unsigned"
**Solution**: Edit the preset and change **Signing mode** to **Unsigned**

### Error: "Network request failed"
**Solutions**:
1. Check your internet connection
2. Make sure the preset is created and saved
3. Try restarting the app
4. Check if Cloudinary is accessible: https://cloudinary.com

### Still Not Working?

If you continue to have issues, you can use a different preset name:

1. Create a preset with a different name (e.g., `flexx_uploads`)
2. Update the code in `src/config/cloudinary.js`:
   ```javascript
   formData.append('upload_preset', 'flexx_uploads'); // Change this line
   ```

## 📊 What Gets Uploaded

When users verify their account:
- **ID Document** (Aadhaar, PAN, Passport, etc.)
- **Selfie** (for verification)

Both are uploaded to Cloudinary and the URLs are saved in Supabase.

## 🔒 Security Notes

**Unsigned presets are safe** because:
- They only allow uploads (not deletions)
- You can restrict file types and sizes
- You can set folder restrictions
- No API secrets are exposed in the app

**What's NOT safe**:
- Signed uploads with API secrets in client code (we're not doing this)
- Allowing unlimited file sizes
- No file type restrictions

## ✅ Current Setup

Your Cloudinary config is secure:
- ✅ Using unsigned uploads (no secrets in app)
- ✅ Cloud name is public (safe to include)
- ✅ Upload preset name is public (safe to include)
- ❌ API Secret is NOT in app (good!)

---

**Next Step**: Create the `connect_app_preset` in your Cloudinary dashboard and try uploading again!
