"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { machineCreateSchema, type MachineCreateFormData } from "@/lib/schemas";
import { apiClient } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Machine } from "@/types";

export function MachineForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MachineCreateFormData>({
    resolver: zodResolver(machineCreateSchema),
    defaultValues: {
      name: "",
      machine_type: "Slurry Pump",
      model: "",
      rated_rpm: null,
      supervisor_name: "",
      supervisor_phone: "",
      backup_phone: "",
      language: "en",
    },
  });

  const onSubmit = async (data: MachineCreateFormData) => {
    setServerError(null);
    try {
      const payload = {
        name: data.name,
        machine_type: data.machine_type,
        model: data.model || null,
        rated_rpm: data.rated_rpm ? Number(data.rated_rpm) : null,
        supervisor_name: data.supervisor_name || null,
        supervisor_phone: data.supervisor_phone,
        backup_phone: data.backup_phone || null,
        language: data.language || "en",
      };

      const machine = await apiClient.post<Machine>("/v1/machines", payload);
      router.push(`/machines/${machine.id}`);
    } catch (err: unknown) {
      setServerError(err instanceof Error ? err.message : "Failed to register machine");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-xl bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
      {serverError && (
        <Alert variant="danger">
          <AlertTitle>Registration Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Machine Name *</Label>
          <Input
            id="name"
            placeholder="e.g. Primary Slurry Pump #3"
            {...register("name")}
            className="mt-1"
          />
          {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="machine_type">Machine Type *</Label>
            <Input
              id="machine_type"
              placeholder="e.g. Slurry Pump"
              {...register("machine_type")}
              className="mt-1"
            />
            {errors.machine_type && (
              <p className="text-xs text-red-600 mt-1">{errors.machine_type.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="model">Model / Spec</Label>
            <Input
              id="model"
              placeholder="e.g. Warman 10/8 AH"
              {...register("model")}
              className="mt-1"
            />
            {errors.model && (
              <p className="text-xs text-red-600 mt-1">{errors.model.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="rated_rpm">Rated Operating RPM</Label>
          <Input
            id="rated_rpm"
            type="number"
            placeholder="e.g. 1465"
            {...register("rated_rpm")}
            className="mt-1"
          />
          {errors.rated_rpm && (
            <p className="text-xs text-red-600 mt-1">{errors.rated_rpm.message}</p>
          )}
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h4 className="text-sm font-semibold text-slate-800 mb-3">
            Emergency Voice & Escalation Contacts
          </h4>

          <div className="space-y-4">
            <div>
              <Label htmlFor="supervisor_name">Supervisor / Lead Name</Label>
              <Input
                id="supervisor_name"
                placeholder="e.g. Ramesh Kumar"
                {...register("supervisor_name")}
                className="mt-1"
              />
              {errors.supervisor_name && (
                <p className="text-xs text-red-600 mt-1">{errors.supervisor_name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="supervisor_phone">Supervisor Phone (AI Voice Call) *</Label>
                <Input
                  id="supervisor_phone"
                  placeholder="+919876543210"
                  {...register("supervisor_phone")}
                  className="mt-1 font-mono text-xs"
                />
                {errors.supervisor_phone && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.supervisor_phone.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="backup_phone">Backup Phone (Escalation SMS)</Label>
                <Input
                  id="backup_phone"
                  placeholder="+919123456789"
                  {...register("backup_phone")}
                  className="mt-1 font-mono text-xs"
                />
                {errors.backup_phone && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.backup_phone.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/machines")}
          className="min-h-[44px]"
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting} className="min-h-[44px]">
          Register Machine
        </Button>
      </div>
    </form>
  );
}
