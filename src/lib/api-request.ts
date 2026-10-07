export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}

export async function apiRequest<T = Record<string, unknown>>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { cache: "no-store", ...options }); }
  catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiError("연결하지 못했습니다. 입력은 유지되었으니 연결을 확인하고 다시 시도해 주세요.");
  }
  let data: T & { error?: string };
  try { data = await response.json(); }
  catch { throw new ApiError("서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.", response.status); }
  if (!response.ok) throw new ApiError(response.status === 401 ? "로그인이 만료되었습니다. 다시 로그인해 주세요." : data.error ?? "요청을 처리하지 못했습니다.", response.status);
  return data;
}

export function jsonRequest(method: string, body?: unknown): RequestInit {
  return { method, ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) };
}
