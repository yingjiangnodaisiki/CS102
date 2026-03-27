export const ProjectStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  BIDDING: "BIDDING",
  CLOSED: "CLOSED",
  AWARDED: "AWARDED",
  CANCELLED: "CANCELLED"
} as const;

export type ProjectStatusValue = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const PROJECT_STATUS_TRANSITIONS: Record<ProjectStatusValue, ProjectStatusValue[]> = {
  DRAFT: ["PUBLISHED", "CANCELLED"],
  PUBLISHED: ["BIDDING", "CANCELLED"],
  BIDDING: ["CLOSED", "AWARDED", "CANCELLED"],
  CLOSED: [],
  AWARDED: [],
  CANCELLED: []
};
