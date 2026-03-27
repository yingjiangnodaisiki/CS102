import { AppError } from "@/lib/errors/AppError";
import { ProjectRepository } from "@/lib/repositories/ProjectRepository";
import { ProjectService } from "@/lib/services/project/ProjectService";

describe("project visibility service", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should hide draft project from non-owner non-admin", async () => {
    jest.spyOn(ProjectRepository, "findById").mockResolvedValueOnce({
      id: "project-1",
      title: "draft",
      description: "desc",
      budgetMin: "100.00" as never,
      budgetMax: "200.00" as never,
      status: "DRAFT",
      biddingEndsAt: new Date(),
      tags: [],
      clientId: "client-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null
    });

    await expect(
      ProjectService.getProjectById(
        {
          userId: "dev-1",
          role: "DEVELOPER"
        },
        "project-1"
      )
    ).rejects.toBeInstanceOf(AppError);
  });
});
