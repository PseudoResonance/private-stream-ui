# Private Stream UI

A convenient web UI to act as a frontend for MediaMTX.

Video player UI utilizes [MediaChrome](https://www.media-chrome.org/).

## Configuration

The app will load a configuration file from the specified path. The path can be specified with the `CONFIG_PATH` environment variable, or the `-c` command line flag.

Additionally, the app will also use JSON files in the config directory. The directory should be named `$CONFIG_PATH.d`, substituting `$CONFIG_PATH` for the actual path to your config file. Thus, the config tree should look like the following.

```
parent
├─config.json
└─config.json.d
  ├─anotherconfig.json
  └─extra1.json
```

Files within the config directory will be checked in alphabetical order, and their values will be merged into the main config. Any duplicate values will be overridden by later config files.

To automatically generate publish URLs from the management panel, the following block can be added to the config.

Each number should be changed to the port the protocol is on, and unwanted protocols should be removed entirely from the list.

```json
"publishProtocols": {
    "srt": 8890,
    "webrtc": 8889,
    "webrtcSecure": 8889, // Use webrtcSecure for https connections
    "rtsp": 8554,
    "rtsps": 8322,
    "rtmp": 1935,
    "rtmps": 1936
}
```

## Installation

A Dockerfile is provided to build a Docker container to run the exporter. Additionally, a Kubernetes Helm chart is included for easy deployment.

### Docker Quickstart Guide

1. Clone the repository to a directory of your choice.
2. Edit the config file from the default in `config.default.json` and save to `config.json`.
3. Build the image with `docker compose build` and run it with `docker compose up -d`.

### Helm Quickstart Guide

1. Install the Helm repo.

```sh
helm repo add private-stream-ui https://pseudoresonance.github.io/private-stream-ui/
```

2. Fetch the values file and configure it to connect to your modem.

```sh
helm show values private-stream-ui/private-stream-ui > values.yaml
```

3. Install the chart.

```sh
helm install private-stream-ui private-stream-ui/private-stream-ui -n private-stream-ui -f values.yaml
```

## OIDC

[Auth0's library](https://github.com/auth0/express-openid-connect/) is used for OIDC login.

The `auth` section in the config.json is passed directly to the library.

The following is a sample configuration block.

```json
"auth": {
    "secret": "LONG PRIVATE SECRET HERE", // Generate a long string to use locally
    "auth0Logout": false, // Enable if using Auth0 as the provider
    "baseURL": "https://example.com", // The callback URL will be at /callback by default
    "issuerBaseURL": "https://auth.example.com", // Ensure there is no trailing slash
    "clientID": "CLIENT ID HERE",
    "clientSecret": "CLIENT SECRET HERE"
}
```

The OIDC scope `is_admin` must be included. It should contain a value of `false` for non admins, and `true` for admins.

## Configuration

The config file contains the base URL to the media server, as well as the various protocol ports to choose from.

## License

Licensed under the Apache License, Version 2.0.
