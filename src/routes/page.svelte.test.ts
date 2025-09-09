import { render } from "@testing-library/svelte";
import Home from "./+page.svelte";
import { expect, test } from "vitest";

test("renders homepage with title", () => {
  const { getByText } = render(Home);
	
	const el = getByText("Reberrymemberer");
  expect(el).toBeTruthy();
});