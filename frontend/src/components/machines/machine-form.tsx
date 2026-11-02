"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Cpu, Phone, ArrowRight } from "lucide-react";
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-sm"
    >
      {serverError && (
        <Alert variant="danger" className="rounded-xl">
          <AlertTitle>Registration Error</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {/* Asset Specifications */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-[#ff5733]">
            <Cpu className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Machine Specifications</h3>
        </div>

        <div>
          <Label htmlFor="name" className="text-xs font-semibold text-slate-700">
            Machine Name *
          </Label>
          <Input
            id="name"
            placeholder="e.g. Primary Slurry Pump #3"
            {...register("name")}
            className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
          />
          {errors.name && <p className="text-xs text-rose-600 mt-1">{errors.name.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="machine_type" className="text-xs font-semibold text-slate-700">
              Machine Category *
            </Label>
            <Input
              id="machine_type"
              placeholder="e.g. Slurry Pump"
              {...register("machine_type")}
              className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
            />
            {errors.machine_type && (
              <p className="text-xs text-rose-600 mt-1">{errors.machine_type.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="model" className="text-xs font-semibold text-slate-700">
              Model / Specification
            </Label>
            <Input
              id="model"
              placeholder="e.g. Warman 10/8 AH"
              {...register("model")}
              className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
            />
            {errors.model && (
              <p className="text-xs text-rose-600 mt-1">{errors.model.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="rated_rpm" className="text-xs font-semibold text-slate-700">
            Rated Operating RPM
          </Label>
          <Input
            id="rated_rpm"
            type="number"
            placeholder="e.g. 1465"
            {...register("rated_rpm")}
            className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 tabular-nums"
          />
          {errors.rated_rpm && (
            <p className="text-xs text-rose-600 mt-1">{errors.rated_rpm.message}</p>
          )}
        </div>
      </div>

      {/* Emergency Escalation Contacts */}
      <div className="space-y-4 pt-4 border-t border-slate-200/80">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-[#ff5733]">
            <Phone className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Emergency Dispatch & Voice Escalation</h3>
        </div>

        <div>
          <Label htmlFor="supervisor_name" className="text-xs font-semibold text-slate-700">
            Supervisor Name
          </Label>
          <Input
            id="supervisor_name"
            placeholder="e.g. Ramesh Kumar"
            {...register("supervisor_name")}
            className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15"
          />
          {errors.supervisor_name && (
            <p className="text-xs text-rose-600 mt-1">{errors.supervisor_name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="supervisor_phone" className="text-xs font-semibold text-slate-700">
              Supervisor Phone (Voice Dispatch) *
            </Label>
            <Input
              id="supervisor_phone"
              placeholder="+919876543210"
              {...register("supervisor_phone")}
              className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 font-mono"
            />
            {errors.supervisor_phone && (
              <p className="text-xs text-rose-600 mt-1">
                {errors.supervisor_phone.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="backup_phone" className="text-xs font-semibold text-slate-700">
              Backup Phone (SMS / Escalation)
            </Label>
            <Input
              id="backup_phone"
              placeholder="+919123456789"
              {...register("backup_phone")}
              className="mt-1.5 h-11 rounded-xl border-slate-200 bg-[#f7f7f8] text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#ff5733] focus:ring-4 focus:ring-[#ff5733]/15 font-mono"
            />
            {errors.backup_phone && (
              <p className="text-xs text-rose-600 mt-1">
                {errors.backup_phone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form Submission Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200/80">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/machines")}
          className="text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="text-xs font-semibold bg-[#ff5733] hover:bg-[#e04522] text-white shadow-sm gap-2"
        >
          Register Asset
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
