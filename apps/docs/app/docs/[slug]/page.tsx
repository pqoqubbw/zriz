import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { content } from "@/lib/content";
import { pages } from "@/lib/pages";

export const dynamicParams = false;
export const generateStaticParams = () => pages.map(({ slug }) => ({ slug }));

export const generateMetadata = async ({
  params,
}: PageProps<"/docs/[slug]">): Promise<Metadata> => {
  const { slug } = await params;
  const page = pages.find((item) => item.slug === slug);
  return page ? { description: page.description, title: page.title } : {};
};

const DocPage = async ({ params }: PageProps<"/docs/[slug]">) => {
  const { slug } = await params;
  const load = content[slug];
  if (load === undefined) {
    notFound();
  }
  const { default: Content } = await load();
  return (
    <main className="wrap">
      <Link className="back" href="/">
        zriz
      </Link>
      <article className="prose">
        <Content />
      </article>
    </main>
  );
};

export default DocPage;
