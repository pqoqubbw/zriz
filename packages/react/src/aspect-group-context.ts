"use client";

import { createContext } from "react";
import type { Context } from "react";

const AspectGroupContext: Context<boolean> = createContext(false);

export { AspectGroupContext };
