import {Config} from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    externals: {
      ...(currentConfiguration.externals as object),
      "@mediabunny/flac-encoder": "commonjs @mediabunny/flac-encoder",
    },
  };
});
