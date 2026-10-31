#pragma once

// Wi-Fi Configuration
#define WIFI_SSID "Factory_WiFi_Guest"
#define WIFI_PASSWORD "ChangeMe123"

// Server Configuration
#define API_HOST "api.machine-copilot.example.com"
#define API_PORT 443
#define DEVICE_ID "dev_01HZX3K2M9V4Q8R7T1Y6N0P5CB"
#define MACHINE_ID "mch_01HZX3K2M9V4Q8R7T1Y6N0P5CB"
#define DEVICE_KEY "dk_ChangeMeTo32BytesBase64SecretKeyHere12"

// Root CA Certificate (PEM format)
const char* const ROOT_CA_CERT = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw\n" \
"TzELMAkGA1UEBhMCVVMxEzARBgNVBAoTCkZhc3RseSBJbmMxKjAoBgNVBAMTIVN5\n" \
"bWFudGVjIEJhc2ljIFNlcnZlciBJU1AgQ0EgLSBHMjAeFw0xNzExMDIwMDAwMDBa\n" \
"-----END CERTIFICATE-----\n";

