import type { components, paths } from "./api.generated";

export type Schemas = components["schemas"];

export type Machine = Schemas["MachineOut"];
export type MachineCreate = Schemas["MachineCreate"];
export type MachineUpdate = Schemas["MachineUpdate"];
export type DeviceCreated = Schemas["DeviceCreated"];
export type DeviceConfig = Schemas["DeviceConfig"];
export type DeviceSampling = Schemas["DeviceSampling"];
export type DeviceThresholds = Schemas["DeviceThresholds"];

export type EventStatus = Schemas["EventStatus"];
export type EventSummary = Schemas["EventSummary"];
export type EventDetail = Schemas["EventDetail"];
export type Diagnosis = Schemas["Diagnosis"];
export type Cause = Schemas["Cause"];
export type Peak = Schemas["PeakIn"];
export type Baseline = Schemas["BaselineIn"];
export type CallAttempt = Schemas["CallAttemptOut"];
export type DecisionIn = Schemas["DecisionIn"];

export type Manual = Schemas["ManualOut"];
export type Trend = Schemas["TrendOut"];
export type TrendPoint = Schemas["TrendPointOut"];
export type TokenOut = Schemas["TokenOut"];
export type TestCallAccepted = Schemas["TestCallAccepted"];

export type User = Schemas["UserOut"];
export type UserUpdateIn = Schemas["UserUpdateIn"];
export type Factory = Schemas["FactoryOut"];
export type FactoryIn = Schemas["FactoryIn"];
export type RegisterIn = Schemas["RegisterIn"];
export type OnboardingCompleteIn = Schemas["OnboardingCompleteIn"];

export type PageMachine = Schemas["Page_MachineOut_"];
export type PageEvent = Schemas["Page_EventSummary_"];

export type ApiPaths = paths;

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface UserSession {
  token: string;
  userId: string;
  email: string;
}
