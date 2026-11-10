import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { HeaderNav } from "./HeaderNav";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
// a plain <a> that shows which prefetch setting it was given
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ prefetch, children, ...rest }: { prefetch?: boolean; children: React.ReactNode; href: string }) => (
    <a data-prefetch={prefetch === undefined ? "default" : String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));
const pathname = usePathname as jest.MockedFunction<typeof usePathname>;

const current = () =>
  screen
    .getAllByRole("link")
    .filter((l) => l.hasAttribute("aria-current"))
    .map((l) => [l.textContent, l.getAttribute("aria-current")]);

describe("HeaderNav", () => {
  it("marks nothing on the homepage", () => {
    pathname.mockReturnValue("/");
    render(<HeaderNav />);
    expect(current()).toEqual([]);
  });

  it("marks the page you're on", () => {
    pathname.mockReturnValue("/aisles");
    render(<HeaderNav />);
    expect(current()).toEqual([["Aisles", "page"]]);
  });

  it("marks the section of a page inside it", () => {
    pathname.mockReturnValue("/decades/1980s");
    render(<HeaderNav />);
    expect(current()).toEqual([["Decades", "true"]]);
  });

  it("marks Ask the clerk on the clerk's page, with or without a request", () => {
    pathname.mockReturnValue("/search/ai");
    render(<HeaderNav />);
    expect(current()).toEqual([["Ask the clerk", "page"]]);
  });

  it("never prefetches the clerk's page, since rendering it can call the model", () => {
    pathname.mockReturnValue("/");
    render(<HeaderNav />);
    expect(screen.getByRole("link", { name: "Ask the clerk" })).toHaveAttribute("data-prefetch", "false");
    // other pages keep Next's default prefetching
    expect(screen.getByRole("link", { name: "Aisles" })).toHaveAttribute("data-prefetch", "default");
  });

  it("doesn't mark New Arrivals for a page that only starts the same way", () => {
    pathname.mockReturnValue("/newsletter");
    render(<HeaderNav />);
    expect(current()).toEqual([]);
  });
});
