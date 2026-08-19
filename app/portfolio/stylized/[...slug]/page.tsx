import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { stylized } from "@/data/portfolio/stylized";

export default async function StylizedSlugPage({
  params,
}: {
  params: Promise<{
    slug: string[];
  }>;
}) {

  const { slug } = await params;

  return (
    <PortfolioCategory
      data={stylized}
      slug={slug}
    />
  );
}