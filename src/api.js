import fallbackData from "./Constants/data.js";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

const getProjectsFromResponse = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

export const fetchARProject = async () => {
  const response = await fetch(`${API_BASE_URL}/projects/`);

  if (!response.ok) {
    throw new Error(`Project request failed with ${response.status}`);
  }

  const payload = await response.json();
  const projects = getProjectsFromResponse(payload);
  const project = projects[0];

  if (!project?.mindFile || !Array.isArray(project.targets)) {
    return fallbackData;
  }

  return {
    mindFile: project.mindFile,
    targets: project.targets.map((target) => ({
      targetIndex: target.targetIndex,
      video: target.video || "",
      model: target.model || "",
      thumbnail: target.thumbnail || "",
    })),
  };
};

export { fallbackData };
