# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# Capacitor: los plugins se buscan por nombre desde la web, R8 no puede renombrarlos
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }

# Plugins de Cordova (los carga por reflexión)
-keep class org.apache.cordova.** { *; }
-keep public class * extends org.apache.cordova.CordovaPlugin { *; }

# Métodos expuestos al WebView
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Trazas legibles en los informes de fallos (se traducen con mapping.txt)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
