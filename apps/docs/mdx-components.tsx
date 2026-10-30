import type { MDXComponents } from "mdx/types";

import { ApiTable } from "@/components/api-table";
import { Demo } from "@/components/demo";

const components: MDXComponents = { ApiTable, Demo };

export const useMDXComponents = (): MDXComponents => components;
