# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt

# Optimization settings
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-optimizationpasses 5
-allowaccessmodification
-dontpreverify

# Remove debug logs in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
}

# Keep native methods
-keepclassmembers class * {
    native <methods>;
}

# React Native - Keep only essentials
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Razorpay - Keep only necessary classes
-keepclassmembers class com.razorpay.** {
    public *;
}
-keepattributes *Annotation*
-dontwarn com.razorpay.**

# Zego Cloud - Keep all classes (required for video calling)
-keep class **.zego.** { *; }
-keep class im.zego.** { *; }
-keep class com.zegocloud.** { *; }
-keep class com.itgsa.** { *; }
-keepclassmembers class **.zego.** { *; }
-keepclassmembers class im.zego.** { *; }
-keepclassmembers class com.zegocloud.** { *; }
-keepclassmembers class com.itgsa.** { *; }
-dontwarn im.zego.**
-dontwarn com.zegocloud.**
-dontwarn com.itgsa.**

# Supabase - Minimal keep
-keepclassmembers class io.supabase.** {
    public *;
}

# Expo - Keep only necessary
-keepclassmembers class expo.modules.** {
    public *;
}

# Remove unused resources
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# Additional Zego dependencies
-keep class org.webrtc.** { *; }
-keepclassmembers class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Keep all native libraries
-keepclasseswithmembernames class * {
    native <methods>;
}

# Keep serializable classes
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep Parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

# React Native WebRTC (used by Zego)
-keep class com.oney.WebRTCModule.** { *; }
-dontwarn com.oney.WebRTCModule.**
