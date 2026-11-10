import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import type { ClerkAnswer as Answer } from "@/lib/ai-search/clerk";
import { EXAMPLE_QUERIES } from "@/lib/ai-search/examples";
import { emptyFilters } from "@/lib/ai-search/schema";
import { decodeFilters } from "@/lib/ai-search/url";
import { CLERK_STATUS_ID } from "./Announce";
import { ClerkAnswer, ExampleQueries } from "./ClerkAnswer";
import { ClerkCounter } from "./ClerkCounter";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
// a plain <a> that shows which prefetch setting it was given
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ prefetch, scroll, children, ...rest }: { prefetch?: boolean; scroll?: boolean; children: React.ReactNode; href: string }) => (
    <a data-prefetch={prefetch === undefined ? "default" : String(prefetch)} data-scroll={scroll === false ? "false" : undefined} {...rest}>
      {children}
    </a>
  ),
}));

const answer = (over: Partial<Answer> = {}): Answer => ({
  query: "90s comedies",
  mode: "ai",
  comment: "Pulled 90s comedies, most popular first.",
  filters: { ...emptyFilters(), genres: [{ id: 35, name: "Comedy" }], releasedFrom: "1990-01-01", releasedTo: "1999-12-31" },
  dropped: [],
  films: [{ slug: "1-groundhog-day", title: "Groundhog Day", year: 1993 }],
  total: 120,
  ...over,
});

/** Every link to the clerk's page in the document. */
const clerkLinks = () => screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.startsWith("/search/ai"));

describe("ClerkAnswer", () => {
  it("shows each filter as a removable chip that re-runs the search without it", () => {
    render(<ClerkAnswer answer={answer()} />);
    const chip = screen.getByRole("link", { name: "Remove genre: Comedy" });
    const f = new URL(chip.getAttribute("href")!, "http://x").searchParams.get("f")!;
    expect(decodeFilters(f)?.filters).toEqual({ ...emptyFilters(), releasedFrom: "1990-01-01", releasedTo: "1999-12-31" });
    expect(screen.getByRole("link", { name: "Remove release dates: 1990s" })).toBeInTheDocument();
  });

  it("never prefetches a link to the clerk's page: chips, suggestions or examples", () => {
    render(
      <>
        <ClerkAnswer answer={answer({ films: [], total: 0, suggestion: { drop: "the dates", filters: { ...emptyFilters(), genres: [{ id: 35, name: "Comedy" }] } } })} />
        <ClerkAnswer answer={answer({ mode: "off_topic", filters: undefined, films: [], total: 0 })} />
      </>,
    );
    const links = clerkLinks();
    expect(links.length).toBeGreaterThanOrEqual(2 + 1 + EXAMPLE_QUERIES.length);
    for (const a of links) expect(a).toHaveAttribute("data-prefetch", "false");
  });

  it("tells the customer what couldn't be used, and why it fell back", () => {
    render(<ClerkAnswer answer={answer({ dropped: ['"Jon Smithee"'], notice: "My AI helper took too long, so I matched the words myself." })} />);
    expect(screen.getByText(/Couldn’t use "Jon Smithee", so that part was left out/)).toBeInTheDocument();
    expect(screen.getByText("My AI helper took too long, so I matched the words myself.")).toBeInTheDocument();
  });

  it("offers a looser search when nothing matched", () => {
    render(<ClerkAnswer answer={answer({ films: [], total: 0, suggestion: { drop: "the dates", filters: emptyFilters() } })} />);
    expect(screen.getByText("Nothing on the shelves matches all of that.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try without the dates →" })).toBeInTheDocument();
  });

  it("announces the clerk's line and the count through the page's live region", () => {
    jest.useFakeTimers();
    const region = document.createElement("p");
    region.id = CLERK_STATUS_ID;
    document.body.appendChild(region);
    render(<ClerkAnswer answer={answer()} />);
    act(() => jest.advanceTimersByTime(200));
    expect(region).toHaveTextContent("Pulled 90s comedies, most popular first. Showing 1 of 120 tapes.");
    region.remove();
    jest.useRealTimers();
  });
});

describe("ExampleQueries", () => {
  it("links each example to the clerk, without prefetching", () => {
    render(<ExampleQueries title="Try" />);
    expect(clerkLinks().map((a) => new URL(a.getAttribute("href")!, "http://x").searchParams.get("q"))).toEqual([...EXAMPLE_QUERIES]);
  });
});

describe("ClerkCounter", () => {
  const push = jest.fn();
  beforeEach(() => {
    push.mockReset();
    (useRouter as jest.Mock).mockReturnValue({ push });
  });

  it("has a labelled search box", () => {
    render(<ClerkCounter />);
    expect(screen.getByRole("searchbox", { name: "What are you in the mood for?" })).toHaveAttribute("maxlength", "200");
  });

  it("asks the clerk with the tidied request", async () => {
    render(<ClerkCounter />);
    await userEvent.type(screen.getByRole("searchbox"), "  90s   heist movies {Enter}");
    expect(push).toHaveBeenCalledWith("/search/ai?q=90s+heist+movies");
  });

  it("can't be submitted empty, and doesn't ask again for what's already on the shelf", async () => {
    render(<ClerkCounter initialQuery="90s heist movies" />);
    await userEvent.click(screen.getByRole("button", { name: "Ask the clerk" }));
    expect(push).not.toHaveBeenCalled();
    await userEvent.clear(screen.getByRole("searchbox"));
    expect(screen.getByRole("button", { name: "Ask the clerk" })).toBeDisabled();
  });
});
