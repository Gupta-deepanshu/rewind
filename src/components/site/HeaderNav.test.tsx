import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { HeaderNav } from "./HeaderNav";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
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

  it("marks Directors on a person's page", () => {
    pathname.mockReturnValue("/people/5026-akira-kurosawa");
    render(<HeaderNav />);
    expect(current()).toEqual([["Directors", "true"]]);
  });

  it("doesn't mark New Arrivals for a page that only starts the same way", () => {
    pathname.mockReturnValue("/newsletter");
    render(<HeaderNav />);
    expect(current()).toEqual([]);
  });
});
