import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import BarChart from "@/components/ui/BarChart";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import StarRating from "@/components/ui/StarRating";
import Tabs from "@/components/ui/Tabs";

describe("accessible UI primitives", () => {
  it("associates field errors with the input", () => {
    render(<Input label="Email" error="Enter a valid email" />);

    const input = screen.getByRole("textbox", { name: "Email" });
    const error = screen.getByRole("alert");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", error.id);
  });

  it("closes a dialog with Escape and restores focus", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open booking</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Edit booking">
            <button type="button">Save booking</button>
          </Modal>
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Open booking" });
    await user.click(trigger);
    expect(screen.getByRole("dialog", { name: "Edit booking" })).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save booking" })).toHaveFocus()
    );
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("supports arrow-key navigation between tabs", () => {
    const onChange = vi.fn();
    render(
      <Tabs
        tabs={[
          { id: "services", label: "Services" },
          { id: "reviews", label: "Reviews" },
        ]}
        activeTab="services"
        onChange={onChange}
      />
    );

    fireEvent.keyDown(screen.getByRole("tab", { name: "Services" }), {
      key: "ArrowRight",
    });
    expect(onChange).toHaveBeenCalledWith("reviews");
    expect(screen.getByRole("tab", { name: "Reviews" })).toHaveFocus();
  });

  it("exposes interactive ratings as a labelled radio group", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<StarRating rating={2} onChange={onChange} ariaLabel="Service rating" />);

    expect(screen.getByRole("radiogroup", { name: "Service rating" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("provides a semantic table for chart data", () => {
    render(
      <BarChart
        ariaLabel="Bookings by day"
        data={[
          { label: "Monday", value: 3 },
          { label: "Tuesday", value: 5 },
        ]}
      />
    );

    expect(screen.getByRole("table", { name: "Bookings by day" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Tuesday" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
  });
});
