import type { ReactElement } from "react";
import {
  render as testingLibraryRender,
  type RenderOptions,
} from "@testing-library/react";
import { NotificationProvider } from "@/context/NotificationContext";

export function render(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return testingLibraryRender(
    <NotificationProvider>{ui}</NotificationProvider>,
    options,
  );
}
