import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { chibis } from "@/data/portfolio/chibis";


export default async function ChibisSlugPage({
  params,
}: {
  params: Promise<{
    slug: string[];
  }>;
}) {

  const { slug } = await params;

  return (
    <PortfolioCategory
      data={chibis}
      slug={slug}
    />
  );
}