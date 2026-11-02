import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Page } from "@/components/doc/blocks";
import { Text } from "@/components/doc/text";
import { Footer } from "@/components/shell/footer";
import { Pager } from "@/components/shell/pager";
import { anchorsOf } from "@/lib/doc/anchors";
import { plain } from "@/lib/doc/inline";
import { docs } from "@/lib/docs";
import { isSlug, order, pathOf, titleOf } from "@/lib/nav";

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => order.map((slug) => ({ slug }));

export const generateMetadata = async ({
  params,
}: PageProps<"/docs/[slug]">): Promise<Metadata> => {
  const { slug } = await params;
  if (!isSlug(slug)) {
    return {};
  }
  return {
    alternates: {
      canonical: pathOf(slug),
      types: { "text/markdown": `${pathOf(slug)}.md` },
    },
    description: plain(docs[slug].lede),
    title: titleOf(slug),
  };
};

const DocPage = async ({ params }: PageProps<"/docs/[slug]">) => {
  const { slug } = await params;
  if (!isSlug(slug)) {
    notFound();
  }
  const doc = docs[slug];
  return (
    <>
      <header className="flex flex-col gap-2 pb-9">
        <h1 className="text-title">{titleOf(slug)}</h1>
        <p className="text-lede text-muted">
          <Text source={doc.lede} />
        </p>
      </header>
      <Page anchors={anchorsOf(doc.blocks)} blocks={doc.blocks} />
      <Pager slug={slug} />
      <Footer />
    </>
  );
};

export default DocPage;
