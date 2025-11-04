# Private Stream UI

A convenient web UI to act as a frontend for MediaMTX.

Video player UI utilizes [MediaChrome](https://www.media-chrome.org/).

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

## Configuration

The config file contains the base URL to the media server, as well as the various protocol ports to choose from.

## License

Licensed under the Apache License, Version 2.0.
