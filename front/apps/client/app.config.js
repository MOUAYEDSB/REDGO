
const staticConfig = require('./app.json').expo;

module.exports = ({ config }) => {
  const appConfig = config || staticConfig;

  const googleMapsApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  const plugins = appConfig.plugins || [];

  const requiredPlugins = [
  'expo-router',
  'expo-secure-store',
  'expo-status-bar',
];

  const existingPluginNames = plugins.map((plugin) =>
    Array.isArray(plugin) ? plugin[0] : plugin
  );

  const updatedPlugins = [
    ...plugins,
    ...requiredPlugins.filter(
      (plugin) => !existingPluginNames.includes(plugin)
    ),
  ];

  return {
    // Conserver toute la configuration Expo existante
    ...appConfig,

    // Plugins
    plugins: updatedPlugins,

    // Configuration Android
    android: {
      ...appConfig.android,

      config: {
        ...appConfig.android?.config,

        ...(googleMapsApiKey
          ? {
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          }
          : {}),
      },
    },

    // Configuration iOS
    ios: {
      ...appConfig.ios,
    },
  };
};
