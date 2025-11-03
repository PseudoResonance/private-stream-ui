{{/*
Expand the name of the chart.
*/}}
{{- define "private-stream-ui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "private-stream-ui.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "private-stream-ui.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "private-stream-ui.labels" -}}
helm.sh/chart: {{ include "private-stream-ui.chart" . }}
{{ include "private-stream-ui.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "private-stream-ui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "private-stream-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Get the container image
*/}}
{{- define "private-stream-ui.image" }}
  {{- if .Values.image.digest }}
    {{- .Values.image.repository }}@{{ .Values.image.digest }}
  {{- else }}
    {{- if .Values.image.tag }}
      {{- .Values.image.repository }}:{{ .Values.image.tag }}
    {{- else }}
      {{- .Values.image.repository }}:{{ .Chart.AppVersion }}
    {{- end }}
  {{- end }}
{{- end -}}
