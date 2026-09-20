const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

module.exports = function withIOSSceneLifecycle(config) {
  config = withInfoPlist(config, (config) => {
    config.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [{
          UISceneConfigurationName: 'Default Configuration',
          UISceneDelegateClassName: 'EXExpoAppSceneDelegate',
        }],
      },
    };
    return config;
  });
  return withAppDelegate(config, (config) => {
    if (config.modResults.language !== 'swift') {
      throw new Error('Pixie scene lifecycle requires the Expo Swift AppDelegate.');
    }
    let source = config.modResults.contents;
    if (!source.includes('ExpoReactNativeFactoryProvider')) {
      source = source.replace('class AppDelegate: ExpoAppDelegate {',
        'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    }
    const legacyWindow = /#if os\(iOS\) \|\| os\(tvOS\)\s+window = UIWindow\(frame: UIScreen\.main\.bounds\)\s+factory\.startReactNative\([\s\S]*?launchOptions: launchOptions\)\s+#endif/;
    source = source.replace(legacyWindow, '');
    if (!source.includes('ExpoReactNativeFactoryProvider') || source.includes('window = UIWindow(frame: UIScreen.main.bounds)')) {
      throw new Error('Expo AppDelegate template changed; review scene lifecycle initialization before building.');
    }
    config.modResults.contents = source;
    return config;
  });
};
