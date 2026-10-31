"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { apiClient } from "@/lib/api-client";
import type { DeviceCreated } from "@/types";

export interface DeviceBindingModalProps {
  isOpen: boolean;
  onClose: () => void;
  machineId: string;
  machineName: string;
  onDeviceBound?: () => void;
}

export function DeviceBindingModal({
  isOpen,
  onClose,
  machineId,
  machineName,
  onDeviceBound,
}: DeviceBindingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [deviceData, setDeviceData] = useState<DeviceCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateKey = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<DeviceCreated>("/v1/devices", {
        machine_id: machineId,
      });
      setDeviceData(response);
      onDeviceBound?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to bind sensor node");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyKey = () => {
    if (!deviceData?.device_key) return;
    navigator.clipboard.writeText(deviceData.device_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setDeviceData(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Bind Sensor Node: ${machineName}`}
      description="Issue a cryptographically secure key to authenticate physical ESP32 telemetry."
    >
      <div className="space-y-4">
        {error && (
          <Alert variant="danger">
            <AlertTitle>Binding Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!deviceData ? (
          <div className="text-sm text-slate-600 space-y-3">
            <p>
              Binding a sensor node associates an ESP32 hardware device to this machine. A unique,
              32-byte high-entropy device secret will be generated.
            </p>
            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
              ⚠️ Any previous key active on this device slot will remain valid until rotated.
            </p>
            <div className="pt-2 flex justify-end space-x-3">
              <Button variant="outline" onClick={handleClose} className="min-h-[44px]">
                Cancel
              </Button>
              <Button onClick={handleGenerateKey} isLoading={isLoading} className="min-h-[44px]">
                Generate Device Key
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="warning">
              <AlertTitle className="font-bold">⚠️ Store Device Key Securely</AlertTitle>
              <AlertDescription className="text-xs">
                This raw key will <strong>never be shown again</strong>. Copy it immediately to your
                ESP32 firmware configuration (<code>firmware/include/secrets.h</code>) as{" "}
                <code>DEVICE_KEY</code>.
              </AlertDescription>
            </Alert>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Device ID</label>
              <div
                data-testid="device-id"
                className="font-mono text-xs p-2.5 bg-slate-100 rounded border text-slate-800 break-all select-all"
              >
                {deviceData.device_id}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">
                Raw Device Key (X-Device-Key)
              </label>
              <div
                data-testid="device-key"
                className="font-mono text-xs p-2.5 bg-slate-900 text-emerald-400 rounded border border-slate-700 break-all select-all flex justify-between items-center"
              >
                <span>{deviceData.device_key}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center">
              <Button
                variant={copied ? "secondary" : "outline"}
                onClick={handleCopyKey}
                className="text-xs min-h-[44px]"
              >
                {copied ? "✓ Copied to Clipboard" : "📋 Copy Device Key"}
              </Button>
              <Button variant="primary" onClick={handleClose} className="min-h-[44px]">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
