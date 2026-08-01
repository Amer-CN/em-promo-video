import {Config} from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);

Config.overrideWebpackConfig((currentConfiguration) => {
  return {
    ...currentConfiguration,
    externals: {
      ...(currentConfiguration.externals as object),
      "@mediabunny/flac-encoder": "commonjs @mediabunny/flac-encoder",
      // calculateMetadata runs in the node process; keep node builtins out of the browser bundle.
      "node:fs": "commonjs node:fs",
      "node:path": "commonjs node:path",
    },
  };
});
