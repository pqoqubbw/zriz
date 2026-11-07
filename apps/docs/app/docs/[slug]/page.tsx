import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocBody } from "@/components/doc/blocks";
import { Text } from "@/components/doc/text";
import { Footer } from "@/components/shell/footer";
import { PageHeader } from "@/components/shell/page-header";
import { Pager } from "@/components/shell/pager";
import { anchorsOf } from "@/lib/doc/anchors";
import { plain } from "@/lib/doc/inline";
import { DOCS } from "@/lib/docs";
import { isSlug, markdownPath, pagePath, slugParams, titleOf } from "@/lib/nav";
import { SITE_OPEN_GRAPH } from "@/lib/site";

const generateStaticParams = slugParams;

const generateMetadata = async ({
  params,
}: PageProps<"/docs/[slug]">): Promise<Metadata> => {
  const { slug } = await params;

  if (!isSlug(slug)) {
    return {};
  }

  return {
    alternates: {
      canonical: pagePath(slug),
      types: { "text/markdown": markdownPath(slug) },
    },
    description: plain(DOCS[slug].lede),
    openGraph: { ...SITE_OPEN_GRAPH, url: pagePath(slug) },
    title: titleOf(slug),
  };
};

const DocPage = async ({ params }: PageProps<"/docs/[slug]">) => {
  const { slug } = await params;

  if (!isSlug(slug)) {
    notFound();
  }

  const doc = DOCS[slug];

  return (
    <>
      <PageHeader className="pb-9" title={titleOf(slug)}>
        <Text source={doc.lede} />
      </PageHeader>
      <DocBody anchors={anchorsOf(doc.blocks)} blocks={doc.blocks} />
      <Pager slug={slug} />
      <Footer />
    </>
  );
};

export { generateMetadata, generateStaticParams };
export const dynamic = "force-static";
export const dynamicParams = false;
export default DocPage;
