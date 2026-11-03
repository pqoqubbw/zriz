import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { pagePath } from "@/lib/nav";

const NotFound = () => (
  <main className="mx-auto page-column pt-18">
    <PageHeader title="not found">
      this page does not exist. start from the{" "}
      <Link className="link" href={pagePath("introduction")}>
        introduction
      </Link>
      .
    </PageHeader>
  </main>
);

export default NotFound;
