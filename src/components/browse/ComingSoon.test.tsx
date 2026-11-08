import { render, screen, within } from "@testing-library/react";
import type { ArrivalCard } from "@/lib/types";
import { ComingSoon } from "./ComingSoon";

const arrival = (slug: string, title: string, date: string, week: ArrivalCard["week"]): ArrivalCard => ({
  slug,
  title,
  year: Number(date.slice(0, 4)),
  date,
  week,
});

describe("ComingSoon", () => {
  it("says so when nothing is announced", () => {
    render(<ComingSoon films={[]} />);
    expect(screen.getByText(/Nothing announced yet/)).toBeInTheDocument();
  });

  it("groups films into this week, next week and later, skipping empty groups", () => {
    render(
      <ComingSoon
        films={[
          arrival("1-a", "Film A", "2026-11-13", "this"),
          arrival("2-b", "Film B", "2026-11-14", "this"),
          arrival("3-c", "Film C", "2026-12-30", "later"),
        ]}
      />,
    );
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["This week", "Later"]);
    const thisWeek = screen.getByRole("region", { name: "This week" });
    expect(within(thisWeek).getAllByRole("link")).toHaveLength(2);
    expect(within(thisWeek).getByText("2 tapes")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Later" })).getByText("1 tape")).toBeInTheDocument();
  });

  it("links each film and gives its opening date, worked out from the date alone", () => {
    render(<ComingSoon films={[arrival("1381071-godzilla-minus-zero", "Godzilla Minus Zero", "2026-11-20", "next")]} />);
    const link = screen.getByRole("link", { name: /Godzilla Minus Zero/ });
    expect(link).toHaveAttribute("href", "/films/1381071-godzilla-minus-zero");
    expect(within(link).getByText("Opens Friday 20 Nov 2026")).toBeInTheDocument();
    expect(within(link).getByText("20 Nov")).toBeInTheDocument(); // the sticker
  });
});
