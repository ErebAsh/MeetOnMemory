import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import BrowseOrganizations from "../BrowseOrganizations/BrowseOrganizations";
import { organizationApi, membershipRequestApi } from "../../services";

vi.mock("../../components/Navbar.jsx", () => ({
  default: () => <div data-testid="navbar">Navbar</div>,
}));

vi.mock("../../services", () => ({
  organizationApi: {
    browsePublicOrganizations: vi.fn(),
    joinOrganization: vi.fn(),
  },
  membershipRequestApi: {
    createRequest: vi.fn(),
  },
}));

const mockOrganizations = [
  {
    _id: "org-1",
    name: "Open Community",
    slug: "open-community",
    description: "A public org with open join",
    visibility: "public",
    joinPolicy: "open",
    memberCount: 12,
    createdAt: "2025-01-01T00:00:00.000Z",
    membershipStatus: "none",
  },
  {
    _id: "org-2",
    name: "Approval Required Org",
    slug: "approval-org",
    description: "Requires admin approval",
    visibility: "public",
    joinPolicy: "approval_required",
    memberCount: 4,
    createdAt: "2025-02-01T00:00:00.000Z",
    membershipStatus: "none",
  },
];

describe("BrowseOrganizations (#293)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    organizationApi.browsePublicOrganizations.mockResolvedValue({
      data: {
        success: true,
        organizations: mockOrganizations,
        pagination: {
          page: 1,
          limit: 12,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });
  });

  it("loads and renders public organizations for discovery", async () => {
    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("navbar")).toBeInTheDocument();
    expect(screen.getByText("Discover Organizations")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Open Community")).toBeInTheDocument();
    });

    expect(screen.getByText("Approval Required Org")).toBeInTheDocument();
    expect(organizationApi.browsePublicOrganizations).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        search: "",
        sortBy: "createdAt",
        filter: "all",
      }),
    );
  });

  it("shows join vs request labels based on join policy", async () => {
    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Open Community")).toBeInTheDocument();
    });

    expect(screen.getAllByRole("button", { name: /Join/i })).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /^Request Join$/i }),
    ).toBeInTheDocument();
  });

  it("submits a membership request for approval-required organizations", async () => {
    membershipRequestApi.createRequest.mockResolvedValue({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Approval Required Org")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Request Join/i }));

    await waitFor(() => {
      expect(membershipRequestApi.createRequest).toHaveBeenCalledWith({
        organizationId: "org-2",
        message: "Request to join via Browse Organizations",
      });
    });
  });

  it("links back to the organization hub", async () => {
    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("link", { name: /Back to Organization Hub/i }),
    ).toHaveAttribute("href", "/organizations");
  });
});

describe("BrowseOrganizations infinite-scroll pagination", () => {
  let observers;

  beforeEach(() => {
    vi.clearAllMocks();
    observers = [];
    globalThis.IntersectionObserver = vi.fn(
      function IntersectionObserverMock(callback) {
        this.callback = callback;
        this.observe = vi.fn();
        this.disconnect = vi.fn();
        observers.push(this);
      },
    );
  });

  it("requests pagination pages sequentially without skipping or duplicating pages", async () => {
    organizationApi.browsePublicOrganizations.mockImplementation(
      async ({ page }) => ({
        data: {
          success: true,
          organizations: [
            {
              ...mockOrganizations[0],
              _id: `org-${page}`,
              name: `Organization ${page}`,
            },
          ],
          pagination: {
            page,
            limit: 12,
            total: 3,
            totalPages: 3,
            hasNextPage: page < 3,
            hasPrevPage: page > 1,
          },
        },
      }),
    );

    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Organization 1")).toBeInTheDocument();
    });

    observers.at(-1).callback([{ isIntersecting: true }]);
    observers.at(-1).callback([{ isIntersecting: true }]);

    await waitFor(() => {
      expect(screen.getByText("Organization 2")).toBeInTheDocument();
    });

    observers.at(-1).callback([{ isIntersecting: true }]);

    await waitFor(() => {
      expect(screen.getByText("Organization 3")).toBeInTheDocument();
    });

    expect(
      organizationApi.browsePublicOrganizations.mock.calls.map(
        ([params]) => params.page,
      ),
    ).toEqual([1, 2, 3]);
  });

  it("prevents concurrent requests when the sentinel intersects repeatedly", async () => {
    let resolvePageTwo;
    organizationApi.browsePublicOrganizations.mockImplementation(({ page }) => {
      if (page === 1) {
        return Promise.resolve({
          data: {
            success: true,
            organizations: [mockOrganizations[0]],
            pagination: {
              page: 1,
              limit: 12,
              total: 2,
              totalPages: 2,
              hasNextPage: true,
              hasPrevPage: false,
            },
          },
        });
      }

      return new Promise((resolve) => {
        resolvePageTwo = resolve;
      });
    });

    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Open Community")).toBeInTheDocument();
    });

    const observer = observers.at(-1);
    observer.callback([{ isIntersecting: true }]);
    observer.callback([{ isIntersecting: true }]);

    expect(
      organizationApi.browsePublicOrganizations.mock.calls.filter(
        ([params]) => params.page === 2,
      ),
    ).toHaveLength(1);

    resolvePageTwo({
      data: {
        success: true,
        organizations: [mockOrganizations[1]],
        pagination: {
          page: 2,
          limit: 12,
          total: 2,
          totalPages: 2,
          hasNextPage: false,
          hasPrevPage: true,
        },
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Approval Required Org")).toBeInTheDocument();
    });
  });

  it("resets pagination to page one when search changes", async () => {
    organizationApi.browsePublicOrganizations.mockResolvedValue({
      data: {
        success: true,
        organizations: mockOrganizations,
        pagination: {
          page: 1,
          limit: 12,
          total: 2,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      },
    });

    render(
      <MemoryRouter>
        <BrowseOrganizations />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Open Community")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /Search by organization name, slug, description, or tags/i,
    );
    fireEvent.change(input, { target: { value: "engineering" } });

    await waitFor(
      () => {
        expect(
          organizationApi.browsePublicOrganizations,
        ).toHaveBeenLastCalledWith(
          expect.objectContaining({ page: 1, search: "engineering" }),
        );
      },
      { timeout: 2000 },
    );
  });
});
