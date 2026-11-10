import { render, screen, within } from "@testing-library/react";
import { Filters, Pager } from "./Filters";

describe("Pager", () => {
  const href = (p: number) => `/aisles/drama?page=${p}`;

  it("renders nothing when there's only one shelf", () => {
    const { container } = render(<Pager page={1} total={1} href={href} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("has no previous button on the first shelf", () => {
    render(<Pager page={1} total={5} href={href} />);
    expect(screen.queryByRole("link", { name: /Previous shelf/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Next shelf/ })).toHaveAttribute("href", "/aisles/drama?page=2");
    expect(screen.getByText("Shelf 1 of 5")).toBeInTheDocument();
  });

  it("links both ways in the middle, with the same solid style", () => {
    render(<Pager page={3} total={5} href={href} />);
    const prev = screen.getByRole("link", { name: /Previous shelf/ });
    const next = screen.getByRole("link", { name: /Next shelf/ });
    expect(prev).toHaveAttribute("href", "/aisles/drama?page=2");
    expect(next).toHaveAttribute("href", "/aisles/drama?page=4");
    expect(prev).toHaveClass("btn", "btn-solid");
    expect(next).toHaveClass("btn", "btn-solid");
  });

  it("has no next button on the last shelf", () => {
    render(<Pager page={5} total={5} href={href} />);
    expect(screen.queryByRole("link", { name: /Next shelf/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Previous shelf/ })).toBeInTheDocument();
  });
});

describe("Filters", () => {
  it("renders each group as links and marks the current choice", () => {
    render(
      <Filters
        groups={[
          {
            label: "Sort",
            options: [
              { label: "Top rated", href: "/aisles/drama", current: true },
              { label: "Newest", href: "/aisles/drama?sort=newest", current: false },
            ],
          },
        ]}
      />,
    );
    const group = screen.getByRole("group", { name: "Sort" });
    expect(within(group).getByRole("link", { name: "Top rated" })).toHaveAttribute("aria-current", "true");
    expect(within(group).getByRole("link", { name: "Newest" })).not.toHaveAttribute("aria-current");
    expect(within(group).getByRole("link", { name: "Newest" })).toHaveAttribute("href", "/aisles/drama?sort=newest");
  });
});
