import { DataProvider } from "react-admin";

const apiUrl = "/api";

async function http(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  const json = await res.json();
  return { json, headers: res.headers };
}

export const dataProvider: DataProvider = {
  getList: async (resource, params) => {
    const { page = 1, perPage = 25 } = params.pagination ?? {};
    const { field = "id", order = "ASC" } = params.sort ?? {};

    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    const query = new URLSearchParams({
      sort: JSON.stringify([field, order]),
      range: JSON.stringify([start, end]),
      filter: JSON.stringify(params.filter ?? {}),
    });

    const { json, headers } = await http(`${apiUrl}/${resource}?${query.toString()}`);

    const contentRange = headers.get("Content-Range") || "";
    const total = Number(contentRange.split("/").pop() || 0);

    return { data: json, total };
  },

  getOne: async (resource, params) => {
    const { json } = await http(`${apiUrl}/${resource}/${params.id}`);
    return { data: json };
  },

  create: async (resource, params) => {
    const { json } = await http(`${apiUrl}/${resource}`, {
      method: "POST",
      body: JSON.stringify(params.data),
    });
    return { data: json };
  },

  update: async (resource, params) => {
    const { json } = await http(`${apiUrl}/${resource}/${params.id}`, {
      method: "PUT",
      body: JSON.stringify(params.data),
    });
    return { data: json };
  },

  delete: async (resource, params) => {
    const { json } = await http(`${apiUrl}/${resource}/${params.id}`, { method: "DELETE" });
    return { data: json };
  },

  // Minimal no-op implementations (not needed yet)
  getMany: async (resource, params) => {
    const results = await Promise.all(params.ids.map((id) => http(`${apiUrl}/${resource}/${id}`)));
    return { data: results.map((r) => r.json) };
  },
  getManyReference: async (resource, params) => {
    return (await (dataProvider.getList as any)(resource, params));
  },
  updateMany: async () => ({ data: [] }),
  deleteMany: async () => ({ data: [] }),
};