const staticConfig = require('./app.json').expo;

module.exports = ({ config }) => {
  const appConfig = config || staticConfig;
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

  return {
    ...appConfig,
    android: {
      ...appConfig.android,
      config: {
        ...appConfig.android?.config,
        ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
      },
    },
  };
};
