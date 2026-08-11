import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { chibis } from "@/data/portfolio/chibis";


export default function ChibisPage() {

  return (
    <PortfolioCategory
      data={chibis}
    />
  );

}