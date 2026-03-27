import { WorkspaceService } from "@/lib/services/workspace/WorkspaceService";
import { WorkspaceRepository } from "@/lib/repositories/WorkspaceRepository";

describe("workspace service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should return awarded unfinished todo projects", async () => {
    jest.spyOn(WorkspaceRepository, "listTodoProjects").mockResolvedValueOnce([
      {
        id: "project-1",
        title: "项目A",
        status: "AWARDED",
        clientId: "client-1",
        bids: [{ developerId: "dev-1" }],
        workspaceSubmissions: [
          {
            id: "sub-1",
            submitterUserId: "dev-1",
            status: "PENDING",
            createdAt: new Date()
          }
        ]
      },
      {
        id: "project-2",
        title: "项目B",
        status: "AWARDED",
        clientId: "client-1",
        bids: [{ developerId: "dev-2" }],
        workspaceSubmissions: [
          {
            id: "sub-2",
            submitterUserId: "dev-2",
            status: "APPROVED",
            createdAt: new Date()
          }
        ]
      }
    ] as never);

    const todos = await WorkspaceService.listTodoProjects({
      userId: "client-1",
      role: "CLIENT"
    });

    expect(todos).toHaveLength(1);
    expect(todos[0].projectId).toBe("project-1");
    expect(todos[0].latestSubmissionStatus).toBe("PENDING");
  });
});
