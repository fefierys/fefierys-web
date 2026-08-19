import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { semiRealism } from "@/data/portfolio/semiRealism";

export default async function SemiRealismSlugPage({
  params,
}: {
  params: Promise<{
    slug: string[];
  }>;
}) {

  const { slug } = await params;

  return (
    <PortfolioCategory
      data={semiRealism}
      slug={slug}
    />
  );
}