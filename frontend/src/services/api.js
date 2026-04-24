const API_BASE =
  import.meta.env.VITE_API_URL || "https://promasterarena.com.br/api";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erro na API");
  }

  return data;
}

export const api = {
  getTemplates() {
    return request("/tournament-templates");
  },

  createTournamentFromTemplate(payload) {
    return request("/tournaments/from-template", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
