const JSON_CONTENT_TYPE = "application/json";

export class ListmonkHttpError extends Error {
  constructor(status, body) {
    super(`listmonk request failed with status ${status}: ${body.slice(0, 500)}`);
    this.name = "ListmonkHttpError";
    this.status = status;
  }
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function campaignId(value) {
  const id = typeof value === "string" ? value.trim() : value;
  if ((typeof id !== "number" && typeof id !== "string") || id === "") {
    throw new TypeError("campaign id must be a number or non-empty string");
  }
  return encodeURIComponent(String(id));
}

/**
 * Creates the deliberately small listmonk surface used by the delivery worker.
 * Supplying fetchImpl keeps tests and dry runs completely disconnected from the
 * network.
 */
export function createListmonkClient({
  baseUrl,
  username,
  password,
  fetchImpl = globalThis.fetch,
} = {}) {
  const endpoint = requiredString(baseUrl, "baseUrl").replace(/\/+$/, "");
  const user = requiredString(username, "username");
  const token = requiredString(password, "password");

  if (typeof fetchImpl !== "function") {
    throw new TypeError("fetchImpl must be a function");
  }

  const authorization = `Basic ${Buffer.from(`${user}:${token}`, "utf8").toString("base64")}`;

  async function request(pathname, body) {
    const response = await fetchImpl(`${endpoint}/api${pathname}`, {
      method: pathname.endsWith("/status") ? "PUT" : "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": JSON_CONTENT_TYPE,
      },
      body: JSON.stringify(body),
    });

    const rawBody = await response.text();
    if (!response.ok) {
      throw new ListmonkHttpError(response.status, rawBody);
    }

    if (rawBody === "") return null;

    let parsed;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new Error("listmonk returned an invalid JSON response");
    }

    return parsed?.data ?? parsed;
  }

  return Object.freeze({
    async createCampaign(payload) {
      if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
        throw new TypeError("campaign payload must be an object");
      }
      return request("/campaigns", payload);
    },

    async startCampaign(id) {
      return request(`/campaigns/${campaignId(id)}/status`, { status: "running" });
    },
  });
}

