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

# Razorpay ProGuard rules
-keepclassmembers class * {
    @proguard.annotation.Keep *;
    @proguard.annotation.KeepClassMembers *;
}
-keep class com.razorpay.** { *; }
-keep class proguard.annotation.** { *; }
-dontwarn proguard.annotation.**

# Google Pay APIs (optional dependencies for Razorpay)
-dontwarn com.google.android.apps.nbu.paisa.inapp.client.api.**
-keep class com.google.android.apps.nbu.paisa.inapp.client.api.** { *; }

# Razorpay GPay integration (optional features)
-keep class com.razorpay.RzpGpayMerged { *; }
-dontwarn com.razorpay.i_$z_

# Keep all classes with @Keep annotation
-keep @proguard.annotation.Keep class * { *; }
-keepclassmembers class * {
    @proguard.annotation.Keep *;
}

# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep,allowobfuscation @interface com.facebook.common.internal.DoNotStrip
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keep @com.facebook.common.internal.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.common.internal.DoNotStrip *;
}

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# Add any project specific keep options here:
