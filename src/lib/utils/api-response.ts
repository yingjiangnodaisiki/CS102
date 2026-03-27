import { NextResponse } from "next/server";

export interface ApiSuccess<T> {
  code: "SUCCESS";
  data: T;
}

export interface ApiError {
  code: string;
  message: string;
  data?: Record<string, unknown>;
}

export function ok<T>(data: T, status: number = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ code: "SUCCESS", data }, { status });
}

export function fail(
  code: string,
  message: string,
  status: number = 400,
  data?: Record<string, unknown>
): NextResponse<ApiError> {
  return NextResponse.json({ code, message, data }, { status });
}
