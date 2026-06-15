export const ENDPOINTS = {
  siliconflow: "https://api.siliconflow.cn/v1",
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
}

export const SUGGESTIONS = [
  ["Review this repository", "Review this repository and suggest the highest-impact next steps."],
  ["Create a plan first", "Create a careful plan before making any code changes."],
  ["Explain the project", "Inspect the current project and explain how it is structured."],
  ["Summarize uploaded files", "Use the uploaded files and summarize what matters."],
] as const
