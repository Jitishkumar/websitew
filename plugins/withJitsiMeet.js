const { withAndroidManifest, withBuildGradle } = require('@expo/config-plugins');

module.exports = function withJitsiMeet(config) {
  // Add Android manifest configuration
  config = withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    
    // Ensure application element exists
    if (!manifest.application) {
      manifest.application = [];
    }
    
    // Add Jitsi Meet activity
    const jitsiActivity = {
      $: {
        'android:name': 'org.jitsi.meet.JitsiMeetActivity',
        'android:configChanges': 'keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize',
        'android:launchMode': 'singleTask',
        'android:resizeableActivity': 'true',
        'android:supportsPictureInPicture': 'true',
        'android:windowSoftInputMode': 'adjustResize',
      },
    };
    
    // Check if activity already exists
    const activities = manifest.application[0].activity || [];
    const jitsiExists = activities.some(
      (activity) => activity.$['android:name'] === 'org.jitsi.meet.JitsiMeetActivity'
    );
    
    if (!jitsiExists) {
      if (!manifest.application[0].activity) {
        manifest.application[0].activity = [];
      }
      manifest.application[0].activity.push(jitsiActivity);
    }
    
    return config;
  });

  // Add Jitsi Meet SDK to build.gradle
  config = withBuildGradle(config, async (config) => {
    const buildGradle = config.modResults;
    
    // Add JitPack repository
    if (buildGradle.allprojects && buildGradle.allprojects[0]) {
      if (!buildGradle.allprojects[0].repositories) {
        buildGradle.allprojects[0].repositories = [];
      }
      
      const hasJitpack = buildGradle.allprojects[0].repositories.some(
        (repo) => repo.url && repo.url.includes('jitpack.io')
      );
      
      if (!hasJitpack) {
        buildGradle.allprojects[0].repositories.push({
          url: 'https://github.com/jitsi/jitsi-maven-repository/raw/master/releases',
        });
      }
    }
    
    return config;
  });

  return config;
};
