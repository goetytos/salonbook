import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { signupMock, pushMock } = vi.hoisted(() => ({
  signupMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ signup: signupMock }),
}));

import SignupPage from "@/app/auth/signup/page";

beforeEach(() => {
  signupMock.mockReset();
  pushMock.mockReset();
  window.history.replaceState(null, "", "/auth/signup");
});

describe("invitation-only business signup page", () => {
  it("does not unlock for a token placed in the query string", async () => {
    window.history.replaceState(
      null,
      "",
      `/auth/signup?invite=${"q".repeat(43)}&email=owner%40studio.co.ke`
    );

    render(<SignupPage />);

    expect(
      await screen.findByRole("heading", {
        name: /business signup is not open to the public yet/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /accept invitation/i })
    ).not.toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("accepts a fragment capability and immediately clears it from history", async () => {
    const token = "f".repeat(43);
    window.history.replaceState(
      null,
      "",
      `/auth/signup#invite=${token}&email=owner%40studio.co.ke`
    );

    render(<SignupPage />);

    expect(
      await screen.findByRole("button", {
        name: /accept invitation and create account/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/invited email address/i)).toHaveValue(
      "owner@studio.co.ke"
    );
    await waitFor(() => expect(window.location.hash).toBe(""));
    expect(window.location.search).toBe("");
  });
});
