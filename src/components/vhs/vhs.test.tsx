import { render, screen } from "@testing-library/react";
import { Slipcase } from "./Slipcase";
import { SpineRow } from "./SpineRow";

describe("SpineRow", () => {
  it("links each spine to its film", () => {
    render(<SpineRow label="Drama shelf" films={[{ slug: "346-seven-samurai", title: "Seven Samurai", year: 1954 }]} />);
    expect(screen.getByRole("list", { name: "Drama shelf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Seven Samurai, 1954/ })).toHaveAttribute("href", "/films/346-seven-samurai");
  });

  it("adds someone's role to the tooltip and the link's name", () => {
    render(
      <SpineRow label="Acted in" films={[{ slug: "1-heat", title: "Heat", year: 1995, role: "Lt. Vincent Hanna" }]} />,
    );
    const link = screen.getByRole("link", { name: /Heat, 1995, Lt\. Vincent Hanna/ });
    expect(link).toHaveAttribute("title", "Heat (1995) · Lt. Vincent Hanna");
  });
});

describe("Slipcase", () => {
  it("prints the set's name, tape count and years, with a spine per tape", () => {
    const { container } = render(
      <Slipcase
        name="The Godfather"
        films={[
          { slug: "1-a", title: "The Godfather", year: 1972 },
          { slug: "2-b", title: "The Godfather Part II", year: 1974 },
          { slug: "3-c", title: "The Godfather Part III", year: 1990 },
        ]}
      />,
    );
    // once on the slipcase's label, once on the first tape's spine
    expect(screen.getAllByText("The Godfather")).toHaveLength(2);
    expect(screen.getByText("3-tape collection · 1972–1990")).toBeInTheDocument();
    expect(container.querySelectorAll('[style*="height"]')).toHaveLength(3);
  });

  it("shows a single year when every tape is from the same year", () => {
    render(
      <Slipcase
        name="Infernal Affairs"
        films={[
          { slug: "1-a", title: "Infernal Affairs II", year: 2003 },
          { slug: "2-b", title: "Infernal Affairs III", year: 2003 },
        ]}
      />,
    );
    expect(screen.getByText("2-tape collection · 2003")).toBeInTheDocument();
  });
});
