import PortfolioCategory from "@/components/portfolio/PortfolioCategory";
import { stylized } from "@/data/portfolio/stylized";


export default function StylizedPage(){

 return (
   <PortfolioCategory 
    data={stylized}
  />
  
 );

}