import Link from "next/link";

import { Sketch } from "@/components/sketch";
import { pages } from "@/lib/pages";

const Home = () => (
  <main className="wrap">
    <h1>zriz</h1>
    <p className="lede">
      Headless image cropper for React with the feel of iOS Photos. Straighten
      with a dial, never see an empty corner.
    </p>
    <Sketch />
    <nav className="toc">
      {pages.map((page) => (
        <Link href={`/docs/${page.slug}`} key={page.slug}>
          {page.title}
        </Link>
      ))}
    </nav>
  </main>
);

export default Home;
