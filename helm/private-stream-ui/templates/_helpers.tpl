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

{{/*
Should generate database secret
*/}}
{{- define "private-stream-ui.generateSecretDb" }}
{{- and (not .Values.databaseConfig.auth.existingSecret) (.Values.databaseConfig.auth.enabled) }}
{{- end -}}

{{/*
Database secret name
*/}}
{{- define "private-stream-ui.secretNameDb" }}
{{- if eq (include "private-stream-ui.generateSecretDb" .) "true" }}
  {{- include "private-stream-ui.fullname" . }}-creds
{{- else }}
  {{- .Values.databaseConfig.auth.existingSecret }}
{{- end }}
{{- end -}}

{{/*
Check if a pregenerated secret already exists
*/}}
{{- define "private-stream-ui.remoteSecretDb" }}
  {{- if and .Values.databaseConfig.auth.enabled (not .Values.databaseConfig.auth.existingSecret) (not .Values.databaseConfig.auth.password) }}
    {{- $secretObj := (lookup "v1" "Secret" .Release.Namespace (include "private-stream-ui.secretNameDb" .)) | default dict }}
    {{- $secretData := (get $secretObj "data") | default dict }}
    {{- (get $secretData .Values.databaseConfig.auth.passwordKey) | default (randAlphaNum 100 | b64enc) }}
  {{- end }}
{{- end -}}

{{/*
Should generate OIDC primary secret
*/}}
{{- define "private-stream-ui.generateSecretOidcPrimary" }}
{{- and (not .Values.oidc.existingSecret) (.Values.oidc.enabled) }}
{{- end -}}

{{/*
OIDC primary secret name
*/}}
{{- define "private-stream-ui.secretNameOidcPrimary" }}
{{- if eq (include "private-stream-ui.generateSecretOidcPrimary" .) "true" }}
  {{- include "private-stream-ui.fullname" . }}-oidc
{{- else }}
  {{- .Values.oidc.existingSecret }}
{{- end }}
{{- end -}}

{{/*
Should generate OIDC secret
*/}}
{{- define "private-stream-ui.generateSecretOidc" }}
{{- and (not .Values.oidc.localSecret.existingSecret) (.Values.oidc.enabled) }}
{{- end -}}

{{/*
OIDC secret name
*/}}
{{- define "private-stream-ui.secretNameOidc" }}
{{- if eq (include "private-stream-ui.generateSecretOidc" .) "true" }}
  {{- include "private-stream-ui.fullname" . }}-oidc-secret
{{- else }}
  {{- .Values.oidc.localSecret.existingSecret }}
{{- end }}
{{- end -}}

{{/*
Check if a pregenerated OIDC secret already exists
*/}}
{{- define "private-stream-ui.remoteSecretOidc" }}
  {{- if and .Values.oidc.enabled (not .Values.oidc.localSecret.existingSecret) (not .Values.oidc.localSecret.value) }}
    {{- $secretObj := (lookup "v1" "Secret" .Release.Namespace (include "private-stream-ui.secretNameOidc" .)) | default dict }}
    {{- $secretData := (get $secretObj "data") | default dict }}
    {{- (get $secretData .Values.oidc.localSecret.secretGeneratedKey) | default (randAlphaNum 100 | b64enc) }}
  {{- end }}
{{- end -}}
