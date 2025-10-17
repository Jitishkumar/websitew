# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# React Native
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# Remove debug logs in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}

# Supabase
-keep class io.supabase.** { *; }

# Expo
-keep class expo.** { *; }

# Razorpay and Google Pay Integration
-keep class com.razorpay.** { *; }
-keepclassmembers class com.razorpay.** { *; }
-keep class com.google.android.apps.nbu.paisa.inapp.client.api.** { *; }
-keepattributes *Annotation*
-dontwarn com.razorpay.**
-dontwarn com.google.android.apps.nbu.paisa.inapp.client.api.**

# Add missing ProGuard annotations
-dontwarn proguard.annotation.**
-keep class proguard.annotation.** { *; }

# Remove unused code
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-optimizationpasses 5
