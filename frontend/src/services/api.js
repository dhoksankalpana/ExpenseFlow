
import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

let csrfToken = null;
let csrfRefreshPromise = null;

export async function refreshCsrfToken() {
  if (!csrfRefreshPromise) {
    csrfRefreshPromise = api
      .get("/auth/csrf")
      .then((response) => {
        csrfToken = response.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfRefreshPromise = null;
      });
  }

  return csrfRefreshPromise;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();

  // Multipart uploads need the browser/Axios to set their boundary.
  if (
    typeof FormData !== "undefined" &&
    config.data instanceof FormData
  ) {
    config.headers = config.headers || {};

    if (typeof config.headers.delete === "function") {
      config.headers.delete("Content-Type");
    } else {
      delete config.headers["Content-Type"];
      delete config.headers["content-type"];
    }
  }

  // Preserve CSRF protection for all state-changing requests.
  if (!["get", "head", "options"].includes(method)) {
    if (!csrfToken) {
      await refreshCsrfToken();
    }

    config.headers = config.headers || {};
    config.headers["x-csrf-token"] = csrfToken;
  }

  return config;
});

export default api;
