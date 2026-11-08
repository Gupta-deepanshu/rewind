import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShelfTabs } from "./ShelfTabs";

const tabs = [
  { id: "directed", title: "Directed", count: 12, content: <p>Directed shelf</p> },
  { id: "wrote", title: "Wrote", count: 3, content: <p>Wrote shelf</p> },
  { id: "acted", title: "Acted in", content: <p>Acted shelf</p> },
];

describe("ShelfTabs", () => {
  it("opens on the first tab", () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    expect(screen.getByRole("tablist", { name: "Filmography" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Directed/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Directed shelf")).toBeVisible();
  });

  it("shows each tab's count", () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    expect(screen.getByRole("tab", { name: "Directed 12" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Acted in" })).toBeInTheDocument();
  });

  it("doesn't render a panel until it's first opened", async () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    expect(screen.queryByText("Wrote shelf")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: /Wrote/ }));
    expect(screen.getByText("Wrote shelf")).toBeVisible();
  });

  it("switches tabs on click and keeps an opened panel around, hidden", async () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    await userEvent.click(screen.getByRole("tab", { name: /Wrote/ }));
    expect(screen.getByRole("tab", { name: /Wrote/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Directed/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByText("Directed shelf")).not.toBeVisible();
  });

  it("moves with the arrow keys, Home and End, and wraps around", async () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    const [directed, wrote, acted] = screen.getAllByRole("tab");
    directed.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(wrote).toHaveFocus();
    expect(wrote).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{End}");
    expect(acted).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowRight}");
    expect(directed).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(acted).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{Home}");
    expect(directed).toHaveAttribute("aria-selected", "true");
  });

  it("lets only the selected tab take Tab focus", () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    expect(screen.getAllByRole("tab").map((t) => t.tabIndex)).toEqual([0, -1, -1]);
  });

  it("calls onChange with the new tab's id, but not for the tab already open", async () => {
    const onChange = jest.fn();
    render(<ShelfTabs tabs={tabs} label="Filmography" onChange={onChange} />);
    await userEvent.click(screen.getByRole("tab", { name: /Directed/ }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: /Acted in/ }));
    expect(onChange).toHaveBeenCalledWith("acted");
  });

  it("ties each tab to its panel", async () => {
    render(<ShelfTabs tabs={tabs} label="Filmography" />);
    const tab = screen.getByRole("tab", { name: /Directed/ });
    const panel = screen.getByRole("tabpanel", { name: /Directed/ });
    expect(tab).toHaveAttribute("aria-controls", panel.id);
  });
});
