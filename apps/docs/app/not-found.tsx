import Link from "next/link";

const NotFound = () => (
  <main className="mx-auto flex w-[min(560px,100%-32px)] flex-col gap-2 pt-18">
    <h1 className="text-title">not found</h1>
    <p className="text-lede text-muted">
      this page does not exist. start from the{" "}
      <Link className="link" href="/docs/introduction">
        introduction
      </Link>
      .
    </p>
  </main>
);

export default NotFound;
