
import { Footer } from "../components/Footer";
import { Hero } from "../components/Hero";
import { MainLayout } from "../components/MainLayout";
import { Services } from "../components/Services";

export function Home(){
    return(
        <>
           <MainLayout>
            <>
            <Hero />
            <Services />
            </>
           </MainLayout>
           <Footer />
        </>
    );
}